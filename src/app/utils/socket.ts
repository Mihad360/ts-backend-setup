/* eslint-disable @typescript-eslint/no-explicit-any */
import HttpStatus from "http-status";
import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import AppError from "../erros/AppError";
import { verifyToken } from "./jwt/jwt";
import { UserModel } from "../modules/User/user.model";
import config from "../config";

declare module "socket.io" {
  interface Socket {
    user?: {
      _id: string;
      name?: string;
      email: string;
      role: string;
    };
  }
}

// Initialize the Socket.IO server
let io: SocketIOServer;
export const connectedUsers = new Map<string, { socketID: string }>();
export const connectedClients = new Map<string, Socket>();

export const initSocketIO = async (server: HttpServer): Promise<void> => {
  // eslint-disable-next-line no-console
  console.log("🔧 Initializing Socket.IO server 🔧");

  const { Server } = await import("socket.io");

  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // eslint-disable-next-line no-console
  console.log("🎉 Socket.IO server initialized! 🎉");

  // Authentication middleware
  io.use(async (socket: Socket, next: (err?: any) => void) => {
    const token =
      (socket.handshake.headers.token as string) ||
      (socket.handshake.auth.token as string);

    if (!token) {
      return next(new AppError(HttpStatus.UNAUTHORIZED, "Token missing"));
    }

    try {
      // Verify token
      const userDetails = verifyToken(token, config.JWT_SECRET_KEY as string);
      if (!userDetails) {
        return next(new Error("Authentication error: Invalid token"));
      }

      const user = await UserModel.findById(userDetails.user).select(
        "_id name email role",
      );
      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      // Attach user data to socket
      socket.user = {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role as string,
      };

      connectedUsers.set(socket.user._id, { socketID: socket.id });
      next();
    } catch {
      return next(new Error("Authentication error: Token verification failed"));
    }
  });

  io.on("connection", (socket: Socket) => {
    if (socket.user && socket.user._id) {
      connectedUsers.set(socket.user._id, { socketID: socket.id });
      socket.join(`user_${socket.user._id}`);
    }

    socket.on("userConnected", ({ userId }: { userId: string }) => {
      connectedUsers.set(userId, { socketID: socket.id });
      socket.join(`user_${userId}`);
    });

    socket.on("disconnect", () => {
      for (const [key, value] of connectedUsers.entries()) {
        if (value.socketID === socket.id) {
          connectedUsers.delete(key);
          break;
        }
      }
    });
  });
};

export { io };
