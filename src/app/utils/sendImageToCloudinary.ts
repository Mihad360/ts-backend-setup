import { v2 as cloudinary, UploadApiResponse, UploadApiOptions } from "cloudinary";
import multer, { StorageEngine } from "multer";
import path from "path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { Readable } from "stream";
import config from "../config";
import AppError from "../erros/AppError";
import HttpStatus from "http-status";

// Optimize sharp performance: scale across CPU cores and disable uncompressed image memory retention
sharp.concurrency(0);
sharp.cache(false);

// Cloudinary config
cloudinary.config({
  cloud_name: config.CLOUDINARY_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Image optimization guard:
 * - Resizes images exceeding 2048x2048 (preserving aspect ratio, without enlargement)
 * - Auto-orients image based on EXIF orientation
 * - Compresses to high-performance WebP (quality: 80, effort: 3) for optimal speed & size
 * - Bypasses SVGs and animated GIFs/WebPs to prevent distortion
 * - Fail-safe fallback to original buffer on any processing error
 */
export const optimizeImageBuffer = async (
  buffer: Buffer,
  mimetype: string,
): Promise<{ buffer: Buffer; mimetype: string }> => {
  if (!buffer || buffer.length === 0) {
    return { buffer, mimetype };
  }

  // Bypass non-raster formats immediately
  if (!mimetype.startsWith("image/") || mimetype === "image/svg+xml") {
    return { buffer, mimetype };
  }

  try {
    const isGif = mimetype === "image/gif";
    const image = sharp(buffer, {
      animated: isGif,
      failOn: "none",
      limitInputPixels: 50000000, // 50MP limit guards against decompression bombs
    });

    const metadata = await image.metadata();

    // Preserve animated GIFs and multi-page/animated WebPs without flattening frames
    if (isGif || (metadata.pages && metadata.pages > 1)) {
      return { buffer, mimetype };
    }

    const optimizedBuffer = await image
      .rotate() // Auto-orient based on EXIF tag
      .resize({
        width: 2048,
        height: 2048,
        fit: "inside",
        withoutEnlargement: true,
        fastShrinkOnLoad: true,
      })
      .webp({
        quality: 80,
        effort: 3,
        smartSubsample: true,
      })
      .toBuffer();

    return { buffer: optimizedBuffer, mimetype: "image/webp" };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      "Image optimization skipped due to error, proceeding with original buffer:",
      error,
    );
    return { buffer, mimetype };
  }
};

/**
 * PDF optimization guard:
 * - Compresses PDF objects and cross-reference streams using PDF object streams
 * - Cleans metadata overhead and redundant structures while preserving 100% document quality
 * - Limits optimization to PDFs <= 5MB to prevent blocking the Node.js event loop
 */
export const optimizePdfBuffer = async (buffer: Buffer): Promise<Buffer> => {
  // Avoid heavy JS PDF parsing on very large files to keep event loop fast and responsive
  if (!buffer || buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
    return buffer;
  }

  try {
    const pdfDoc = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    const savedBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });
    const optimizedBuffer = Buffer.from(savedBytes);
    return optimizedBuffer.length < buffer.length ? optimizedBuffer : buffer;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      "PDF optimization skipped due to error, proceeding with original buffer:",
      error,
    );
    return buffer;
  }
};

/**
 * DOCX optimization guard:
 * - Re-compresses OpenXML package components using fast DEFLATE (level 6)
 * - Skips files > 5MB to avoid excessive RAM allocation
 */
export const optimizeDocxBuffer = async (buffer: Buffer): Promise<Buffer> => {
  if (!buffer || buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
    return buffer;
  }

  try {
    const zip = await JSZip.loadAsync(buffer);
    const compressed = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6, // Level 6 provides ~98% of level 9 compression with up to 5x faster processing
      },
    });
    return compressed.length < buffer.length ? compressed : buffer;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      "DOCX optimization skipped due to error, proceeding with original buffer:",
      error,
    );
    return buffer;
  }
};

/**
 * Helper: Streams buffer to Cloudinary with timeout guard and error event handling
 */
const uploadStreamToCloudinary = (
  buffer: Buffer,
  options: UploadApiOptions,
  timeoutMs = 60000,
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    let isSettled = false;

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        reject(
          new AppError(
            HttpStatus.REQUEST_TIMEOUT,
            `Cloudinary upload timed out after ${timeoutMs / 1000}s`,
          ),
        );
      }
    }, timeoutMs);

    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (isSettled) return;
        clearTimeout(timer);
        isSettled = true;

        if (error) return reject(error);
        if (!result) return reject(new Error("No result from Cloudinary"));
        resolve(result);
      },
    );

    uploadStream.on("error", (err) => {
      if (isSettled) return;
      clearTimeout(timer);
      isSettled = true;
      reject(err);
    });

    // Stream buffer with backpressure support
    Readable.from(buffer).pipe(uploadStream);
  });
};

/**
 * Upload function for Cloudinary:
 * - Automatically classifies resource type (image, raw doc, audio, video)
 * - Executes pre-upload compression/optimization guards
 * - Streams directly to Cloudinary with network timeout protection
 */
