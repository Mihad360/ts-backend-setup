import express, { Application, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import notFound from "./app/middlewares/notFound";
import router from "./app/routes";
import { template } from "./rootTemplate";
import { privacyControllers } from "./app/modules/Settings/privacy/Privacy.controller";
import { logHttpRequests } from "./logger/logger";

const app: Application = express();

// Request logging
app.use(logHttpRequests);

// Parser & CORS
app.use(
  cors({
    origin: ["*", "", ""],
    credentials: true,
  }),
);
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(cookieParser());

// Static file hosting
app.use("/public", express.static(path.join(process.cwd(), "public")));

// Application API routes
app.use("/api/v1", router);

// Publicly accessible legal / policy routes
app.use("/privacy-policy", privacyControllers.htmlRoute);
app.use("/app-instruction", privacyControllers.appInstruction);

// Welcome Root Route
app.get("/", (req: Request, res: Response) => {
  res.status(200).send(template);
});

// 404 Not Found & Global Error Handler (in correct Express order)
app.use(notFound);
app.use(globalErrorHandler);

export default app;
