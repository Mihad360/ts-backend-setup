import bcrypt from "bcrypt";
import HttpStatus from "http-status";
import { Types } from "mongoose";
import AppError from "../../erros/AppError";
import { UserModel } from "../User/user.model";
import { IAuth } from "./auth.interface";
import config from "../../config";
import { JwtPayload } from "../../interface/global";
import { sendEmail } from "../../utils/sendEmail";
import { generateOtp, verificationEmailTemplate } from "./auth.utils";
import { IUser } from "../User/user.interface";
import { createNotification } from "../Notification/notification.utils";
import { sendPushNotifications } from "../../utils/firebase/notification";
import { createToken, verifyToken } from "../../utils/jwt/jwt";

/**
 * Register a new user:
 * - Normalizes email to lowercase
 * - Handles abandoned/unverified previous registrations gracefully
 * - Generates secure 6-digit OTP
 * - Safe notification to admins without blocking registration
 */
const createUser = async (payload: IUser) => {
  const email = payload.email.toLowerCase().trim();

  /* ------------------ Check existing account ------------------ */
  const existingUser = await UserModel.findOne({ email });

  if (existingUser) {
    if (existingUser.isDeleted) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        "An account associated with this email has been deactivated. Please contact support.",
      );
    }

    if (existingUser.isVerified) {
      throw new AppError(
        HttpStatus.CONFLICT,
        "An account with this email address already exists.",
      );
    }

    // Smooth recovery: User registered previously but never completed verification
    const otp = generateOtp();
    const expireAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    // Update with new password if provided, along with refreshed OTP
    const updateData: Partial<IUser> = {
      otp,
      expiresAt: expireAt,
    };

    if (payload.password) {
      updateData.password = await bcrypt.hash(payload.password, 10);
    }
    if (payload.name) {
      updateData.name = payload.name;
    }
    if (payload.phone) {
      updateData.phone = payload.phone;
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      existingUser._id,
      { $set: updateData },
      { new: true },
    ).select("-password -otp -passwordChangedAt");

    // Resend verification email
    try {
      await sendEmail(
        email,
        "Verify your account",
        verificationEmailTemplate(email, otp),
      );
    } catch (mailError) {
      // eslint-disable-next-line no-console
      console.error("Verification email failed:", mailError);
    }

    return updatedUser;
  }

  /* ------------------ Create new user ------------------ */
  const otp = generateOtp();
  const expireAt = new Date(Date.now() + 5 * 60 * 1000);

  const newUser = await UserModel.create({
    ...payload,
    email,
    otp,
    expiresAt: expireAt,
    isVerified: false,
  });

  /* ------------------ Send OTP via email ------------------ */
  try {
    await sendEmail(
      email,
      "Verification Code",
      verificationEmailTemplate(email, otp),
    );
  } catch (mailError) {
    // eslint-disable-next-line no-console
    console.error("Failed to send registration OTP email:", mailError);
  }

  /* ------------------ Notify Admins (Fail-safe) ------------------ */
  try {
    const admins = await UserModel.find({
      role: { $in: ["admin", "super_admin"] },
      isVerified: true,
      isDeleted: false,
    }).select("_id fcmToken");

    if (admins.length > 0) {
      await Promise.all(
        admins.map((admin) =>
          createNotification({
            sender: newUser._id as Types.ObjectId,
            recipient: admin._id as Types.ObjectId,
            type: "user_registration",
            title: "New User Registered",
            message: `A new ${newUser.role} registered: ${newUser.email}`,
            data: {
              userId: newUser._id.toString(),
              role: newUser.role,
              email: newUser.email,
            },
          }),
        ),
      );

      const adminTokens = admins.flatMap((admin) => admin.fcmToken ?? []);
      if (adminTokens.length > 0) {
        await sendPushNotifications(
          adminTokens,
          "New User Registered",
          `A new ${newUser.role} registered: ${newUser.email}`,
        );
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Admin notification failed:", err);
  }

  return UserModel.findById(newUser._id).select(
    "-password -otp -passwordChangedAt",
  );
};

/**
 * User login:
 * - Robust standalone and cluster compatibility (no replica-set requirement)
 * - Returns both accessToken and refreshToken
 * - Auto-detects unverified state and sends a fresh OTP
 */
const loginUser = async (payload: IAuth) => {
  const email = payload.email.toLowerCase().trim();

  const user = await UserModel.findOne({ email }).select("+password");

  if (!user) {
    throw new AppError(HttpStatus.UNAUTHORIZED, "Invalid email or password");
  }

  if (user.isDeleted) {
    throw new AppError(
      HttpStatus.FORBIDDEN,
      "This account has been deactivated. Please contact support.",
    );
  }

  if (user.isActive === false) {
    throw new AppError(
      HttpStatus.FORBIDDEN,
      "This account is currently suspended.",
    );
  }

  // Smooth unverified guard: auto-send verification code if user never verified
  if (!user.isVerified) {
    const otp = generateOtp();
    const expireAt = new Date(Date.now() + 5 * 60 * 1000);

    await UserModel.findByIdAndUpdate(user._id, {
      $set: { otp, expiresAt: expireAt },
    });

    try {
      await sendEmail(
        user.email,
        "Verify your account",
        verificationEmailTemplate(user.email, otp),
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Verification email dispatch failed:", err);
    }

    return {
      isVerified: false,
      message:
        "Your account is not verified. A verification code has been sent to your email.",
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
      },
    };
  }

  const isPasswordValid = await UserModel.compareUserPassword(
    payload.password,
    user.password,
  );

  if (!isPasswordValid) {
    throw new AppError(HttpStatus.UNAUTHORIZED, "Invalid email or password");
  }

  // Register push token if provided
  if (payload.fcmToken) {
    await UserModel.findByIdAndUpdate(user._id, {
      $addToSet: { fcmToken: payload.fcmToken },
    });
  }

  const jwtPayload: JwtPayload = {
    user: user._id as Types.ObjectId,
    email: user.email,
    role: user.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.JWT_SECRET_KEY as string,
    (config.JWT_ACCESS_EXPIRES_IN as string) || "1d",
  );

  const refreshToken = createToken(
    jwtPayload,
    config.JWT_REFRESH_KEY as string,
    (config.JWT_REFRESH_EXPIRES_IN as string) || "30d",
  );

  return {
    isVerified: true,
    _id: user._id,
    role: user.role,
    accessToken,
    refreshToken,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      profileImage: user.profileImage,
      isVerified: user.isVerified,
    },
  };
};

