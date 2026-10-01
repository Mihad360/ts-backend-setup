import express from "express";
import auth from "../../../middlewares/auth";
import { privacyControllers } from "./Privacy.controller";

const router = express.Router();

router.get("/", privacyControllers.getAllPrivacy);
router.post(
  "/create",
  auth("admin", "super_admin"),
  privacyControllers.createPrivacy,
);
router.patch(
  "/update",
  auth("admin", "super_admin"),
  privacyControllers.updatePrivacy,
);

export const PrivacyRoutes = router;
