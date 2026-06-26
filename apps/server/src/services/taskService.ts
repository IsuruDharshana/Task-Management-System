import { supabaseAdmin } from "../config/supabaseAdmin.js";
import type { AuthUser } from "../types/auth.js";
import { AppError } from "../utils/appError.js";
import { logActivity } from "./activityLogService.js";
import {
  notifyTaskCreated,
  notifyTaskDeleted,
  notifyTaskAssigned,
  notifyTaskStatusChanged,
  notifyTaskUpdated,
} from "./realtimeEventService.js";

type TaskPriority = "low" | "medium" | "high";
type TaskStatus = "to_do" | "in_progress" | "completed";
type TaskSortBy = "due_date" | "priority" | "created_at";
type ProjectAccessRole = "project_manager" | "collaborator";

interface ProjectRow {
  id: string;
  name: string;
  created_by: string;
  deleted_at: string | null;
}

interface TaskRow {
  id: string;
  project_id: string;
  created_by: string;
  updated_by: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_reason: string | null;
}

interface TaskAssigneeRow {
  id: string;
  task_id: string;
  user_id: string;
  assigned_by: string | null;
  assigned_at: string;
  removed_at: string | null;
  removed_by: string | null;
  removed_reason: string | null;
  user: { id: string; name: string; email: string; role: string };
}

export interface TaskAssigneeDTO {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userEmail: string;
  assignedBy: string | null;
  assignedAt: string;
}

export interface TaskDTO {
  id: string;
  projectId: string;
  createdBy: string;
  updatedBy: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignees: TaskAssigneeDTO[];
}

interface ListTasksQuery {
  status?: unknown;
  priority?: unknown;
  assigneeId?: unknown;
  search?: unknown;
  sortBy?: unknown;
  sortOrder?: unknown;
}

interface CreateTaskInput {
  title?: unknown;
  description?: unknown;
  due_date?: unknown;
  priority?: unknown;
  status?: unknown;
  assignee_ids?: unknown;
}

interface UpdateTaskInput {
  title?: unknown;
  description?: unknown;
  due_date?: unknown;
  priority?: unknown;
  status?: unknown;
}

interface DeleteTaskInput {
  reason?: unknown;
}

interface AddAssigneeInput {
  user_id?: unknown;
}

interface RemoveAssigneeInput {
  reason?: unknown;
}

const TASK_SELECT =
  "id, project_id, created_by, updated_by, title, description, priority, status, due_date, completed_at, created_at, updated_at, deleted_at, deleted_by, deleted_reason";

const ASSIGNEE_SELECT =
  "id, task_id, user_id, assigned_by, assigned_at, removed_at, removed_by, removed_reason, user:app_users!user_id(id, name, email, role)";

const VALID_PRIORITIES = ["low", "medium", "high"] as const;
const VALID_STATUSES = ["to_do", "in_progress", "completed"] as const;
const VALID_SORT_BY = ["due_date", "priority", "created_at"] as const;
const COLLABORATOR_RESTRICTED_PATCH_FIELDS = [
  "title",
  "description",
  "due_date",
  "priority",
  "assignee_ids",
  "assignees",
] as const;

function mapAssignee(row: TaskAssigneeRow): TaskAssigneeDTO {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    userName: row.user?.name ?? "",
    userEmail: row.user?.email ?? "",
    assignedBy: row.assigned_by,
    assignedAt: row.assigned_at,
  };
}

function mapTask(row: TaskRow, assignees: TaskAssigneeRow[]): TaskDTO {
  return {
    id: row.id,
    projectId: row.project_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignees: assignees.map(mapAssignee),
  };
}

function requireNonAdmin(user: AuthUser): void {
  if (user.role === "admin") {
    throw new AppError(403, "FORBIDDEN", "Admin users cannot access task management.");
  }
}

export function validateUuid(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, "INVALID_ID", `${fieldName} is required.`);
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(value.trim())) {
    throw new AppError(400, "INVALID_ID", `${fieldName} must be a valid UUID.`);
  }

  return value.trim();
}

function validateTitle(title: unknown): string {
  if (typeof title !== "string" || !title.trim()) {
    throw new AppError(400, "INVALID_TITLE", "Task title is required.");
  }

  return title.trim();
}

