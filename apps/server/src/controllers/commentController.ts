import type { Request, Response } from "express";
import {
  createTaskComment,
  deleteTaskComment,
  listTaskComments,
  updateTaskComment,
  validateUuid,
} from "../services/commentService.js";
import { AppError } from "../utils/appError.js";

function getAuthenticatedUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  }

  return req.user;
}

function getTaskIdParam(req: Request): string {
  return validateUuid(req.params.taskId, "taskId");
}

function getCommentIdParam(req: Request): string {
  return validateUuid(req.params.commentId, "commentId");
}

export async function handleListTaskComments(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const taskId = getTaskIdParam(req);
  const comments = await listTaskComments(taskId, user);

  res.status(200).json({
    success: true,
    data: { comments },
  });
}

export async function handleCreateTaskComment(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const taskId = getTaskIdParam(req);
  const comment = await createTaskComment(taskId, req.body, user);

  res.status(201).json({
    success: true,
    message: "Comment created successfully.",
    data: { comment },
  });
}

export async function handleUpdateTaskComment(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const commentId = getCommentIdParam(req);
  const comment = await updateTaskComment(commentId, req.body, user);

  res.status(200).json({
    success: true,
    message: "Comment updated successfully.",
    data: { comment },
  });
}

export async function handleDeleteTaskComment(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const commentId = getCommentIdParam(req);
  await deleteTaskComment(commentId, req.body, user);

  res.status(200).json({
    success: true,
    message: "Comment deleted successfully.",
  });
}
