import HttpStatus from "http-status";
import { Types } from "mongoose";
import { JwtPayload } from "../../interface/global";
import { MessageModel } from "./message.model";
import { ConversationModel } from "../Conversation/conversation.model";
import AppError from "../../erros/AppError";
import QueryBuilder from "../../../builder/QueryBuilder";
import { sendFileToCloudinary } from "../../utils/sendImageToCloudinary";
import { IMessage } from "./message.interface";
import { UserModel } from "../User/user.model";
import { sendNotification } from "../Notification/notification.utils";

// ─── Helper — verify sender is part of conversation ───────────────────────────
const verifyParticipant = async (
  conversationId: Types.ObjectId,
  userId: Types.ObjectId,
) => {
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

  return conversation;
};

// ─── Helper — get other participants in conversation ─────────────────────────
const getOtherParticipants = (
  conversation: { participants: Types.ObjectId[] },
  senderId: Types.ObjectId,
): Types.ObjectId[] => {
  return conversation.participants
    .map((p) => (p as { _id?: Types.ObjectId })?._id || (p as Types.ObjectId))
    .filter((id) => !new Types.ObjectId(id.toString()).equals(senderId))
    .map((id) => new Types.ObjectId(id.toString()));
};

// ─── Get Messages ─────────────────────────────────────────────────────────────
const getMessages = async (
  user: JwtPayload,
  conversationId: string,
  query: Record<string, unknown>,
) => {
  const userId = new Types.ObjectId(user.user);
  const convId = new Types.ObjectId(conversationId);

  await verifyParticipant(convId, userId);

  // Mark unread messages as read
  await MessageModel.updateMany(
    {
      conversationId: convId,
      senderId: { $ne: userId },
      isRead: false,
    },
    { $set: { isRead: true } },
  );

  const messageQuery = new QueryBuilder(
    MessageModel.find({
      conversationId: convId,
      isDeleted: false,
    }).populate("senderId", "name profileImage role email"),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await messageQuery.countTotal();
  const result = await messageQuery.modelQuery;

  return { meta, result };
};

// ─── Send Text Message ────────────────────────────────────────────────────────
const sendMessage = async (
  user: JwtPayload,
  conversationId: string,
  payload: Partial<IMessage>,
) => {
  const userId = new Types.ObjectId(user.user);
  const convId = new Types.ObjectId(conversationId);

  const conversation = await verifyParticipant(convId, userId);

  if (!payload.content || !payload.content.trim()) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Message content is required");
  }

  const message = await MessageModel.create({
    conversationId: convId,
    senderId: userId,
    content: payload.content.trim(),
    messageType: "text",
  });

  await ConversationModel.findByIdAndUpdate(
    convId,
    {
      $set: {
        lastMessage: payload.content.trim(),
        lastMessageAt: new Date(),
      },
    },
    { new: true },
  );

  // Notify other participants via socket + firebase
  const sender = await UserModel.findById(userId).select("name");
  const otherParticipants = getOtherParticipants(conversation, userId);

  for (const recipientId of otherParticipants) {
    try {
      await sendNotification({
        recipientId,
        senderId: userId,
        type: "message",
        title: `New message from ${sender?.name || "User"}`,
        message: payload.content.trim(),
        data: {
          conversationId: convId.toString(),
          messageId: message._id ? message._id.toString() : "",
          messageType: "text",
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Message notification failed:", err);
    }
  }

  return message;
};

// ─── Send Attachment ──────────────────────────────────────────────────────────
const sendAttachment = async (
  user: JwtPayload,
  conversationId: string,
  files: Express.Multer.File[],
  content?: string,
) => {
  const userId = new Types.ObjectId(user.user);
  const convId = new Types.ObjectId(conversationId);

  const conversation = await verifyParticipant(convId, userId);

  if (!files || !files.length) {
    throw new AppError(HttpStatus.BAD_REQUEST, "At least one file is required");
  }

  const allowedImageTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  const allowedDocTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/csv",
  ];
  const allowedAudioTypes = [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "audio/webm",
    "audio/m4a",
    "audio/x-m4a",
  ];
  const allowedVideoTypes = [
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/mpeg",
  ];

  for (const file of files) {
    const isImage = allowedImageTypes.some((t) => file.mimetype.startsWith(t));
    const isDoc = allowedDocTypes.includes(file.mimetype);
    const isAudio = allowedAudioTypes.some((t) => file.mimetype.startsWith(t));
    const isVideo = allowedVideoTypes.some((t) => file.mimetype.startsWith(t));

    if (!isImage && !isDoc && !isAudio && !isVideo) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        `Unsupported file type: ${file.mimetype}`,
      );
    }
  }

  const allImages = files.every((f) => f.mimetype.startsWith("image/"));
  const allDocs = files.every((f) => allowedDocTypes.includes(f.mimetype));
  const allAudio = files.every((f) => f.mimetype.startsWith("audio/"));
  const allVideo = files.every((f) => f.mimetype.startsWith("video/"));

  if (!allImages && !allDocs && !allAudio && !allVideo) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Cannot mix file types. Send images together, documents together, or single media files",
    );
  }

  const messageType: IMessage["messageType"] = allImages
    ? "image"
    : allAudio
      ? "audio"
      : allVideo
        ? "image" // or document
        : "document";

  const uploadResults = await Promise.all(
    files.map((file) =>
      sendFileToCloudinary(file.buffer, file.originalname, file.mimetype),
    ),
  );

  const attachments = uploadResults.map((result, index) => ({
    url: result.secure_url,
    type: (allImages
      ? "image"
      : allAudio
        ? "audio"
        : allVideo
          ? "video"
          : "document") as "image" | "audio" | "document" | "video",
    name: files[index].originalname,
    size: files[index].size,
  }));

  const message = await MessageModel.create({
    conversationId: convId,
    senderId: userId,
    content: content?.trim() || undefined,
    messageType,
    attachments,
  });

  const countText = files.length > 1 ? ` (${files.length})` : "";
  const lastMessagePreview =
    messageType === "image"
      ? `📷 Image${countText}`
      : messageType === "audio"
        ? "🎵 Audio"
        : `📄 Document${countText}`;

  await ConversationModel.findByIdAndUpdate(
    convId,
    {
      $set: {
        lastMessage: content?.trim() || lastMessagePreview,
        lastMessageAt: new Date(),
      },
    },
    { new: true },
  );

  const sender = await UserModel.findById(userId).select("name");
  const otherParticipants = getOtherParticipants(conversation, userId);

  for (const recipientId of otherParticipants) {
    try {
      await sendNotification({
        recipientId,
        senderId: userId,
        type: "message",
        title: `New message from ${sender?.name || "User"}`,
        message: content?.trim() || lastMessagePreview,
        data: {
          conversationId: convId.toString(),
          messageId: message._id ? message._id.toString() : "",
          messageType,
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Attachment notification failed:", err);
    }
  }

  return message;
};

// ─── Delete Message (soft delete) ────────────────────────────────────────────
const deleteMessage = async (user: JwtPayload, messageId: string) => {
  const userId = new Types.ObjectId(user.user);

  const message = await MessageModel.findById(messageId);

  if (!message || message.isDeleted) {
    throw new AppError(HttpStatus.NOT_FOUND, "Message not found");
  }

  if (!message.senderId.equals(userId)) {
    throw new AppError(
      HttpStatus.FORBIDDEN,
      "You can only delete your own messages",
    );
  }

  await MessageModel.findByIdAndUpdate(
    messageId,
    { $set: { isDeleted: true } },
    { new: true },
  );

  return null;
};

export const messageServices = {
  getMessages,
  sendMessage,
  sendAttachment,
  deleteMessage,
};