function validateOptionalDescription(description: unknown): string | null | undefined {
  if (description === undefined) {
    return undefined;
  }

  if (description === null || description === "") {
    return null;
  }

  if (typeof description !== "string") {
    throw new AppError(400, "INVALID_DESCRIPTION", "Description must be a string.");
  }

  return description.trim() || null;
}

function validateOptionalDate(value: unknown, fieldName: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new AppError(400, "INVALID_DATE", `${fieldName} must be a valid date string.`);
  }

  const parsed = Date.parse(value);

  if (isNaN(parsed)) {
    throw new AppError(400, "INVALID_DATE", `${fieldName} must be a valid date string.`);
  }

  return value;
}

function validateNewDueDateNotPast(dueDate: string | null): void {
  if (!dueDate) {
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  if (due < today) {
    throw new AppError(400, "INVALID_DUE_DATE", "Due date cannot be in the past.");
  }
}

function validateOptionalPriority(priority: unknown): TaskPriority | undefined {
  if (priority === undefined || priority === null || priority === "") {
    return undefined;
  }

  if (typeof priority !== "string" || !(VALID_PRIORITIES as readonly string[]).includes(priority)) {
    throw new AppError(400, "INVALID_PRIORITY", "Priority must be low, medium, or high.");
  }

  return priority as TaskPriority;
}

function validateOptionalStatus(status: unknown): TaskStatus | undefined {
  if (status === undefined || status === null || status === "") {
    return undefined;
  }

  if (typeof status !== "string" || !(VALID_STATUSES as readonly string[]).includes(status)) {
    throw new AppError(400, "INVALID_STATUS", "Status must be to_do, in_progress, or completed.");
  }

  return status as TaskStatus;
}

function validateAssigneeIds(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new AppError(400, "INVALID_ASSIGNEES", "assignee_ids must be an array of user UUIDs.");
  }

  return [...new Set(value.map((id) => validateUuid(id, "assignee_id")))];
}

function getReason(input: DeleteTaskInput | RemoveAssigneeInput): string | null {
  return typeof input.reason === "string" ? input.reason.trim() || null : null;
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

async function getActiveTask(taskId: string): Promise<TaskRow> {
  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select(TASK_SELECT)
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

async function canManageProject(projectId: string, userId: string): Promise<boolean> {
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

async function getProjectAccessRole(projectId: string, userId: string): Promise<ProjectAccessRole | null> {
  await getActiveProject(projectId);

  const { data, error } = await supabaseAdmin
    .from("project_members")
    .select("project_role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .is("removed_at", null)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to check project membership.");
  }

  if (!data) {
    return null;
  }

  return data.project_role === "project_manager" ? "project_manager" : "collaborator";
}

async function requireCanManageProject(projectId: string, userId: string): Promise<void> {
  const canManage = await canManageProject(projectId, userId);

  if (!canManage) {
    throw new AppError(403, "FORBIDDEN", "Only a project manager for this project can perform this action.");
  }
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

async function isTaskAssignedToUser(taskId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("task_assignees")
    .select("id")
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .is("removed_at", null)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to check task assignment.");
  }

  return !!data;
}

async function getActiveAssignees(taskIds: string[]): Promise<Map<string, TaskAssigneeRow[]>> {
  const assigneesByTask = new Map<string, TaskAssigneeRow[]>();

  if (taskIds.length === 0) {
    return assigneesByTask;
  }

  const { data, error } = await supabaseAdmin
    .from("task_assignees")
    .select(ASSIGNEE_SELECT)
    .in("task_id", taskIds)
    .is("removed_at", null)
    .order("assigned_at", { ascending: true });

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load task assignees.");
  }

  for (const assignee of (data ?? []) as unknown as TaskAssigneeRow[]) {
    const existing = assigneesByTask.get(assignee.task_id) ?? [];
    existing.push(assignee);
    assigneesByTask.set(assignee.task_id, existing);
  }

  return assigneesByTask;
}

async function mapTasksWithAssignees(tasks: TaskRow[]): Promise<TaskDTO[]> {
  const assigneesByTask = await getActiveAssignees(tasks.map((task) => task.id));
  return tasks.map((task) => mapTask(task, assigneesByTask.get(task.id) ?? []));
}

async function getAssignableUser(projectId: string, userId: string): Promise<void> {
  const { data: assigneeUser, error: userError } = await supabaseAdmin
    .from("app_users")
    .select("id, is_active, deleted_at")
    .eq("id", userId)
    .maybeSingle();

  if (userError) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to verify assignee.");
  }

  if (!assigneeUser) {
    throw new AppError(404, "USER_NOT_FOUND", "Assignee user not found.");
  }

  const userRow = assigneeUser as { is_active: boolean; deleted_at: string | null };

  if (!userRow.is_active || userRow.deleted_at) {
    throw new AppError(400, "USER_INACTIVE", "Assignee user must be active.");
  }

  const isMember = await isActiveProjectMember(projectId, userId);

  if (!isMember) {
    throw new AppError(400, "ASSIGNEE_NOT_PROJECT_MEMBER", "Assignee must be an active member of the task project.");
  }
}

