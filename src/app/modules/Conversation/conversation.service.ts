import HttpStatus from "http-status";
import { Types } from "mongoose";
import { JwtPayload } from "../../interface/global";
import { ConversationModel } from "./conversation.model";
import { UserModel } from "../User/user.model";
import AppError from "../../erros/AppError";
import QueryBuilder from "../../../builder/QueryBuilder";

// ─── Create Or Get Existing 1-on-1 Conversation ──────────────────────────────
const createOrGetConversation = async (
  user: JwtPayload,
  recipientId: string,
) => {
  const userId = new Types.ObjectId(user.user);
  const otherUserId = new Types.ObjectId(recipientId);

  if (userId.equals(otherUserId)) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Cannot start conversation with yourself",
    );
  }

  const recipientExists = await UserModel.findById(otherUserId);
  if (!recipientExists || recipientExists.isDeleted) {
    throw new AppError(HttpStatus.NOT_FOUND, "Recipient user does not exist");
  }

  let conversation = await ConversationModel.findOne({
    isDeleted: false,
    participants: { $all: [userId, otherUserId], $size: 2 },
  })
    .populate("participants", "name email profileImage role phone")
    .populate("creator", "name email profileImage role");

  if (!conversation) {
    const created = await ConversationModel.create({
      participants: [userId, otherUserId],
      creator: userId,
      lastMessageAt: new Date(),
    });

    conversation = await ConversationModel.findById(created._id)
      .populate("participants", "name email profileImage role phone")
      .populate("creator", "name email profileImage role");
  }

  return conversation;
};

// ─── Get All My Conversations ─────────────────────────────────────────────────
const getMyConversations = async (
  user: JwtPayload,
  query: Record<string, unknown>,
) => {
  const userId = new Types.ObjectId(user.user);

  const filter: Record<string, unknown> = {
    isDeleted: false,
    participants: userId,
  };

  const conversationQuery = new QueryBuilder(
    ConversationModel.find(filter)
      .populate("participants", "name email profileImage role phone")
      .populate("creator", "name email profileImage role")
      .sort({ lastMessageAt: -1 }),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await conversationQuery.countTotal();
  const result = await conversationQuery.modelQuery;

  return { meta, result };
};

// ─── Get Single Conversation ──────────────────────────────────────────────────
const getConversationById = async (
  user: JwtPayload,
  conversationId: string,
) => {
  const userId = new Types.ObjectId(user.user);

  const conversation = await ConversationModel.findById(conversationId)
    .populate("participants", "name email profileImage role phone")
    .populate("creator", "name email profileImage role");

  if (!conversation || conversation.isDeleted) {
    throw new AppError(HttpStatus.NOT_FOUND, "Conversation not found");
  }

  // verify requester is part of this conversation
  const isParticipant = conversation.participants.some((p) => {
    const id = (p as { _id?: Types.ObjectId })?._id || (p as Types.ObjectId);
    return id ? new Types.ObjectId(id.toString()).equals(userId) : false;
  });

  if (!isParticipant) {
    throw new AppError(
      HttpStatus.FORBIDDEN,
      "You are not part of this conversation",
    );
  }

  return conversation;
};

// ─── Delete Conversation (soft delete) ───────────────────────────────────────
const deleteConversation = async (user: JwtPayload, conversationId: string) => {
  const userId = new Types.ObjectId(user.user);

  const conversation = await ConversationModel.findById(conversationId);

  if (!conversation || conversation.isDeleted) {
    throw new AppError(HttpStatus.NOT_FOUND, "Conversation not found");
  }

  const isParticipant = conversation.participants.some((p) => {
    const id = (p as { _id?: Types.ObjectId })?._id || (p as Types.ObjectId);
    return id ? new Types.ObjectId(id.toString()).equals(userId) : false;
  });

  if (!isParticipant) {
    throw new AppError(
      HttpStatus.FORBIDDEN,
      "You are not part of this conversation",
    );
  }

  await ConversationModel.findByIdAndUpdate(
    conversationId,
    { $set: { isDeleted: true, isActive: false } },
    { new: true },
  );

  return null;
};

export const conversationServices = {
  createOrGetConversation,
  getMyConversations,
  getConversationById,
  deleteConversation,
};
