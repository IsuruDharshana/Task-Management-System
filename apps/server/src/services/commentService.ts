import { supabaseAdmin } from "../config/supabaseAdmin.js";
import type { AuthUser } from "../types/auth.js";
import { AppError } from "../utils/appError.js";
import { validateUuid } from "./taskService.js";
import { logActivity } from "./activityLogService.js";
import { notifyCommentAdded } from "./realtimeEventService.js";

interface TaskRow {
  id: string;
  project_id: string;
  title: string;
  deleted_at: string | null;
}

interface ProjectRow {
  id: string;
  name: string;
  created_by: string;
  deleted_at: string | null;
}

interface CommentRow {
  id: string;
  task_id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_reason: string | null;
  user: { id: string; name: string } | null;
}

export interface TaskCommentDTO {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  commentText: string;
  createdAt: string;
  updatedAt: string;
}

interface CommentTextInput {
  commentText?: unknown;
}

interface DeleteCommentInput {
  reason?: unknown;
}

const COMMENT_SELECT =
  "id, task_id, user_id, comment_text, created_at, updated_at, deleted_at, deleted_by, deleted_reason, user:app_users!user_id(id, name)";
const COMMENT_MAX_LENGTH = 2000;

function mapComment(row: CommentRow): TaskCommentDTO {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    userName: row.user?.name ?? "",
    commentText: row.comment_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requireNonAdmin(user: AuthUser): void {
  if (user.role === "admin") {
    throw new AppError(403, "FORBIDDEN", "Admin users cannot access task comments.");
  }
}

function validateCommentText(value: unknown): string {
  if (typeof value !== "string") {
    throw new AppError(400, "INVALID_COMMENT", "commentText is required.");
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new AppError(400, "INVALID_COMMENT", "commentText cannot be empty.");
  }

  if (trimmed.length > COMMENT_MAX_LENGTH) {
    throw new AppError(
      400,
      "INVALID_COMMENT",
      `commentText must not exceed ${COMMENT_MAX_LENGTH} characters.`
    );
  }

  return trimmed;
}

function getReason(input: DeleteCommentInput): string | null {
  return typeof input.reason === "string" ? input.reason.trim() || null : null;
}

async function getActiveTask(taskId: string): Promise<TaskRow> {
  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select("id, project_id, title, deleted_at")
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load task.");
  }

  if (!data) {
    throw new AppError(404, "TASK_NOT_FOUND", "Task not found.");
  }

  return data as TaskRow;
}

async function getActiveProject(projectId: string): Promise<ProjectRow> {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, name, created_by, deleted_at")
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load project.");
  }

  if (!data) {
    throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found.");
  }

  return data as ProjectRow;
}

async function getActiveComment(commentId: string): Promise<CommentRow> {
  const { data, error } = await supabaseAdmin
    .from("task_comments")
    .select(COMMENT_SELECT)
    .eq("id", commentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load comment.");
  }

  if (!data) {
    throw new AppError(404, "COMMENT_NOT_FOUND", "Comment not found.");
  }

  return data as unknown as CommentRow;
}

async function isActiveProjectMember(projectId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .is("removed_at", null)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to check project membership.");
  }

  return !!data;
}

async function requireActiveProjectMembership(projectId: string, userId: string): Promise<void> {
  const isMember = await isActiveProjectMember(projectId, userId);

  if (!isMember) {
    throw new AppError(403, "FORBIDDEN", "You are not an active member of this project.");
  }
}

async function isProjectManagerForProject(projectId: string, userId: string): Promise<boolean> {
  await getActiveProject(projectId);

  const { data, error } = await supabaseAdmin
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("project_role", "project_manager")
    .is("removed_at", null)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to check project manager status.");
  }

  return !!data;
}

async function getCommentProjectId(comment: CommentRow): Promise<string> {
  const task = await getActiveTask(comment.task_id);
  return task.project_id;
}

export async function listTaskComments(taskId: string, user: AuthUser): Promise<TaskCommentDTO[]> {
  requireNonAdmin(user);
  const task = await getActiveTask(taskId);
  await requireActiveProjectMembership(task.project_id, user.id);

  const { data, error } = await supabaseAdmin
    .from("task_comments")
    .select(COMMENT_SELECT)
    .eq("task_id", task.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load task comments.");
  }

  return ((data ?? []) as unknown as CommentRow[]).map(mapComment);
}

