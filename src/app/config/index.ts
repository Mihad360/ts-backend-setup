import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.join(process.cwd(), ".env"),
});

const config = {
  NODE_ENV: process.env.NODE_ENV,
  PORT: Number(process.env.PORT),

  DATABASE_URL: process.env.DATABASE_URL,

  JWT_SECRET_KEY: process.env.JWT_SECRET_KEY,
  JWT_REFRESH_KEY: process.env.JWT_REFRESH_KEY,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN,

  NODE_MAIL_EMAIL: process.env.NODE_MAIL_EMAIL,
  NODE_MAIL_EMAIL_CLIENT: process.env.NODE_MAIL_EMAIL_CLIENT,
  NODE_MAIL_PASS: process.env.NODE_MAIL_PASS,

  UPLOAD_FOLDER: process.env.UPLOAD_FOLDER,
  APP_NAME: process.env.APP_NAME,
  ENDPOINT_SECRET: process.env.ENDPOINT_SECRET,

  CLOUDINARY_NAME: process.env.CLOUDINARY_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

  LOCAL_URL: process.env.LOCAL_URL,
} as const;

export default config;
