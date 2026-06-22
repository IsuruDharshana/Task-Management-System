import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { emitToUser } from "../socket/socketRooms.js";
import type { AuthUser } from "../types/auth.js";
import { AppError } from "../utils/appError.js";

export type NotificationType =
  | "task_created"
  | "task_assigned"
  | "task_updated"
  | "task_status_changed"
  | "task_deleted"
  | "comment_added"
  | "attachment_uploaded"
  | "deadline_approaching"
  | "admin_update"
  | "project_updated"
  | "project_deleted"
  | "project_member_added"
  | "project_member_removed";

interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_project_id: string | null;
  related_task_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationDTO {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

export type CreateNotificationForUsersInput = Omit<CreateNotificationInput, "userId">;

interface ListNotificationsOptions {
  limit?: unknown;
}

interface DeadlineTaskRow {
  id: string;
  project_id: string;
  title: string;
  status: string;
  due_date: string | null;
}

interface DeadlineProjectRow {
  id: string;
  name: string;
}

export interface GenerateDeadlineAlertsResult {
  createdCount: number;
  notificationsCreated: NotificationDTO[];
}

const NOTIFICATION_SELECT =
  "id, user_id, type, title, message, related_project_id, related_task_id, entity_type, entity_id, metadata, read_at, created_at";
const VALID_NOTIFICATION_TYPES: readonly NotificationType[] = [
  "task_created",
  "task_assigned",
  "task_updated",
  "task_status_changed",
  "task_deleted",
  "comment_added",
  "attachment_uploaded",
  "deadline_approaching",
  "admin_update",
  "project_updated",
  "project_deleted",
  "project_member_added",
  "project_member_removed",
];

function mapNotification(row: NotificationRow): NotificationDTO {
  const metadata = row.metadata ?? {};

  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: {
      ...metadata,
      ...(row.related_project_id
        ? { projectId: metadata.projectId ?? row.related_project_id, related_project_id: row.related_project_id }
        : {}),
      ...(row.related_task_id
        ? { taskId: metadata.taskId ?? row.related_task_id, related_task_id: row.related_task_id }
        : {}),
    },
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

function validateUuid(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, "INVALID_ID", `${fieldName} is required.`);
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(value.trim())) {
    throw new AppError(400, "INVALID_ID", `${fieldName} must be a valid UUID.`);
  }

  return value.trim();
}

function validateNotificationType(type: NotificationType): NotificationType {
  if (!VALID_NOTIFICATION_TYPES.includes(type)) {
    throw new AppError(400, "INVALID_NOTIFICATION_TYPE", "Invalid notification type.");
  }

  return type;
}

function validateRequiredText(value: string, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, "INVALID_NOTIFICATION", `${fieldName} is required.`);
  }

  return value.trim();
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  return value.trim() || null;
}

function normalizeOptionalUuid(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new AppError(400, "INVALID_ID", `${fieldName} must be a valid UUID.`);
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  return validateUuid(trimmed, fieldName);
}

function getMetadataString(metadata: Record<string, unknown> | undefined, ...keys: string[]): string | null {
  if (!metadata) return null;

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getRelatedProjectId(input: CreateNotificationInput, entityType: string | null, entityId: string | null): string | null {
  const metadataProjectId = getMetadataString(input.metadata, "related_project_id", "relatedProjectId", "projectId");
  if (metadataProjectId) return normalizeOptionalUuid(metadataProjectId, "relatedProjectId");
  if (entityType === "project") return entityId;
  return null;
}

function getRelatedTaskId(input: CreateNotificationInput, entityType: string | null, entityId: string | null): string | null {
  const metadataTaskId = getMetadataString(input.metadata, "related_task_id", "relatedTaskId", "taskId");
  if (metadataTaskId) return normalizeOptionalUuid(metadataTaskId, "relatedTaskId");
  if (entityType === "task") return entityId;
  return null;
}

function logNotificationCreateFailure(
  insertPayload: Record<string, unknown>,
  error: {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  } | null
): void {
  console.error("Failed to create notification row.", {
    payload: insertPayload,
    databaseError: error
      ? {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        }
      : null,
  });
}

function normalizeLimit(value: unknown): number {
  if (value === undefined || value === null || value === "") return 20;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(400, "INVALID_LIMIT", "limit must be a positive integer.");
  }

  return Math.min(parsed, 100);
}

