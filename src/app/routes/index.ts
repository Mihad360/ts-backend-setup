import { Router } from "express";
import { userRoutes } from "../modules/User/user.routes";
import { AuthRoutes } from "../modules/Auth/auth.route";
import { notificationRoutes } from "../modules/Notification/notification.route";
import { conversationRoutes } from "../modules/Conversation/conversation.route";
import { messageRoutes } from "../modules/Message/message.route";
import { AboutRoutes } from "../modules/Settings/About/About.route";
import { PrivacyRoutes } from "../modules/Settings/privacy/Privacy.route";
import { TermsRoutes } from "../modules/Settings/Terms/Terms.route";

const router = Router();

const moduleRoutes = [
  {
    path: "/users",
    route: userRoutes,
  },
  {
    path: "/auth",
    route: AuthRoutes,
  },
  {
    path: "/notifications",
    route: notificationRoutes,
  },
  {
    path: "/notification", // backward compatibility alias
    route: notificationRoutes,
  },
  {
    path: "/conversations",
    route: conversationRoutes,
  },
  {
    path: "/messages",
    route: messageRoutes,
  },
  {
    path: "/settings/about",
    route: AboutRoutes,
  },
  {
    path: "/settings/privacy",
    route: PrivacyRoutes,
  },
  {
    path: "/settings/terms",
    route: TermsRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