/**
 * Forgot password:
 * - Generates 6-digit OTP with 5-minute expiry
 * - Dispatches professional reset template
 */
const forgetPassword = async (email: string) => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await UserModel.findOne({
    email: normalizedEmail,
    isDeleted: false,
  });

  if (!user) {
    throw new AppError(
      HttpStatus.NOT_FOUND,
      "No account found with this email address",
    );
  }

  const otp = generateOtp();
  const expireAt = new Date(Date.now() + 5 * 60 * 1000);

  await UserModel.findByIdAndUpdate(user._id, {
    $set: { otp, expiresAt: expireAt },
  });

  try {
    await sendEmail(
      user.email,
      "Password Reset Code",
      verificationEmailTemplate(user.email, otp),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to send reset email:", err);
    throw new AppError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      "Failed to dispatch password reset email. Please try again later.",
    );
  }

  return {
    email: user.email,
    message: "Password reset verification code sent to your email",
  };
};

/**
 * Verify OTP:
 * - Validates code and expiration
 * - Marks user as verified
 * - Returns access token, refresh token, and a dedicated 15-minute reset token
 */
const verifyOtp = async (payload: { email: string; otp: string }) => {
  const normalizedEmail = payload.email.toLowerCase().trim();
  const code = payload.otp?.trim();

  if (!code) {
    throw new AppError(HttpStatus.BAD_REQUEST, "OTP code is required");
  }

  const user = await UserModel.findOne({
    email: normalizedEmail,
    isDeleted: false,
  });

  if (!user) {
    throw new AppError(HttpStatus.NOT_FOUND, "User not found");
  }

  if (!user.otp) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "No verification code pending for this account",
    );
  }

  // Check expiration
  if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
    await UserModel.findByIdAndUpdate(user._id, {
      $set: { otp: null, expiresAt: null },
    });
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Verification code has expired. Please request a new one.",
    );
  }

  if (user.otp !== code) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Invalid verification code. Please try again.",
    );
  }

  // OTP verified: clear OTP fields and mark account as verified
  const verifiedUser = await UserModel.findByIdAndUpdate(
    user._id,
    {
      $set: {
        otp: null,
        expiresAt: null,
        isVerified: true,
      },
    },
    { new: true },
  ).select("-password");

  const jwtPayload: JwtPayload = {
    user: user._id as Types.ObjectId,
    email: user.email,
    role: user.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.JWT_SECRET_KEY as string,
    (config.JWT_ACCESS_EXPIRES_IN as string) || "1d",
  );

  const refreshToken = createToken(
    jwtPayload,
    config.JWT_REFRESH_KEY as string,
    (config.JWT_REFRESH_EXPIRES_IN as string) || "30d",
  );

  const resetToken = createToken(
    jwtPayload,
    config.JWT_SECRET_KEY as string,
    "15m",
  );

  return {
    email: user.email,
    isVerified: true,
    accessToken,
    refreshToken,
    resetToken,
    user: verifiedUser,
  };
};

