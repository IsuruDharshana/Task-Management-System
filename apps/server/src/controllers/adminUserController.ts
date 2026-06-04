import type { Request, Response } from "express";
import {
  createUserByAdmin,
  deactivateUserByAdmin,
  getUserByIdForAdmin,
  listUsers,
  reactivateUserByAdmin,
  resetUserPasswordByAdmin,
  updateUserByAdmin,
} from "../services/adminUserService.js";
import { AppError } from "../utils/appError.js";

function getAuthenticatedAdminId(req: Request): string {
  if (!req.user) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  }

  return req.user.id;
}

function getUserIdParam(req: Request): string {
  const { id } = req.params;

  if (typeof id !== "string" || !id) {
    throw new AppError(400, "INVALID_USER_ID", "A valid user ID is required.");
  }

  return id;
}

export async function listAdminUsers(req: Request, res: Response): Promise<void> {
  const users = await listUsers(req.query);

  res.status(200).json({
    success: true,
    data: {
      users,
    },
  });
}

export async function getAdminUser(req: Request, res: Response): Promise<void> {
  const user = await getUserByIdForAdmin(getUserIdParam(req));

  res.status(200).json({
    success: true,
    data: {
      user,
    },
  });
}

export async function createAdminUser(req: Request, res: Response): Promise<void> {
  const result = await createUserByAdmin(req.body);

  res.status(201).json({
    success: true,
    message: "User created successfully.",
    data: result,
  });
}

export async function updateAdminUser(req: Request, res: Response): Promise<void> {
  const user = await updateUserByAdmin(getUserIdParam(req), req.body);

  res.status(200).json({
    success: true,
    message: "User updated successfully.",
    data: {
      user,
    },
  });
}

export async function deactivateAdminUser(req: Request, res: Response): Promise<void> {
  const user = await deactivateUserByAdmin(getUserIdParam(req), getAuthenticatedAdminId(req));

  res.status(200).json({
    success: true,
    message: "User deactivated successfully.",
    data: {
      user,
    },
  });
}

export async function reactivateAdminUser(req: Request, res: Response): Promise<void> {
  const user = await reactivateUserByAdmin(getUserIdParam(req));

  res.status(200).json({
    success: true,
    message: "User reactivated successfully.",
    data: {
      user,
    },
  });
}

export async function resetAdminUserPassword(req: Request, res: Response): Promise<void> {
  const result = await resetUserPasswordByAdmin(getUserIdParam(req), getAuthenticatedAdminId(req));

  res.status(200).json({
    success: true,
    message: "User password reset successfully.",
    data: result,
  });
}
