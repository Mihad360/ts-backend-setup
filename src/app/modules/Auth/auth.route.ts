import express from "express";
import { authControllers } from "./auth.controller";
import auth from "../../middlewares/auth";

const router = express.Router();

router.post("/create", authControllers.createUser);
router.post("/login", authControllers.loginUser);
router.post("/verify-otp", authControllers.verifyOtp);
router.post("/resend-otp/:email", authControllers.resendOtp);
router.post("/forget-password", authControllers.forgetPassword);
router.post(
  "/reset-password",
  auth("admin", "user", "super_admin"),
  authControllers.resetPassword,
);
router.post(
  "/change-password",
  auth("admin", "user", "super_admin"),
  authControllers.changePassword,
);
router.post("/refresh-token", authControllers.refreshToken);

export const AuthRoutes = router;
