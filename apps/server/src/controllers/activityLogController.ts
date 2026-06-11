import type { Request, Response } from "express";
import { listVisibleActivityLogs } from "../services/activityLogService.js";
import { AppError } from "../utils/appError.js";

function getAuthenticatedUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  }

  return req.user;
}

export async function handleListActivityLogs(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const logs = await listVisibleActivityLogs(user, req.query);

  res.status(200).json({
    success: true,
    data: { logs },
  });
}
