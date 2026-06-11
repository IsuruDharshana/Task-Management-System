import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { supabaseAdmin } from "../config/supabaseAdmin.js";
import type { AuthUser } from "../types/auth.js";
import { AppError } from "../utils/appError.js";
import { validateUuid } from "./taskService.js";

interface TaskRow {
  id: string;
  project_id: string;
  deleted_at: string | null;
}

interface AttachmentRow {
  id: string;
  task_id: string;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  deleted_at: string | null;
  user: { id: string; name: string } | null;
}

interface AttachmentRecord {
  id: string;
  task_id: string;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  deleted_at: string | null;
}

export interface TaskAttachmentDTO {
  id: string;
  taskId: string;
  uploadedBy: string;
  uploadedByName: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  createdAt: string;
}

interface UploadFileInput {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

interface DeleteAttachmentInput {
  reason?: unknown;
}

interface AttachmentDisplayNameInput {
  displayName?: unknown;
  customFileName?: unknown;
}

const ATTACHMENT_SELECT =
  "id, task_id, uploaded_by, file_name, file_path, file_type, file_size, created_at, deleted_at, user:app_users!uploaded_by(id, name)";
const ATTACHMENT_RECORD_SELECT =
  "id, task_id, uploaded_by, file_name, file_path, file_type, file_size, created_at, deleted_at";

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
]);
const DISPLAY_NAME_MAX_LENGTH = 120;

function mapAttachment(row: AttachmentRow): TaskAttachmentDTO {
  return {
    id: row.id,
    taskId: row.task_id,
    uploadedBy: row.uploaded_by,
    uploadedByName: row.user?.name ?? "",
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
  };
}

function requireNonAdmin(user: AuthUser): void {
  if (user.role === "admin") {
    throw new AppError(403, "FORBIDDEN", "Admin users cannot access task attachments.");
  }
}

function sanitizeFileName(fileName: string): string {
  const baseName = fileName.split(/[\\/]/).pop()?.trim() || "attachment";
  const safeName = baseName
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/\.+/g, ".")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);

  return safeName || "attachment";
}

function getOriginalFileExtension(fileName: string): string {
  const baseName = fileName.split(/[\\/]/).pop()?.trim() || "";
  const dotIndex = baseName.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === baseName.length - 1) {
    return "";
  }

  return sanitizeFileName(baseName.slice(dotIndex));
}

function sanitizeDisplayName(value: string): string {
  const safeName = value
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/\.+/g, ".")
    .replace(/^-+|-+$/g, "")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, DISPLAY_NAME_MAX_LENGTH);

  return safeName || "attachment";
}

function getSafeFileName(file: UploadFileInput, input?: AttachmentDisplayNameInput): string {
  const customName =
    input?.displayName !== undefined && input.displayName !== ""
      ? input.displayName
      : input?.customFileName;

  if (customName === undefined || customName === null || customName === "") {
    return sanitizeFileName(file.originalname);
  }

  if (typeof customName !== "string") {
    throw new AppError(400, "INVALID_ATTACHMENT_NAME", "Attachment name must be a string.");
  }

  const trimmed = customName.trim();

  if (!trimmed) {
    return sanitizeFileName(file.originalname);
  }

  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new AppError(
      400,
      "INVALID_ATTACHMENT_NAME",
      `Attachment name must not exceed ${DISPLAY_NAME_MAX_LENGTH} characters.`
    );
  }

  const extension = getOriginalFileExtension(file.originalname);
  const safeDisplayName = sanitizeDisplayName(trimmed);
  const safeFileName = `${safeDisplayName}${extension}`;

  return safeFileName.slice(0, 160);
}

function validateUploadFile(file: UploadFileInput | undefined): UploadFileInput {
  if (!file) {
    throw new AppError(400, "FILE_REQUIRED", "Attachment file is required.");
  }

  if (file.size <= 0) {
    throw new AppError(400, "FILE_EMPTY", "Attachment file cannot be empty.");
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new AppError(400, "FILE_TOO_LARGE", "Attachment file must not exceed 10 MB.");
  }

  if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(file.mimetype)) {
    throw new AppError(400, "UNSUPPORTED_FILE_TYPE", "Attachment file type is not supported.");
  }

  return file;
}

function getReason(input: DeleteAttachmentInput): string | null {
  return typeof input.reason === "string" ? input.reason.trim() || null : null;
}