/**
 * Reset password (typically called after verifyOtp):
 * - Validates minimum password strength
 * - Automatically issues fresh session tokens upon reset
 */
const resetPassword = async (
  payload: { newPassword: string },
  userInfo: JwtPayload,
) => {
  if (!payload.newPassword || payload.newPassword.trim().length < 6) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Password must be at least 6 characters long",
    );
  }

  const user = await UserModel.findOne({
    email: userInfo.email.toLowerCase().trim(),
    isDeleted: false,
  });

  if (!user) {
    throw new AppError(HttpStatus.NOT_FOUND, "User does not exist");
  }

  const newHashedPassword = await bcrypt.hash(payload.newPassword, 10);

  const updatedUser = await UserModel.findByIdAndUpdate(
    user._id,
    {
      $set: {
        password: newHashedPassword,
        passwordChangedAt: new Date(),
        otp: null,
        expiresAt: null,
      },
    },
    { new: true },
  );

  if (!updatedUser) {
    throw new AppError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      "Failed to update password",
    );
  }

  const jwtPayload: JwtPayload = {
    user: updatedUser._id as Types.ObjectId,
    email: updatedUser.email,
    role: updatedUser.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.JWT_SECRET_KEY as string,
    (config.JWT_ACCESS_EXPIRES_IN as string) || "1d",
  );

  const refreshToken = createToken(
    jwtPayload,
    config.JWT_REFRESH_KEY as string,
    (config.JWT_REFRESH_EXPIRES_IN as string) || "30d",
  );

  return {
    message: "Password reset successfully",
    accessToken,
    refreshToken,
  };
};

/**
 * Change password for authenticated users:
 * - Checks current password match
 * - Hashes new password
 * - Rotates authentication tokens instantly
 */
const changePassword = async (
  userId: string | Types.ObjectId,
  payload: { currentPassword: string; newPassword: string },
) => {
  if (!payload.currentPassword || !payload.newPassword) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Current password and new password are required",
    );
  }

  if (payload.newPassword.length < 6) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "New password must be at least 6 characters long",
    );
  }

  const id = new Types.ObjectId(userId);
  const user = await UserModel.findById(id).select("+password");

  if (!user || user.isDeleted) {
    throw new AppError(HttpStatus.NOT_FOUND, "User not found or deactivated");
  }

  const isCurrentPasswordCorrect = await bcrypt.compare(
    payload.currentPassword,
    user.password,
  );

  if (!isCurrentPasswordCorrect) {
    throw new AppError(
      HttpStatus.UNAUTHORIZED,
      "Current password is incorrect",
    );
  }

  const isSamePassword = await bcrypt.compare(
    payload.newPassword,
    user.password,
  );

  if (isSamePassword) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "New password cannot be the same as your current password",
    );
  }

  const newHashedPassword = await bcrypt.hash(payload.newPassword, 10);

  const updatedUser = await UserModel.findByIdAndUpdate(
    user._id,
    {
      $set: {
        password: newHashedPassword,
        passwordChangedAt: new Date(),
      },
    },
    { new: true },
  ).select("-password -otp -passwordChangedAt");

  const jwtPayload: JwtPayload = {
    user: user._id as Types.ObjectId,
    email: user.email,
    role: user.role,
  };

  const accessToken = createToken(
    jwtPayload,
    config.JWT_SECRET_KEY as string,
    (config.JWT_ACCESS_EXPIRES_IN as string) || "1d",
  );

  const refreshToken = createToken(
    jwtPayload,
    config.JWT_REFRESH_KEY as string,
    (config.JWT_REFRESH_EXPIRES_IN as string) || "30d",
  );

  return {
    accessToken,
    refreshToken,
    user: updatedUser,
  };
};

