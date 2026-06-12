import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { emitToUser } from "../socket/socketRooms.js";
import { AppError } from "../utils/appError.js";

export type NotificationType =
  | "task_assigned"
  | "task_updated"
  | "task_status_changed"
  | "comment_added"
  | "deadline_approaching"
  | "admin_update"
  | "project_updated";

interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
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

const NOTIFICATION_SELECT =
  "id, user_id, type, title, message, entity_type, entity_id, metadata, read_at, created_at";
const VALID_NOTIFICATION_TYPES: readonly NotificationType[] = [
  "task_assigned",
  "task_updated",
  "task_status_changed",
  "comment_added",
  "deadline_approaching",
  "admin_update",
  "project_updated",
];

function mapNotification(row: NotificationRow): NotificationDTO {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata ?? {},
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

function normalizeLimit(value: unknown): number {
  if (value === undefined || value === null || value === "") return 20;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(400, "INVALID_LIMIT", "limit must be a positive integer.");
  }

  return Math.min(parsed, 100);
}

async function emitNotificationState(userId: string, notification: NotificationDTO): Promise<void> {
  const unreadCount = await getUnreadNotificationCount(userId);

  emitToUser(userId, "notification:new", {
    notification,
    unreadCount,
  });
  emitToUser(userId, "notification:unread-count", { unreadCount });
}

export async function createNotification(input: CreateNotificationInput): Promise<NotificationDTO> {
  const userId = validateUuid(input.userId, "userId");
  const type = validateNotificationType(input.type);
  const title = validateRequiredText(input.title, "title");
  const message = validateRequiredText(input.message, "message");
  const entityType = normalizeOptionalText(input.entityType);
  const entityId = input.entityId ? validateUuid(input.entityId, "entityId") : null;

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .insert({
      user_id: userId,
      type,
      title,
      message,
      entity_type: entityType,
      entity_id: entityId,
      metadata: input.metadata ?? {},
    })
    .select(NOTIFICATION_SELECT)
    .single();

  if (error || !data) {
    throw new AppError(500, "NOTIFICATION_CREATE_FAILED", "Failed to create notification.");
  }

  const notification = mapNotification(data as NotificationRow);
  await emitNotificationState(userId, notification);
  return notification;
}

export async function createNotificationsForUsers(
  userIds: string[],
  input: CreateNotificationForUsersInput
): Promise<NotificationDTO[]> {
  const uniqueUserIds = [...new Set(userIds)].filter(Boolean);
  const notifications: NotificationDTO[] = [];

  for (const userId of uniqueUserIds) {
    notifications.push(await createNotification({ ...input, userId }));
  }

  return notifications;
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
