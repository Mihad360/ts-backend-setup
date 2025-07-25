import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join((process.cwd(), ".env")) });

export default {
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL,
  node_env: process.env.NODE_ENV,
  node_mail_email: process.env.NODE_MAIL_EMAIL,
  node_mail_pass: process.env.NODE_MAIL_PASS,
  cloudinary_name: process.env.CLOUDINARY_NAME,
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET,
  // super_admin_password: process.env.SUPER_ADMIN_PASSWORD,
  // bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  // default_pass: process.env.DEFAULT_PASS,
  // jwt_access_secret: process.env.JWT_ACCESS_SECRET,
  // jwt_refresh_secret: process.env.JWT_REFRESH_SECRET,
  // jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN,
  // jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN,
  // reset_pass_ui_link: process.env.RESET_PASS_UI_LINK,
};
