import { Router } from "express";
import { userRoutes } from "../modules/User/user.routes";
import { AuthRoutes } from "../modules/Auth/auth.route";
import { notificationRoutes } from "../modules/Notification/notification.route";

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
    path: "/notification",
    route: notificationRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route?.route));

export default router;
