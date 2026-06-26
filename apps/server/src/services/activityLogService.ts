import { supabaseAdmin } from "../config/supabaseAdmin.js";
import type { AuthUser } from "../types/auth.js";
import { AppError } from "../utils/appError.js";

interface ActivityLogRow {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor: { id: string; name: string } | null;
}

interface ProjectLookupRow {
  id: string;
  name: string;
}

interface ProjectIdRow {
  id: string;
}

interface TaskLookupRow {
  id: string;
  title: string;
}

interface AttachmentLookupRow {
  id: string;
  file_name: string;
}

interface UserLookupRow {
  id: string;
  name: string;
  role: string;
}

export interface ActivityLogDTO {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface LogActivityInput {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata?: Record<string, unknown>;
}

interface ListActivityLogFilters {
  entityType?: unknown;
  entityId?: unknown;
  action?: unknown;
  projectId?: unknown;
  userId?: unknown;
  limit?: unknown;
}

const ACTIVITY_SELECT =
  "id, actor_user_id, action, entity_type, entity_id, metadata, created_at, actor:app_users!actor_user_id(id, name)";
const ADMIN_ENTITY_TYPES = ["user", "system"];
const PROJECT_ENTITY_TYPES = ["project", "task", "comment", "attachment"];

function mapLog(row: ActivityLogRow): ActivityLogDTO {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    actorName: row.actor?.name ?? null,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeLimit(value: unknown): number {
  if (value === undefined || value === null || value === "") return 50;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(400, "INVALID_LIMIT", "limit must be a positive integer.");
  }

  return Math.min(parsed, 100);
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

function metadataProjectId(metadata: Record<string, unknown> | null): string | null {
  const projectId = metadata?.projectId;
  return typeof projectId === "string" ? projectId : null;
}

function metadataString(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function addMetadataValue(
  metadata: Record<string, unknown>,
  key: string,
  value: string | undefined
): void {
  if (!metadata[key]) {
    metadata[key] = value;
  }
}

async function enrichVisibleRows(rows: ActivityLogRow[]): Promise<ActivityLogRow[]> {
  const projectIds = new Set<string>();
  const taskIds = new Set<string>();
  const attachmentIds = new Set<string>();
  const userIds = new Set<string>();

  for (const row of rows) {
    const metadata = row.metadata ?? {};
    const projectId = metadataString(metadata, "projectId");
    const taskId = metadataString(metadata, "taskId");
    const attachmentId = metadataString(metadata, "attachmentId");
    const targetUserId = metadataString(metadata, "targetUserId");
    const assigneeId = metadataString(metadata, "assigneeId");

    if (projectId) projectIds.add(projectId);
    if (taskId) taskIds.add(taskId);
    if (attachmentId) attachmentIds.add(attachmentId);
    if (targetUserId) userIds.add(targetUserId);
    if (assigneeId) userIds.add(assigneeId);
  }

  const projectNames = new Map<string, string>();
  const taskTitles = new Map<string, string>();
  const attachmentFileNames = new Map<string, string>();
  const users = new Map<string, UserLookupRow>();

  if (projectIds.size > 0) {
    const { data, error } = await supabaseAdmin
      .from("projects")
      .select("id, name")
      .in("id", [...projectIds]);

    if (error) {
      console.error("Failed to enrich activity project metadata.", error);
    } else {
      for (const project of (data ?? []) as ProjectLookupRow[]) {
        projectNames.set(project.id, project.name);
      }
    }
  }

  if (taskIds.size > 0) {
    const { data, error } = await supabaseAdmin
      .from("tasks")
      .select("id, title")
      .in("id", [...taskIds]);

    if (error) {
      console.error("Failed to enrich activity task metadata.", error);
    } else {
      for (const task of (data ?? []) as TaskLookupRow[]) {
        taskTitles.set(task.id, task.title);
      }
    }
  }

  if (attachmentIds.size > 0) {
    const { data, error } = await supabaseAdmin
      .from("task_attachments")
      .select("id, file_name")
      .in("id", [...attachmentIds]);

    if (error) {
      console.error("Failed to enrich activity attachment metadata.", error);
    } else {
      for (const attachment of (data ?? []) as AttachmentLookupRow[]) {
        attachmentFileNames.set(attachment.id, attachment.file_name);
      }
    }
  }

  if (userIds.size > 0) {
    const { data, error } = await supabaseAdmin
      .from("app_users")
      .select("id, name, role")
      .in("id", [...userIds]);

    if (error) {
      console.error("Failed to enrich activity user metadata.", error);
    } else {
      for (const user of (data ?? []) as UserLookupRow[]) {
        users.set(user.id, user);
      }
    }
  }

  return rows.map((row) => {
    const metadata = { ...(row.metadata ?? {}) };
    const projectId = metadataString(metadata, "projectId");
    const taskId = metadataString(metadata, "taskId");
    const attachmentId = metadataString(metadata, "attachmentId");
    const targetUserId = metadataString(metadata, "targetUserId");
    const assigneeId = metadataString(metadata, "assigneeId");

    if (projectId) {
      addMetadataValue(metadata, "projectName", projectNames.get(projectId) ?? "Unknown project");
    }

    if (taskId) {
      addMetadataValue(metadata, "taskTitle", taskTitles.get(taskId) ?? "Unknown task");
    }

    if (attachmentId) {
      addMetadataValue(metadata, "fileName", attachmentFileNames.get(attachmentId) ?? "Unknown file");
    }

    if (targetUserId) {
      const targetUser = users.get(targetUserId);
      addMetadataValue(metadata, "targetUserName", targetUser?.name ?? "Unknown user");
      addMetadataValue(metadata, "targetUserRole", targetUser?.role ?? "unknown");
    }

    if (assigneeId) {
      addMetadataValue(metadata, "assigneeName", users.get(assigneeId)?.name ?? "Unknown user");
    }

    return { ...row, metadata };
  });
}

async function getVisibleProjectIds(user: AuthUser): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("project_members")
    .select("project_id")
    .eq("user_id", user.id)
    .is("removed_at", null);

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load visible projects.");
  }

  const projectIds = [...new Set((data ?? []).map((membership) => membership.project_id))];

  if (projectIds.length === 0) {
    return [];
  }

  const { data: activeProjects, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("id")
    .in("id", projectIds)
    .is("deleted_at", null);

  if (projectError) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load visible projects.");
  }

  return ((activeProjects ?? []) as ProjectIdRow[]).map((project) => project.id);
}

function canSeeLog(row: ActivityLogRow, user: AuthUser, visibleProjectIds: Set<string>): boolean {
  if (row.entity_type === "account" && row.entity_id === user.id) {
    return true;
  }

  if (user.role === "admin") {
    return ADMIN_ENTITY_TYPES.includes(row.entity_type);
  }

  if (PROJECT_ENTITY_TYPES.includes(row.entity_type)) {
    const projectId = metadataProjectId(row.metadata);
    return !!projectId && visibleProjectIds.has(projectId);
  }

  return false;
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  const { error } = await supabaseAdmin.from("activity_logs").insert({
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error("Failed to write activity log.", error);
  }
}

export async function listVisibleActivityLogs(
  user: AuthUser,
  filters: ListActivityLogFilters
): Promise<ActivityLogDTO[]> {
  const limit = normalizeLimit(filters.limit);
  const entityType = normalizeString(filters.entityType);
  const action = normalizeString(filters.action);
  const projectId = filters.projectId ? validateUuid(filters.projectId, "projectId") : undefined;
  const entityId = filters.entityId ? validateUuid(filters.entityId, "entityId") : undefined;
  const userId = filters.userId ? validateUuid(filters.userId, "userId") : undefined;

  if (userId && user.role !== "admin" && userId !== user.id) {
    throw new AppError(403, "FORBIDDEN", "You can only filter by your own user ID.");
  }

  const visibleProjectIds = user.role === "admin" ? [] : await getVisibleProjectIds(user);
  const visibleProjectIdSet = new Set(visibleProjectIds);

  if (projectId && user.role !== "admin" && !visibleProjectIdSet.has(projectId)) {
    throw new AppError(403, "FORBIDDEN", "You cannot view activity for this project.");
  }

  let query = supabaseAdmin
    .from("activity_logs")
    .select(ACTIVITY_SELECT)
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 5, 100));

  if (entityType) query = query.eq("entity_type", entityType);
  if (action) query = query.eq("action", action);
  if (entityId) query = query.eq("entity_id", entityId);
  if (userId) query = query.eq("actor_user_id", userId);

  const { data, error } = await query;

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load activity logs.");
  }

  const visibleRows = ((data ?? []) as unknown as ActivityLogRow[])
    .filter((row) => {
      if (projectId && metadataProjectId(row.metadata) !== projectId) return false;
      return canSeeLog(row, user, visibleProjectIdSet);
    })
    .slice(0, limit);

  const enrichedRows = await enrichVisibleRows(visibleRows);
  return enrichedRows.map(mapLog);
}