export async function createTaskComment(
  taskId: string,
  input: CommentTextInput,
  user: AuthUser
): Promise<TaskCommentDTO> {
  requireNonAdmin(user);
  const task = await getActiveTask(taskId);
  await requireActiveProjectMembership(task.project_id, user.id);

  const commentText = validateCommentText(input.commentText);

  const { data, error } = await supabaseAdmin
    .from("task_comments")
    .insert({
      task_id: task.id,
      user_id: user.id,
      comment_text: commentText,
    })
    .select(COMMENT_SELECT)
    .single();

  if (error || !data) {
    throw new AppError(500, "COMMENT_CREATE_FAILED", "Failed to create comment.");
  }

  const comment = mapComment(data as unknown as CommentRow);
  const project = await getActiveProject(task.project_id);
  await logActivity({
    actorUserId: user.id,
    action: "task_comment_added",
    entityType: "comment",
    entityId: comment.id,
    metadata: {
      projectId: task.project_id,
      projectName: project.name,
      taskId: task.id,
      taskTitle: task.title,
      commentId: comment.id,
    },
  });

  await notifyCommentAdded({
    taskId: task.id,
    taskTitle: task.title,
    projectId: task.project_id,
    projectName: project.name,
    commentId: comment.id,
    actorUserId: user.id,
    actorName: user.name,
  });

  return comment;
}

export async function updateTaskComment(
  commentId: string,
  input: CommentTextInput,
  user: AuthUser
): Promise<TaskCommentDTO> {
  requireNonAdmin(user);
  const comment = await getActiveComment(commentId);
  const task = await getActiveTask(comment.task_id);
  const projectId = task.project_id;
  const project = await getActiveProject(projectId);
  await requireActiveProjectMembership(projectId, user.id);

  if (comment.user_id !== user.id) {
    throw new AppError(403, "FORBIDDEN", "You can edit only your own comments.");
  }

  const commentText = validateCommentText(input.commentText);

  const { data, error } = await supabaseAdmin
    .from("task_comments")
    .update({
      comment_text: commentText,
      updated_at: new Date().toISOString(),
    })
    .eq("id", comment.id)
    .is("deleted_at", null)
    .select(COMMENT_SELECT)
    .single();

  if (error || !data) {
    throw new AppError(500, "COMMENT_UPDATE_FAILED", "Failed to update comment.");
  }

  const updatedComment = mapComment(data as unknown as CommentRow);
  await logActivity({
    actorUserId: user.id,
    action: "task_comment_updated",
    entityType: "comment",
    entityId: comment.id,
    metadata: {
      projectId,
      projectName: project.name,
      taskId: comment.task_id,
      taskTitle: task.title,
      commentId: comment.id,
    },
  });

  return updatedComment;
}

export async function deleteTaskComment(
  commentId: string,
  input: DeleteCommentInput,
  user: AuthUser
): Promise<void> {
  requireNonAdmin(user);
  const comment = await getActiveComment(commentId);
  const task = await getActiveTask(comment.task_id);
  const projectId = task.project_id;
  const project = await getActiveProject(projectId);
  await requireActiveProjectMembership(projectId, user.id);

  const isOwnComment = comment.user_id === user.id;
  const canManageProject = await isProjectManagerForProject(projectId, user.id);

  if (!isOwnComment && !canManageProject) {
    throw new AppError(403, "FORBIDDEN", "You can delete only your own comments.");
  }

  const { error } = await supabaseAdmin
    .from("task_comments")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
      deleted_reason: getReason(input),
    })
    .eq("id", comment.id)
    .is("deleted_at", null);

  if (error) {
    throw new AppError(500, "COMMENT_DELETE_FAILED", "Failed to delete comment.");
  }

  await logActivity({
    actorUserId: user.id,
    action: "task_comment_deleted",
    entityType: "comment",
    entityId: comment.id,
    metadata: {
      projectId,
      projectName: project.name,
      taskId: comment.task_id,
      taskTitle: task.title,
      commentId: comment.id,
    },
  });
}

export { validateUuid };
