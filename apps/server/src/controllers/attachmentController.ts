import type { Request, Response } from "express";
import {
  createAttachmentDownloadUrl,
  createTaskAttachment,
  deleteTaskAttachment,
  listTaskAttachments,
  validateUuid,
} from "../services/attachmentService.js";
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

function getAttachmentIdParam(req: Request): string {
  return validateUuid(req.params.attachmentId, "attachmentId");
}

export async function handleListTaskAttachments(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const taskId = getTaskIdParam(req);
  const attachments = await listTaskAttachments(taskId, user);

  res.status(200).json({
    success: true,
    data: { attachments },
  });
}

export async function handleCreateTaskAttachment(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const taskId = getTaskIdParam(req);
  const attachment = await createTaskAttachment(taskId, req.file, user, req.body);

  res.status(201).json({
    success: true,
    message: "Attachment uploaded successfully.",
    data: { attachment },
  });
}

export async function handleCreateAttachmentDownloadUrl(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const attachmentId = getAttachmentIdParam(req);
  const data = await createAttachmentDownloadUrl(attachmentId, user);

  res.status(200).json({
    success: true,
    data,
  });
}

export async function handleDeleteTaskAttachment(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const attachmentId = getAttachmentIdParam(req);
  await deleteTaskAttachment(attachmentId, req.body, user);

  res.status(200).json({
    success: true,
    message: "Attachment deleted successfully.",
  });
}
