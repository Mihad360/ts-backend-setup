import fs from "fs";
import path from "path";
import multer from "multer";
import HttpStatus from "http-status";
import AppError from "../erros/AppError";

// Re-export memory-based multer middlewares for Cloudinary uploads
export {
  upload,
  uploadImage,
  uploadDocument,
  uploadAudio,
  uploadVideo,
  createMulterUpload,
} from "./sendImageToCloudinary";

/**
 * Ensure a directory exists (creates recursively if missing)
 */
const ensureDirExists = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Decide folder based on mime type
 */
export const getUploadFolder = (mimetype: string) => {
  if (mimetype.startsWith("image")) return "images";
  if (mimetype.startsWith("audio")) return "audio";
  if (mimetype.startsWith("video")) return "videos";
  return "docs";
};

/**
 * Optional Disk Storage configuration for local file saving if needed
 */
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const publicDir = path.join(process.cwd(), "public");
      const folder = getUploadFolder(file.mimetype);
      const uploadDir = path.join(publicDir, folder);

      ensureDirExists(publicDir);
      ensureDirExists(uploadDir);

      cb(null, uploadDir);
    } catch {
      cb(new AppError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create upload directory"), "");
    }
  },

  filename: (req, file, cb) => {
    try {
      const parsed = path.parse(file.originalname);
      const ext = parsed.ext.toLowerCase();
      const baseName = parsed.name
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .replace(/-+/g, "-")
        .toLowerCase()
        .slice(0, 50);

      const uniqueName = `${Date.now()}-${baseName}${ext}`;
      cb(null, uniqueName);
    } catch {
      cb(new AppError(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate file name"), "");
    }
  },
});

export const diskUpload = multer({
  storage: diskStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});