async function ensureNotActivelyAssigned(taskId: string, userId: string): Promise<void> {
  const alreadyAssigned = await isTaskAssignedToUser(taskId, userId);

  if (alreadyAssigned) {
    throw new AppError(409, "ASSIGNEE_ALREADY_EXISTS", "User is already actively assigned to this task.");
  }
}

async function createActiveAssignment(task: TaskRow, userId: string, assignedBy: string): Promise<TaskAssigneeDTO> {
  await getAssignableUser(task.project_id, userId);
  await ensureNotActivelyAssigned(task.id, userId);

  const { data, error } = await supabaseAdmin
    .from("task_assignees")
    .insert({
      task_id: task.id,
      user_id: userId,
      assigned_by: assignedBy,
    })
    .select(ASSIGNEE_SELECT)
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      throw new AppError(409, "ASSIGNEE_ALREADY_EXISTS", "User is already actively assigned to this task.");
    }

    throw new AppError(500, "ASSIGNEE_ADD_FAILED", "Failed to assign user to task.");
  }

  return mapAssignee(data as unknown as TaskAssigneeRow);
}

async function getVisibleTask(taskId: string, user: AuthUser): Promise<TaskRow> {
  requireNonAdmin(user);
  const task = await getActiveTask(taskId);
  const accessRole = await getProjectAccessRole(task.project_id, user.id);

  if (!accessRole) {
    throw new AppError(403, "FORBIDDEN", "You are not an active member of this project.");
  }

  if (accessRole === "project_manager") {
    return task;
  }

  const isAssigned = await isTaskAssignedToUser(task.id, user.id);

  if (!isAssigned) {
    throw new AppError(404, "TASK_NOT_FOUND", "Task not found.");
  }

  return task;
}

export async function listTasks(
  projectId: string,
  query: ListTasksQuery,
  user: AuthUser
): Promise<TaskDTO[]> {
  requireNonAdmin(user);
  await getActiveProject(projectId);

  const status = validateOptionalStatus(query.status);
  const priority = validateOptionalPriority(query.priority);
  const assigneeId = query.assigneeId ? validateUuid(query.assigneeId, "assigneeId") : undefined;
  const sortBy =
    typeof query.sortBy === "string" && (VALID_SORT_BY as readonly string[]).includes(query.sortBy)
      ? (query.sortBy as TaskSortBy)
      : "created_at";
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const accessRole = await getProjectAccessRole(projectId, user.id);

  let assignmentFilterUserId: string | undefined;

  if (!accessRole) {
    throw new AppError(403, "FORBIDDEN", "You are not an active member of this project.");
  }

  if (accessRole === "project_manager") {
    assignmentFilterUserId = assigneeId;
  } else {
    assignmentFilterUserId = user.id;
  }

  let visibleTaskIds: string[] | undefined;

  if (assignmentFilterUserId) {
    const { data: assignments, error: assignmentError } = await supabaseAdmin
      .from("task_assignees")
      .select("task_id")
      .eq("user_id", assignmentFilterUserId)
      .is("removed_at", null);

    if (assignmentError) {
      throw new AppError(500, "DATABASE_ERROR", "Failed to load task assignments.");
    }

    visibleTaskIds = [...new Set((assignments ?? []).map((assignment) => assignment.task_id))];

    if (visibleTaskIds.length === 0) {
      return [];
    }
  }

  let taskQuery = supabaseAdmin
    .from("tasks")
    .select(TASK_SELECT)
    .eq("project_id", projectId)
    .is("deleted_at", null);

  if (status) {
    taskQuery = taskQuery.eq("status", status);
  }

  if (priority) {
    taskQuery = taskQuery.eq("priority", priority);
  }

  if (visibleTaskIds) {
    taskQuery = taskQuery.in("id", visibleTaskIds);
  }

  if (search) {
    taskQuery = taskQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, error } = await taskQuery.order(sortBy, { ascending: sortOrder === "asc" });

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load tasks.");
  }

  return mapTasksWithAssignees((data ?? []) as TaskRow[]);
}

