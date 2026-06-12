import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { supabase } from "./config/supabase.js";
import activityLogRoutes from "./routes/activityLogRoutes.js";
import adminUserRoutes from "./routes/adminUserRoutes.js";
import attachmentRoutes from "./routes/attachmentRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Veyra API is running",
  });
});

app.get("/api/health/db", async (_req, res) => {
  const { error } = await supabase
    .from("app_users")
    .select("id", { count: "exact", head: true });

  if (error) {
    return res.status(500).json({
      status: "error",
      message: "Database connection failed",
      details: error.message,
    });
  }

  return res.status(200).json({
    status: "ok",
    message: "Database connection successful",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/activity-logs", activityLogRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/attachments", attachmentRoutes);
app.use("/api/notifications", notificationRoutes);

app.use(errorHandler);

export default app;
