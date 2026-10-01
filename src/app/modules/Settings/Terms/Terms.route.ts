import express from "express";
import auth from "../../../middlewares/auth";
import { termsControllers } from "./Terms.controller";

const router = express.Router();

router.post(
  "/create",
  auth("admin", "super_admin"),
  termsControllers.createTerms,
);
router.get("/", termsControllers.getAllTerms);
router.patch(
  "/update",
  auth("admin", "super_admin"),
  termsControllers.updateTerms,
);

export const TermsRoutes = router;