/**
 * Resend OTP:
 * - Includes a 60-second cooldown to prevent email server throttling
 * - Re-arms OTP with a fresh 5-minute expiry
 */
const resendOtp = async (email: string) => {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await UserModel.findOne({
    email: normalizedEmail,
    isDeleted: false,
  });

  if (!user) {
    throw new AppError(HttpStatus.NOT_FOUND, "User not found");
  }

  // 60-second anti-spam cooldown check
  if (user.expiresAt) {
    const timeRemainingMs = new Date(user.expiresAt).getTime() - Date.now();
    // If more than 4 minutes remain (out of 5 min expiry), request is too frequent (< 60s elapsed)
    if (timeRemainingMs > 4 * 60 * 1000) {
      const waitSeconds = Math.ceil((timeRemainingMs - 4 * 60 * 1000) / 1000);
      throw new AppError(
        HttpStatus.TOO_MANY_REQUESTS,
        `Please wait ${waitSeconds} seconds before requesting a new verification code.`,
      );
    }
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await UserModel.findByIdAndUpdate(user._id, {
    $set: { otp, expiresAt },
  });

  try {
    await sendEmail(
      user.email,
      "New Verification Code",
      verificationEmailTemplate(user.email, otp),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to send new verification code:", err);
    throw new AppError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      "Failed to deliver verification email. Please try again.",
    );
  }

  return {
    message: "New verification code sent to your email",
    email: user.email,
  };
};

/**
 * Refresh access token:
 * - Rotates both access and refresh tokens
 * - Checks password change timestamp against token issue time
 */
const refreshToken = async (token: string) => {
  if (!token) {
    throw new AppError(HttpStatus.UNAUTHORIZED, "Refresh token is missing");
  }

  const decoded = verifyToken(
    token,
    config.JWT_REFRESH_KEY as string,
  );

  if (!decoded) {
    throw new AppError(
      HttpStatus.UNAUTHORIZED,
      "Invalid or expired refresh token",
    );
  }

  const { email, iat } = decoded;
  const user = await UserModel.findOne({ email: email.toLowerCase().trim() });

  if (!user || user.isDeleted) {
    throw new AppError(HttpStatus.UNAUTHORIZED, "User no longer exists or is deactivated");
  }

  if (
    user.passwordChangedAt &&
    !(await UserModel.isOldTokenValid(user.passwordChangedAt, iat as number))
  ) {
    throw new AppError(
      HttpStatus.UNAUTHORIZED,
      "Token expired due to recent password change. Please log in again.",
    );
  }

  const jwtPayload: JwtPayload = {
    user: user._id as Types.ObjectId,
    email: user.email,
    role: user.role,
  };

  const newAccessToken = createToken(
    jwtPayload,
    config.JWT_SECRET_KEY as string,
    (config.JWT_ACCESS_EXPIRES_IN as string) || "1d",
  );

  const newRefreshToken = createToken(
    jwtPayload,
    config.JWT_REFRESH_KEY as string,
    (config.JWT_REFRESH_EXPIRES_IN as string) || "30d",
  );

  return {
    role: user.role,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

export const authServices = {
  createUser,
  loginUser,
  forgetPassword,
  resetPassword,
  changePassword,
  verifyOtp,
  resendOtp,
  refreshToken,
};