async function getActiveTask(taskId: string): Promise<TaskRow> {
  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select("id, project_id, deleted_at")
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

async function getActiveAttachment(attachmentId: string): Promise<AttachmentRecord> {
  const { data, error } = await supabaseAdmin
    .from("task_attachments")
    .select(ATTACHMENT_RECORD_SELECT)
    .eq("id", attachmentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load attachment.");
  }

  if (!data) {
    throw new AppError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found.");
  }

  return data as AttachmentRecord;
}

async function requireActiveProjectMembership(projectId: string, userId: string): Promise<void> {
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

  if (!data) {
    throw new AppError(403, "FORBIDDEN", "You are not an active member of this project.");
  }
}

async function isProjectManagerForProject(projectId: string, userId: string): Promise<boolean> {
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

export async function listTaskAttachments(taskId: string, user: AuthUser): Promise<TaskAttachmentDTO[]> {
  requireNonAdmin(user);
  const task = await getActiveTask(taskId);
  await requireActiveProjectMembership(task.project_id, user.id);

  const { data, error } = await supabaseAdmin
    .from("task_attachments")
    .select(ATTACHMENT_SELECT)
    .eq("task_id", task.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load task attachments.");
  }

  return ((data ?? []) as unknown as AttachmentRow[]).map(mapAttachment);
}

export async function createTaskAttachment(
  taskId: string,
  fileInput: UploadFileInput | undefined,
  user: AuthUser,
  input?: AttachmentDisplayNameInput
): Promise<TaskAttachmentDTO> {
  requireNonAdmin(user);
  const task = await getActiveTask(taskId);
  await requireActiveProjectMembership(task.project_id, user.id);

  const file = validateUploadFile(fileInput);
  const attachmentId = randomUUID();
  const safeFileName = getSafeFileName(file, input);
  const filePath = `projects/${task.project_id}/tasks/${task.id}/${attachmentId}-${safeFileName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(env.supabaseStorageBucket)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw new AppError(500, "ATTACHMENT_UPLOAD_FAILED", "Failed to upload attachment.");
  }

  const { data, error } = await supabaseAdmin
    .from("task_attachments")
    .insert({
      id: attachmentId,
      task_id: task.id,
      uploaded_by: user.id,
      file_name: safeFileName,
      file_path: filePath,
      file_type: file.mimetype,
      file_size: file.size,
    })
    .select(ATTACHMENT_SELECT)
    .single();

  if (error || !data) {
    throw new AppError(500, "ATTACHMENT_CREATE_FAILED", "Failed to save attachment metadata.");
  }

  return mapAttachment(data as unknown as AttachmentRow);
}

export async function createAttachmentDownloadUrl(
  attachmentId: string,
  user: AuthUser
): Promise<{ signedUrl: string; expiresIn: number }> {
  requireNonAdmin(user);
  const attachment = await getActiveAttachment(attachmentId);
  const task = await getActiveTask(attachment.task_id);
  await requireActiveProjectMembership(task.project_id, user.id);

  const expiresIn = 300;
  const { data, error } = await supabaseAdmin.storage
    .from(env.supabaseStorageBucket)
    .createSignedUrl(attachment.file_path, expiresIn);

  if (error || !data?.signedUrl) {
    throw new AppError(500, "SIGNED_URL_FAILED", "Failed to create attachment download URL.");
  }

  return { signedUrl: data.signedUrl, expiresIn };
}

export async function deleteTaskAttachment(
  attachmentId: string,
  input: DeleteAttachmentInput,
  user: AuthUser
): Promise<void> {
  requireNonAdmin(user);
  const attachment = await getActiveAttachment(attachmentId);
  const task = await getActiveTask(attachment.task_id);
  await requireActiveProjectMembership(task.project_id, user.id);

  const isOwnAttachment = attachment.uploaded_by === user.id;
  const canManageProject = await isProjectManagerForProject(task.project_id, user.id);

  if (!isOwnAttachment && !canManageProject) {
    throw new AppError(403, "FORBIDDEN", "You can delete only your own attachments.");
  }

  const { error } = await supabaseAdmin
    .from("task_attachments")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
      deleted_reason: getReason(input),
    })
    .eq("id", attachment.id)
    .is("deleted_at", null);

  if (error) {
    throw new AppError(500, "ATTACHMENT_DELETE_FAILED", "Failed to delete attachment.");
  }
}

export { validateUuid };