function getDeadlineAlertWindowHours(): number {
  const parsed = Number(process.env.DEADLINE_ALERT_WINDOW_HOURS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 48;
}

function formatDueDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function emitNotificationState(userId: string, notification: NotificationDTO): Promise<void> {
  const unreadCount = await getUnreadNotificationCount(userId);

  if (process.env.NODE_ENV === "development") {
    console.log(`Notification emitted to user:${userId} (${notification.id})`);
  }

  emitToUser(userId, "notification:new", {
    notification,
    unreadCount,
  });
  emitToUser(userId, "notification:unread-count", { unreadCount });
}

async function getAssignedTaskIds(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("task_assignees")
    .select("task_id")
    .eq("user_id", userId)
    .is("removed_at", null);

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load assigned tasks.");
  }

  return [...new Set((data ?? []).map((assignment) => assignment.task_id))];
}

async function getActiveProjectsById(projectIds: string[]): Promise<Map<string, DeadlineProjectRow>> {
  const projectsById = new Map<string, DeadlineProjectRow>();

  if (projectIds.length === 0) {
    return projectsById;
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, name")
    .in("id", projectIds)
    .is("deleted_at", null);

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load task projects.");
  }

  for (const project of (data ?? []) as DeadlineProjectRow[]) {
    projectsById.set(project.id, project);
  }

  return projectsById;
}

async function hasRecentDeadlineNotification(userId: string, taskId: string): Promise<boolean> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("id, read_at, created_at")
    .eq("user_id", userId)
    .eq("type", "deadline_approaching")
    .eq("entity_type", "task")
    .eq("entity_id", taskId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to check deadline notifications.");
  }

  return (data ?? []).some(
    (notification) => notification.read_at === null || notification.created_at >= dayAgo
  );
}

export async function createNotification(input: CreateNotificationInput): Promise<NotificationDTO> {
  const userId = validateUuid(input.userId, "userId");
  const type = validateNotificationType(input.type);
  const title = validateRequiredText(input.title, "title");
  const message = validateRequiredText(input.message, "message");
  const entityType = normalizeOptionalText(input.entityType);
  const entityId = normalizeOptionalUuid(input.entityId, "entityId");
  const relatedProjectId = getRelatedProjectId(input, entityType, entityId);
  const relatedTaskId = getRelatedTaskId(input, entityType, entityId);
  const metadata = {
    ...(input.metadata ?? {}),
    ...(relatedProjectId ? { related_project_id: relatedProjectId, projectId: relatedProjectId } : {}),
    ...(relatedTaskId ? { related_task_id: relatedTaskId, taskId: relatedTaskId } : {}),
  };
  const insertPayload = {
    user_id: userId,
    type,
    title,
    message,
    related_project_id: relatedProjectId,
    related_task_id: relatedTaskId,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  };

  if (process.env.NODE_ENV === "development") {
    console.log("Creating notification row.", { payload: insertPayload });
  }

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .insert(insertPayload)
    .select(NOTIFICATION_SELECT)
    .single();

  if (error || !data) {
    logNotificationCreateFailure(insertPayload, error);
    throw new AppError(500, "NOTIFICATION_CREATE_FAILED", "Failed to create notification.");
  }

  const notification = mapNotification(data as NotificationRow);
  try {
    await emitNotificationState(userId, notification);
  } catch (emitError) {
    console.error("Failed to emit notification state.", emitError);
  }
  return notification;
}

export async function createNotificationsForUsers(
  userIds: string[],
  input: CreateNotificationForUsersInput
): Promise<NotificationDTO[]> {
  const uniqueUserIds = [...new Set(userIds)].filter(Boolean);
  const notifications: NotificationDTO[] = [];

  for (const userId of uniqueUserIds) {
    try {
      notifications.push(await createNotification({ ...input, userId }));
    } catch (error) {
      console.error("Failed to create notification for recipient.", {
        userId,
        type: input.type,
        title: input.title,
        error,
      });
    }
  }

  return notifications;
}

