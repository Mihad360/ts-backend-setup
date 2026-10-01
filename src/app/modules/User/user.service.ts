import HttpStatus from "http-status";
import { Types } from "mongoose";
import { JwtPayload } from "../../interface/global";
import { UserModel } from "./user.model";
import AppError from "../../erros/AppError";
import QueryBuilder from "../../../builder/QueryBuilder";
import { IUser } from "./user.interface";
import { sendFileToCloudinary } from "../../utils/sendImageToCloudinary";

const getMe = async (user: JwtPayload) => {
  const userId = new Types.ObjectId(user.user);
  const isUserExist = await UserModel.findById(userId).select(
    "-password -fcmToken -otp -passwordChangedAt -expiresAt",
  );
  if (!isUserExist) {
    throw new AppError(HttpStatus.NOT_FOUND, "User does not exist");
  }
  return isUserExist;
};

const getUsers = async (query: Record<string, unknown>) => {
  const searchableFields = ["name", "email", "phone"];

  const userQuery = new QueryBuilder(
    UserModel.find(
      { isDeleted: false },
      "-fcmToken -password -otp -expiresAt -passwordChangedAt",
    ),
    query,
  )
    .search(searchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await userQuery.countTotal();
  const result = await userQuery.modelQuery;
  return { meta, result };
};

const editProfile = async (
  id: string,
  file: Express.Multer.File,
  payload: Partial<IUser>,
) => {
  const user = await UserModel.findById(id);

  if (!user) {
    throw new AppError(HttpStatus.NOT_FOUND, "User not found");
  }

  if (user.isDeleted) {
    throw new AppError(HttpStatus.FORBIDDEN, "This account is deactivated");
  }

  if (file) {
    const uploadResult = await sendFileToCloudinary(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
    payload.profileImage = uploadResult.secure_url;
  }

  // Prevent sensitive and immutable fields from being overwritten
  delete payload.password;
  delete payload.role;
  delete payload.isDeleted;
  delete payload.isVerified;
  delete payload.otp;
  delete payload.expiresAt;
  delete payload.passwordChangedAt;
  delete payload.email; // email changes should go through dedicated verification

  const updatedUser = await UserModel.findByIdAndUpdate(
    id,
    { $set: payload },
    { new: true, runValidators: true },
  ).select("-password -otp -expiresAt -passwordChangedAt");

  return updatedUser;
};

export const userServices = {
  getMe,
  getUsers,
  editProfile,
};
