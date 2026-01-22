import { Types } from "mongoose";

export interface JwtPayload {
  user: Types.ObjectId | string;
  email: string;
  role: "user" | "admin";
  iat?: number;
  exp?: number;
}

export const USER_ROLE = {
  admin: "admin",
  user: "user",
} as const;

export type TUserRole = keyof typeof USER_ROLE;
