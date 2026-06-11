import type { Request, Response } from "express";
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  listMembers,
  listEligibleMembers,
  addMember,
  updateMember,
  removeMember,
} from "../services/projectService.js";
import { AppError } from "../utils/appError.js";

// Helpers

function getAuthenticatedUser(req: Request) {
  if (!req.user) {
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  }

  return req.user;
}

function getProjectIdParam(req: Request): string {
  const { projectId } = req.params;

  if (typeof projectId !== "string" || !projectId) {
    throw new AppError(400, "INVALID_PROJECT_ID", "A valid project ID is required.");
  }

  return projectId;
}

function getMemberIdParam(req: Request): string {
  const { memberId } = req.params;

  if (typeof memberId !== "string" || !memberId) {
    throw new AppError(400, "INVALID_MEMBER_ID", "A valid member ID is required.");
  }

  return memberId;
}

// Project controllers

export async function handleCreateProject(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const project = await createProject(req.body, user);

  res.status(201).json({
    success: true,
    message: "Project created successfully.",
    data: { project },
  });
}

export async function handleListProjects(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const projects = await listProjects(user);

  res.status(200).json({
    success: true,
    data: { projects },
  });
}

export async function handleGetProject(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const projectId = getProjectIdParam(req);
  const project = await getProject(projectId, user);

  res.status(200).json({
    success: true,
    data: { project },
  });
}

export async function handleUpdateProject(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const projectId = getProjectIdParam(req);
  const project = await updateProject(projectId, req.body, user);

  res.status(200).json({
    success: true,
    message: "Project updated successfully.",
    data: { project },
  });
}

export async function handleDeleteProject(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const projectId = getProjectIdParam(req);
  await deleteProject(projectId, req.body, user);

  res.status(200).json({
    success: true,
    message: "Project deleted successfully.",
  });
}

// Member controllers

export async function handleListMembers(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const projectId = getProjectIdParam(req);
  const members = await listMembers(projectId, user);

  res.status(200).json({
    success: true,
    data: { members },
  });
}

export async function handleListEligibleMembers(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const projectId = getProjectIdParam(req);
  const users = await listEligibleMembers(projectId, user);

  res.status(200).json({
    success: true,
    data: { users },
  });
}

export async function handleAddMember(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const projectId = getProjectIdParam(req);
  const member = await addMember(projectId, req.body, user);

  res.status(201).json({
    success: true,
    message: "Member added successfully.",
    data: { member },
  });
}

export async function handleUpdateMember(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const projectId = getProjectIdParam(req);
  const memberId = getMemberIdParam(req);
  const member = await updateMember(projectId, memberId, req.body, user);

  res.status(200).json({
    success: true,
    message: "Member updated successfully.",
    data: { member },
  });
}

export async function handleRemoveMember(req: Request, res: Response): Promise<void> {
  const user = getAuthenticatedUser(req);
  const projectId = getProjectIdParam(req);
  const memberId = getMemberIdParam(req);
  await removeMember(projectId, memberId, req.body, user);

  res.status(200).json({
    success: true,
    message: "Member removed successfully.",
  });
}
