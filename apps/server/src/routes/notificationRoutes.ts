import { Router } from "express";
import {
  handleGenerateDeadlineAlerts,
  handleGetUnreadNotificationCount,
  handleListNotifications,
  handleMarkAllNotificationsAsRead,
  handleMarkNotificationAsRead,
} from "../controllers/notificationController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireAuth);
router.get("/", asyncHandler(handleListNotifications));
router.get("/unread-count", asyncHandler(handleGetUnreadNotificationCount));
router.post("/generate-deadline-alerts", asyncHandler(handleGenerateDeadlineAlerts));
router.patch("/read-all", asyncHandler(handleMarkAllNotificationsAsRead));
router.patch("/:id/read", asyncHandler(handleMarkNotificationAsRead));

export default router;
