import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/appError.js";
import type { UserRole } from "../types/auth.js";

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, "UNAUTHENTICATED", "Authentication is required."));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action."));
    }

    next();
  };
}
