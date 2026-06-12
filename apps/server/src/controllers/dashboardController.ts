import type { Request, Response } from "express";
import { getDashboardSummary } from "../services/dashboardService.js";
import { AppError } from "../utils/appError.js";

function getAuthenticatedUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  }

  return req.user;
}

export async function handleGetDashboardSummary(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const summary = await getDashboardSummary(user);

  res.status(200).json({
    success: true,
    data: { summary },
  });
}