export const sendFileToCloudinary = async (
  fileBuffer: Buffer,
  fileName: string,
  mimetype: string,
  customFolder?: string,
): Promise<UploadApiResponse> => {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Missing file buffer");
  }
  if (!mimetype) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Missing mimetype");
  }

  const baseFolder =
    customFolder ||
    config.CLOUDINARY_FOLDER_NAME?.trim() ||
    config.APP_NAME?.replace(/\s+/g, "_").toLowerCase() ||
    "uploads";

  // Sanitize filename to prevent directory traversal or malformed public_id
  const parsed = path.parse(fileName);
  const ext = parsed.ext.toLowerCase();
  const safeName =
    parsed.name
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "file";

  const timestamp = Date.now();

  // ============================
  // 1️⃣ IMAGE Upload (with optimization guard)
  // ============================
  if (mimetype.startsWith("image/")) {
    const { buffer: processedBuffer } = await optimizeImageBuffer(
      fileBuffer,
      mimetype,
    );

    return uploadStreamToCloudinary(processedBuffer, {
      public_id: `${timestamp}-${safeName}`,
      resource_type: "image",
      folder: `${baseFolder}/images`,
      transformation: [
        { quality: "auto" },
        { fetch_format: "auto" },
      ],
      overwrite: false,
    });
  }

  // ============================
  // 2️⃣ PDF + DOCUMENTS Uploads (with compression guard)
  // ============================
  else if (
    mimetype === "application/pdf" ||
    mimetype === "application/msword" ||
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimetype.startsWith("text/") ||
    ext === ".pdf" ||
    ext === ".doc" ||
    ext === ".docx"
  ) {
    let processedBuffer = fileBuffer;

    if (mimetype === "application/pdf" || ext === ".pdf") {
      processedBuffer = await optimizePdfBuffer(fileBuffer);
    } else if (
      mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === ".docx"
    ) {
      processedBuffer = await optimizeDocxBuffer(fileBuffer);
    }

    return uploadStreamToCloudinary(processedBuffer, {
      public_id: `${timestamp}-${safeName}${ext || ""}`,
      resource_type: "raw",
      folder: `${baseFolder}/docs`,
      overwrite: false,
    });
  }

  // ============================
  // 3️⃣ AUDIO Upload (mp3, wav, webm, m4a, ogg etc.)
  // Cloudinary requires audio under resource_type: "video"
  // ============================
  else if (mimetype.startsWith("audio/")) {
    return uploadStreamToCloudinary(fileBuffer, {
      public_id: `${timestamp}-${safeName}`,
      resource_type: "video",
      folder: `${baseFolder}/audio`,
      transformation: [{ quality: "auto" }],
      overwrite: false,
    });
  }

  // ============================
  // 4️⃣ VIDEO Upload
  // ============================
  else if (mimetype.startsWith("video/")) {
    return uploadStreamToCloudinary(fileBuffer, {
      public_id: `${timestamp}-${safeName}`,
      resource_type: "video",
      folder: `${baseFolder}/videos`,
      transformation: [{ quality: "auto" }],
      overwrite: false,
    });
  }

  // ============================
  // ❌ Unsupported file
  // ============================
  else {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      `Unsupported file type: ${mimetype}`,
    );
  }
};

/**
 * Delete asset from Cloudinary helper
 */
export const deleteFromCloudinary = async (
  publicId: string,
  resourceType: "image" | "raw" | "video" = "image",
): Promise<unknown> => {
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
  });
};

/**
 * Batch upload files to Cloudinary concurrently
 */
export const sendMultipleFilesToCloudinary = async (
  files: Array<{ buffer: Buffer; originalname: string; mimetype: string }>,
  customFolder?: string,
): Promise<UploadApiResponse[]> => {
  return Promise.all(
    files.map((file) =>
      sendFileToCloudinary(
        file.buffer,
        file.originalname,
        file.mimetype,
        customFolder,
      ),
    ),
  );
};

// Multer memory storage for receiving files
const storage: StorageEngine = multer.memoryStorage();

const allowedMimePatterns = [
  // Images
  "image/",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  // Audio
  "audio/",
  // Video
  "video/",
];

/**
 * Factory for creating customized multer upload instances
 */
export const createMulterUpload = (options?: {
  maxSizeInMb?: number;
  allowedTypes?: string[];
}) => {
  const maxBytes = (options?.maxSizeInMb ?? 10) * 1024 * 1024;
  const types = options?.allowedTypes ?? allowedMimePatterns;

  return multer({
    storage,
    limits: {
      fileSize: maxBytes,
    },
    fileFilter: (req, file, cb) => {
      const isAllowed = types.some((pattern) => {
        if (pattern.endsWith("/")) {
          return file.mimetype.startsWith(pattern);
        }
        return file.mimetype === pattern;
      });

      if (!isAllowed) {
        return cb(
          new AppError(
            HttpStatus.BAD_REQUEST,
            `Invalid file type: ${file.mimetype}. Allowed types: ${types.join(", ")}`,
          ),
        );
      }

      cb(null, true);
    },
  });
};

// Default multi-purpose upload (10MB limit)
export const upload = createMulterUpload({ maxSizeInMb: 10 });

// Specialized upload middlewares
export const uploadImage = createMulterUpload({
  maxSizeInMb: 10,
  allowedTypes: ["image/"],
});

export const uploadDocument = createMulterUpload({
  maxSizeInMb: 15,
  allowedTypes: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
  ],
});

export const uploadAudio = createMulterUpload({
  maxSizeInMb: 20,
  allowedTypes: ["audio/"],
});

export const uploadVideo = createMulterUpload({
  maxSizeInMb: 50,
  allowedTypes: ["video/"],
});
