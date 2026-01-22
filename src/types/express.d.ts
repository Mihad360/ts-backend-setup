import { JwtPayload } from "../app/interface/global";
import { Server as SocketIo } from "socket.io";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
  namespace NodeJS {
    interface Global {
      io: SocketIo;
    }
  }
}
