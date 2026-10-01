import { Types } from "mongoose";

export interface IConversation {
  _id?: Types.ObjectId;
  participants: Types.ObjectId[];
  creator?: Types.ObjectId;
  lastMessage?: string | null;
  lastMessageAt?: Date | null;
  isActive?: boolean;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
