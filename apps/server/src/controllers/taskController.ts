import type { Request, Response } from "express";
import {
  addTaskAssignee,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  removeTaskAssignee,
  updateTask,
  validateUuid,
} from "../services/taskService.js";
import { AppError } from "../utils/appError.js";

function getAuthenticatedUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  }

  return req.user;
}

function getProjectIdParam(req: Request): string {
  return validateUuid(req.params.projectId, "projectId");
}

function getTaskIdParam(req: Request): string {
  return validateUuid(req.params.taskId, "taskId");
}

function getUserIdParam(req: Request): string {
  return validateUuid(req.params.userId, "userId");
}

export async function handleListTasks(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const projectId = getProjectIdParam(req);
  const tasks = await listTasks(projectId, req.query, user);

  res.status(200).json({
    success: true,
    data: { tasks },
  });
}

export async function handleCreateTask(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const projectId = getProjectIdParam(req);
  const task = await createTask(projectId, req.body, user);

  res.status(201).json({
    success: true,
    message: "Task created successfully.",
    data: { task },
  });
}

export async function handleGetTask(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const taskId = getTaskIdParam(req);
  const task = await getTask(taskId, user);

  res.status(200).json({
    success: true,
    data: { task },
  });
}

export async function handleUpdateTask(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const taskId = getTaskIdParam(req);
  const task = await updateTask(taskId, req.body, user);

  res.status(200).json({
    success: true,
    message: "Task updated successfully.",
    data: { task },
  });
}

export async function handleDeleteTask(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const taskId = getTaskIdParam(req);
  await deleteTask(taskId, req.body, user);

  res.status(200).json({
    success: true,
    message: "Task deleted successfully.",
  });
}

export async function handleAddTaskAssignee(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const taskId = getTaskIdParam(req);
  const assignee = await addTaskAssignee(taskId, req.body, user);

  res.status(201).json({
    success: true,
    message: "Task assignee added successfully.",
    data: { assignee },
  });
}

export async function handleRemoveTaskAssignee(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const taskId = getTaskIdParam(req);
  const userId = getUserIdParam(req);
  await removeTaskAssignee(taskId, userId, req.body, user);

  res.status(200).json({
    success: true,
    message: "Task assignee removed successfully.",
  });
}
