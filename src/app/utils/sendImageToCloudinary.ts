import { v2 as cloudinary } from "cloudinary";
import config from "../config";
import multer from "multer";
import fs from "fs";
import { UploadApiResponse } from "cloudinary";

cloudinary.config({
  cloud_name: config.cloudinary_name,
  api_key: config.cloudinary_api_key,
  api_secret: config.cloudinary_api_secret, // Click 'View API Keys' above to copy your API secret
});

export const sendImageToCloudinary = (
  imageName: string,
  path: string,
): Promise<Record<string, unknown>> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      path,
      {
        public_id: imageName,
      },
      function (error, result) {
        if (error) {
          reject(error);
        }
        resolve(result as UploadApiResponse);
        // delete a file asynchronously
        fs.unlink(path, (err) => {
          if (err) {
            reject(err);
          }
          console.log("file is deleted");
        });
      },
    );
  });
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.cwd() + "/uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix);
  },
});

export const upload = multer({ storage: storage });

// import HttpStatus from "http-status";
// import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
// import config from "../config";
// import multer, { StorageEngine } from "multer";
// import AppError from "../erros/AppError";

// // Cloudinary config
// cloudinary.config({
//   cloud_name: config.cloudinary_name,
//   api_key: config.cloudinary_api_key,
//   api_secret: config.cloudinary_api_secret,
// });

// // Upload to Cloudinary (buffer to base64)
// export const sendImageToCloudinary = (
//   fileBuffer: Buffer,
//   imageName: string,
//   mimetype: string,
// ): Promise<UploadApiResponse> => {
//   return new Promise((resolve, reject) => {
//     if (!fileBuffer)
//       throw new AppError(HttpStatus.NOT_FOUND, "Missing file buffer");
//     if (!mimetype) throw new AppError(HttpStatus.NOT_FOUND, "Missing mimetype");

//     // Convert to base64
//     const base64Image = fileBuffer.toString("base64");
//     const dataUri = `data:${mimetype};base64,${base64Image}`;

//     cloudinary.uploader.upload(
//       dataUri,
//       {
//         public_id: imageName,
//         resource_type: "image",
//         type: "upload",
//       },
//       (error, result) => {
//         if (error) return reject(error);
//         if (!result) return reject(new Error("No result from Cloudinary"));
//         resolve(result);
//       },
//     );
//   });
// };

// // Multer memory storage
// const storage: StorageEngine = multer.memoryStorage();
// export const upload = multer({ storage });
