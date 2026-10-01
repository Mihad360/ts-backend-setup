import HttpStatus from "http-status";
import { ClientSession, Types } from "mongoose";
import { UserModel } from "../../modules/User/user.model";
import {
  INotification,
  SendNotificationPayload,
  TNotificationType,
} from "../../modules/Notification/notification.interface";
import { connectedUsers, io } from "../../utils/socket";
import { sendPushNotifications } from "../../utils/firebase/notification";
import AppError from "../../erros/AppError";
import { NotificationModel } from "./notification.model";

// Map each type to socket event name
const getSocketEvent = (
  type: TNotificationType,
  recipientId: string,
): string => {
  const eventMap: Record<TNotificationType, string> = {
    message: `new_message-${recipientId}`,
    alert: `alert-${recipientId}`,
    account: `account-${recipientId}`,
    system: `system-${recipientId}`,
    user_registration: `user_registration-${recipientId}`,
    general: `notification-${recipientId}`,
  };

  return eventMap[type] || `notification-${recipientId}`;
};

export const createNotification = async (
  payload: INotification,
  session?: ClientSession,
) => {
  try {
    if (!payload) {
      throw new AppError(HttpStatus.BAD_REQUEST, "Payload is required");
    }

    const created = await NotificationModel.create([payload], { session });
    if (!created || !created[0]) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        "Notification creation failed",
      );
    }

    return created[0];
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error creating notification:", error);
    throw error;
  }
};

export const sendNotification = async (payload: SendNotificationPayload) => {
  const { recipientId, senderId, type = "general", title, message, data } = payload;
  const recipientIdStr = recipientId.toString();

  // 1. Save to DB
  let savedNotification;
  try {
    savedNotification = await createNotification({
      recipient: new Types.ObjectId(recipientIdStr),
      sender: senderId ? new Types.ObjectId(senderId.toString()) : null,
      type,
      title,
      message,
      data: data || {},
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to persist notification in DB:", error);
  }

  // 2. Socket.io — emit real-time event
  try {
    const connectedUser = connectedUsers.get(recipientIdStr);
    if (connectedUser && io) {
      const socketEvent = getSocketEvent(type, recipientIdStr);
      const eventPayload = {
        _id: savedNotification?._id,
        type,
        title,
        message,
        data: data || {},
        createdAt: savedNotification?.createdAt || new Date(),
      };

      io.to(connectedUser.socketID).emit(socketEvent, eventPayload);
      io.to(connectedUser.socketID).emit("notification", eventPayload);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Socket notification emit failed:", err);
  }

  // 3. Firebase — push notification
  try {
    const user = await UserModel.findById(recipientIdStr).select("fcmToken");
    if (user?.fcmToken && user.fcmToken.length > 0) {
      await sendPushNotifications(user.fcmToken, title, message);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Push notification failed:", err);
  }

  return savedNotification;
};
