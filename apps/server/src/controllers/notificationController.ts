import type { Request, Response } from "express";
import {
  generateApproachingDeadlineNotificationsForUser,
  getUnreadNotificationCount,
  listNotificationsForUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../services/notificationService.js";
import { AppError } from "../utils/appError.js";

function getAuthenticatedUserId(req: Request): string {
  if (!req.user) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  }

  return req.user.id;
}

function getAuthenticatedUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  }

  return req.user;
}

export async function handleListNotifications(req: Request, res: Response): Promise<void> {
  const userId = getAuthenticatedUserId(req);
  const notifications = await listNotificationsForUser(userId, req.query);

  res.status(200).json({
    success: true,
    data: { notifications },
  });
}

export async function handleGetUnreadNotificationCount(req: Request, res: Response): Promise<void> {
  const userId = getAuthenticatedUserId(req);
  const unreadCount = await getUnreadNotificationCount(userId);

  res.status(200).json({
    success: true,
    data: { unreadCount },
  });
}

export async function handleGenerateDeadlineAlerts(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const result = await generateApproachingDeadlineNotificationsForUser(user);

  res.status(200).json({
    success: true,
    data: result,
  });
}

export async function handleMarkNotificationAsRead(req: Request, res: Response): Promise<void> {
  const userId = getAuthenticatedUserId(req);
  const notification = await markNotificationAsRead(userId, req.params.id);

  res.status(200).json({
    success: true,
    message: "Notification marked as read.",
    data: { notification },
  });
}

export async function handleMarkAllNotificationsAsRead(req: Request, res: Response): Promise<void> {
  const userId = getAuthenticatedUserId(req);
  const updatedCount = await markAllNotificationsAsRead(userId);

  res.status(200).json({
    success: true,
    message: "Notifications marked as read.",
    data: { updatedCount },
  });
}