export async function generateApproachingDeadlineNotificationsForUser(
  user: AuthUser
): Promise<GenerateDeadlineAlertsResult> {
  if (user.role === "admin") {
    throw new AppError(403, "FORBIDDEN", "Admin users cannot generate task deadline alerts.");
  }

  const alertWindowHours = getDeadlineAlertWindowHours();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + alertWindowHours * 60 * 60 * 1000);
  const assignedTaskIds = await getAssignedTaskIds(user.id);

  if (assignedTaskIds.length === 0) {
    return { createdCount: 0, notificationsCreated: [] };
  }

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select("id, project_id, title, status, due_date")
    .in("id", assignedTaskIds)
    .is("deleted_at", null)
    .neq("status", "completed")
    .not("due_date", "is", null)
    .gte("due_date", now.toISOString())
    .lte("due_date", windowEnd.toISOString());

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load approaching deadlines.");
  }

  const dueSoonTasks = (data ?? []) as DeadlineTaskRow[];
  const projectsById = await getActiveProjectsById([
    ...new Set(dueSoonTasks.map((task) => task.project_id)),
  ]);
  const notificationsCreated: NotificationDTO[] = [];

  for (const task of dueSoonTasks) {
    const project = projectsById.get(task.project_id);
    if (!project || !task.due_date) continue;

    const hasDuplicate = await hasRecentDeadlineNotification(user.id, task.id);
    if (hasDuplicate) continue;

    const notification = await createNotification({
      userId: user.id,
      type: "deadline_approaching",
      title: "Task deadline approaching",
      message: `"${task.title}" is due on ${formatDueDate(task.due_date)}.`,
      entityType: "task",
      entityId: task.id,
      metadata: {
        taskId: task.id,
        related_task_id: task.id,
        taskTitle: task.title,
        projectId: task.project_id,
        related_project_id: task.project_id,
        projectName: project.name,
        dueDate: task.due_date,
        alertWindowHours,
      },
    });

    notificationsCreated.push(notification);
  }

  if (notificationsCreated.length > 0) {
    emitToUser(user.id, "dashboard:summary-updated", {
      eventType: "deadline_alerts_generated",
      createdCount: notificationsCreated.length,
    });
  }

  return {
    createdCount: notificationsCreated.length,
    notificationsCreated,
  };
}

export async function listNotificationsForUser(
  userId: string,
  options: ListNotificationsOptions
): Promise<NotificationDTO[]> {
  const limit = normalizeLimit(options.limit);

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load notifications.");
  }

  return ((data ?? []) as NotificationRow[]).map(mapNotification);
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load unread notification count.");
  }

  return count ?? 0;
}

export async function markNotificationAsRead(
  userId: string,
  notificationId: unknown
): Promise<NotificationDTO> {
  const id = validateUuid(notificationId, "notificationId");

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select(NOTIFICATION_SELECT)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "NOTIFICATION_UPDATE_FAILED", "Failed to mark notification as read.");
  }

  if (!data) {
    throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found.");
  }

  const notification = mapNotification(data as NotificationRow);
  const unreadCount = await getUnreadNotificationCount(userId);

  emitToUser(userId, "notification:read", { notification, unreadCount });
  emitToUser(userId, "notification:unread-count", { unreadCount });

  return notification;
}

export async function markAllNotificationsAsRead(userId: string): Promise<number> {
  const readAt = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .update({ read_at: readAt })
    .eq("user_id", userId)
    .is("read_at", null)
    .select("id");

  if (error) {
    throw new AppError(500, "NOTIFICATION_UPDATE_FAILED", "Failed to mark notifications as read.");
  }

  const updatedCount = data?.length ?? 0;
  emitToUser(userId, "notification:read-all", { readAt, updatedCount, unreadCount: 0 });
  emitToUser(userId, "notification:unread-count", { unreadCount: 0 });

  return updatedCount;
}
