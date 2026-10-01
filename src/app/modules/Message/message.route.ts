import express, { NextFunction, Request, Response } from "express";
import { messageControllers } from "./message.controller";
import auth from "../../middlewares/auth";
import { upload } from "../../utils/sendImageToCloudinary";

const router = express.Router();

// ─── Get all messages in a conversation ──────────────────────────────────────
router.get(
  "/:conversationId",
  auth("user", "admin", "super_admin"),
  messageControllers.getMessages,
);

// ─── Send text message ────────────────────────────────────────────────────────
router.post(
  "/:conversationId/send-text",
  auth("user", "admin", "super_admin"),
  messageControllers.sendMessage,
);

// ─── Send attachment ──────────────────────────────────────────────────────────
router.post(
  "/:conversationId/attachment",
  auth("user", "admin", "super_admin"),
  upload.array("files", 10),
  (req: Request, res: Response, next: NextFunction) => {
    if (req.body.data) {
      try {
        req.body = JSON.parse(req.body.data);
      } catch {
        // If already parsed or plain text, continue
      }
    }
    next();
  },
  messageControllers.sendAttachment,
);

// ─── Delete message ───────────────────────────────────────────────────────────
router.delete(
  "/:messageId",
  auth("user", "admin", "super_admin"),
  messageControllers.deleteMessage,
);

export const messageRoutes = router;