export async function createTask(
  projectId: string,
  input: CreateTaskInput,
  user: AuthUser
): Promise<TaskDTO> {
  requireNonAdmin(user);

  if (user.role !== "project_manager") {
    throw new AppError(403, "FORBIDDEN", "Collaborators cannot create tasks.");
  }

  await requireCanManageProject(projectId, user.id);

  const title = validateTitle(input.title);
  const description = validateOptionalDescription(input.description) ?? null;
  const dueDate = validateOptionalDate(input.due_date, "due_date") ?? null;
  validateNewDueDateNotPast(dueDate);

  const priority = validateOptionalPriority(input.priority) ?? "medium";
  const status = validateOptionalStatus(input.status) ?? "to_do";
  const assigneeIds = validateAssigneeIds(input.assignee_ids);
  const now = new Date().toISOString();

  for (const assigneeId of assigneeIds) {
    await getAssignableUser(projectId, assigneeId);
  }

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .insert({
      project_id: projectId,
      created_by: user.id,
      updated_by: user.id,
      title,
      description,
      priority,
      status,
      due_date: dueDate,
      completed_at: status === "completed" ? now : null,
    })
    .select(TASK_SELECT)
    .single();

  if (error || !data) {
    throw new AppError(500, "TASK_CREATE_FAILED", "Failed to create task.");
  }

  const task = data as TaskRow;

  for (const assigneeId of assigneeIds) {
    await createActiveAssignment(task, assigneeId, user.id);
  }

  const [taskDto] = await mapTasksWithAssignees([task]);
  const project = await getActiveProject(projectId);
  await logActivity({
    actorUserId: user.id,
    action: "task_created",
    entityType: "task",
    entityId: task.id,
    metadata: { projectId, projectName: project.name, taskId: task.id, taskTitle: task.title },
  });

  await notifyTaskCreated(
    {
      taskId: task.id,
      taskTitle: task.title,
      projectId,
      projectName: project.name,
      actorUserId: user.id,
    },
    assigneeIds
  );

  return taskDto;
}

export async function getTask(taskId: string, user: AuthUser): Promise<TaskDTO> {
  const task = await getVisibleTask(taskId, user);
  const [taskDto] = await mapTasksWithAssignees([task]);
  return taskDto;
}

export async function updateTask(taskId: string, input: UpdateTaskInput, user: AuthUser): Promise<TaskDTO> {
  requireNonAdmin(user);
  const task = await getActiveTask(taskId);
  const accessRole = await getProjectAccessRole(task.project_id, user.id);

  if (!accessRole) {
    throw new AppError(403, "FORBIDDEN", "You are not an active member of this project.");
  }

  const updates: Record<string, unknown> = {};

  if (accessRole === "collaborator") {
    const restrictedFields = COLLABORATOR_RESTRICTED_PATCH_FIELDS.filter((field) =>
      Object.prototype.hasOwnProperty.call(input, field)
    );

    if (restrictedFields.length > 0) {
      throw new AppError(403, "FORBIDDEN", "Collaborators can update only the status of assigned tasks.", {
        restrictedFields,
      });
    }

    const isAssigned = await isTaskAssignedToUser(task.id, user.id);

    if (!isAssigned) {
      throw new AppError(404, "TASK_NOT_FOUND", "Task not found.");
    }

    if (input.status === undefined) {
      throw new AppError(400, "NO_UPDATE_FIELDS", "At least one editable field is required.");
    }

    const status = validateOptionalStatus(input.status);
    if (status) {
      updates.status = status;
      updates.completed_at = status === "completed" ? new Date().toISOString() : null;
    }
  } else {
    if (input.title !== undefined) {
      updates.title = validateTitle(input.title);
    }

    if (input.description !== undefined) {
      updates.description = validateOptionalDescription(input.description) ?? null;
    }

    if (input.due_date !== undefined) {
      const dueDate = validateOptionalDate(input.due_date, "due_date") ?? null;
      validateNewDueDateNotPast(dueDate);
      updates.due_date = dueDate;
    }

    if (input.priority !== undefined) {
      const priority = validateOptionalPriority(input.priority);
      if (priority) updates.priority = priority;
    }

    if (input.status !== undefined) {
      const status = validateOptionalStatus(input.status);
      if (status) {
        updates.status = status;
        updates.completed_at = status === "completed" ? new Date().toISOString() : null;
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, "NO_UPDATE_FIELDS", "At least one editable field is required.");
  }

  updates.updated_by = user.id;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .update(updates)
    .eq("id", task.id)
    .is("deleted_at", null)
    .select(TASK_SELECT)
    .single();

  if (error || !data) {
    throw new AppError(500, "TASK_UPDATE_FAILED", "Failed to update task.");
  }

  const updatedTask = data as TaskRow;
  const changedTitle = updatedTask.title !== task.title;
  const changedDescription = updatedTask.description !== task.description;
  const statusChanged = updatedTask.status !== task.status;
  const nonStatusChangedFields = [
    ...(changedTitle ? ["title"] : []),
    ...(changedDescription ? ["description"] : []),
    ...(updatedTask.due_date !== task.due_date ? ["due_date"] : []),
    ...(updatedTask.priority !== task.priority ? ["priority"] : []),
  ];
  const project = await getActiveProject(task.project_id);

  if (statusChanged) {
    await logActivity({
      actorUserId: user.id,
      action: "task_status_changed",
      entityType: "task",
      entityId: task.id,
      metadata: {
        projectId: task.project_id,
        projectName: project.name,
        taskId: task.id,
        taskTitle: updatedTask.title,
        from: task.status,
        to: updatedTask.status,
      },
    });
  }

  if (updatedTask.priority !== task.priority) {
    await logActivity({
      actorUserId: user.id,
      action: "task_priority_changed",
      entityType: "task",
      entityId: task.id,
      metadata: {
        projectId: task.project_id,
        projectName: project.name,
        taskId: task.id,
        taskTitle: updatedTask.title,
        from: task.priority,
        to: updatedTask.priority,
      },
    });
  }

  if (updatedTask.due_date !== task.due_date) {
    await logActivity({
      actorUserId: user.id,
      action: "task_due_date_changed",
      entityType: "task",
      entityId: task.id,
      metadata: {
        projectId: task.project_id,
        projectName: project.name,
        taskId: task.id,
        taskTitle: updatedTask.title,
        from: task.due_date,
        to: updatedTask.due_date,
      },
    });
  }

  if (changedTitle || changedDescription) {
    await logActivity({
      actorUserId: user.id,
      action: "task_updated",
      entityType: "task",
      entityId: task.id,
      metadata: {
        projectId: task.project_id,
        projectName: project.name,
        taskId: task.id,
        taskTitle: updatedTask.title,
        changedFields: [
          ...(changedTitle ? ["title"] : []),
          ...(changedDescription ? ["description"] : []),
        ],
      },
    });
  }

  if (statusChanged) {
    await notifyTaskStatusChanged(
      {
        taskId: task.id,
        taskTitle: updatedTask.title,
        projectId: task.project_id,
        projectName: project.name,
        actorUserId: user.id,
      },
      task.status,
      updatedTask.status
    );
  }

  await notifyTaskUpdated({
    taskId: task.id,
    taskTitle: updatedTask.title,
    projectId: task.project_id,
    projectName: project.name,
    actorUserId: user.id,
    changedFields: nonStatusChangedFields,
  });

  const [taskDto] = await mapTasksWithAssignees([updatedTask]);
  return taskDto;
}

export async function deleteTask(taskId: string, input: DeleteTaskInput, user: AuthUser): Promise<void> {
  requireNonAdmin(user);

  if (user.role !== "project_manager") {
    throw new AppError(403, "FORBIDDEN", "Collaborators cannot delete tasks.");
  }

  const task = await getActiveTask(taskId);
  await requireCanManageProject(task.project_id, user.id);

  const { error } = await supabaseAdmin
    .from("tasks")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
      deleted_reason: getReason(input),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", task.id)
    .is("deleted_at", null);

  if (error) {
    throw new AppError(500, "TASK_DELETE_FAILED", "Failed to delete task.");
  }

  const project = await getActiveProject(task.project_id);
  await logActivity({
    actorUserId: user.id,
    action: "task_deleted",
    entityType: "task",
    entityId: task.id,
    metadata: { projectId: task.project_id, projectName: project.name, taskId: task.id, taskTitle: task.title },
  });

  await notifyTaskDeleted({
    taskId: task.id,
    taskTitle: task.title,
    projectId: task.project_id,
    projectName: project.name,
    actorUserId: user.id,
  });
}

export async function addTaskAssignee(
  taskId: string,
  input: AddAssigneeInput,
  user: AuthUser
): Promise<TaskAssigneeDTO> {
  requireNonAdmin(user);

  if (user.role !== "project_manager") {
    throw new AppError(403, "FORBIDDEN", "Only project managers can assign tasks.");
  }

  const task = await getActiveTask(taskId);
  await requireCanManageProject(task.project_id, user.id);

  const assigneeUserId = validateUuid(input.user_id, "user_id");
  const assignee = await createActiveAssignment(task, assigneeUserId, user.id);
  const project = await getActiveProject(task.project_id);

  await logActivity({
    actorUserId: user.id,
    action: "task_assignee_added",
    entityType: "task",
    entityId: task.id,
    metadata: {
      projectId: task.project_id,
      projectName: project.name,
      taskId: task.id,
      taskTitle: task.title,
      assigneeId: assignee.userId,
      assigneeName: assignee.userName,
    },
  });

  await notifyTaskAssigned(
    {
      taskId: task.id,
      taskTitle: task.title,
      projectId: task.project_id,
      projectName: project.name,
      actorUserId: user.id,
    },
    [assignee.userId]
  );

  return assignee;
}

export async function removeTaskAssignee(
  taskId: string,
  userId: string,
  input: RemoveAssigneeInput,
  user: AuthUser
): Promise<void> {
  requireNonAdmin(user);

  if (user.role !== "project_manager") {
    throw new AppError(403, "FORBIDDEN", "Only project managers can remove task assignees.");
  }

  const task = await getActiveTask(taskId);
  await requireCanManageProject(task.project_id, user.id);

  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from("task_assignees")
    .select("id, user:app_users!user_id(id, name)")
    .eq("task_id", task.id)
    .eq("user_id", userId)
    .is("removed_at", null)
    .maybeSingle();

  if (assignmentError) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load task assignment.");
  }

  if (!assignment) {
    throw new AppError(404, "ASSIGNEE_NOT_FOUND", "Active task assignment not found.");
  }

  const { error } = await supabaseAdmin
    .from("task_assignees")
    .update({
      removed_at: new Date().toISOString(),
      removed_by: user.id,
      removed_reason: getReason(input),
    })
    .eq("id", assignment.id)
    .is("removed_at", null);

  if (error) {
    throw new AppError(500, "ASSIGNEE_REMOVE_FAILED", "Failed to remove task assignee.");
  }

  const assignmentRow = assignment as unknown as { user?: { id: string; name: string } | null };
  const project = await getActiveProject(task.project_id);
  await logActivity({
    actorUserId: user.id,
    action: "task_assignee_removed",
    entityType: "task",
    entityId: task.id,
    metadata: {
      projectId: task.project_id,
      projectName: project.name,
      taskId: task.id,
      taskTitle: task.title,
      assigneeId: userId,
      assigneeName: assignmentRow.user?.name ?? "",
    },
  });
}
