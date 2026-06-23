import { supabaseAdmin } from "../config/supabaseAdmin.js";
import type { AuthUser, UserRole } from "../types/auth.js";
import { AppError } from "../utils/appError.js";
import { logActivity } from "./activityLogService.js";
import {
  notifyProjectMemberAdded,
  notifyProjectMemberRemoved,
  notifyProjectDeleted,
  notifyProjectUpdated,
} from "./realtimeEventService.js";

// Row types (DB shapes)

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string | null;
  due_date: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_reason: string | null;
}

interface MemberRow {
  id: string;
  project_id: string;
  user_id: string;
  project_role: string;
  project_label: string | null;
  added_by: string;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
  removed_by: string | null;
  removed_reason: string | null;
}

interface MemberWithUserRow extends MemberRow {
  user: { id: string; name: string; email: string; role: string };
}

interface EligibleUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
}

// DTOs

export interface ProjectDTO {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  currentUserProjectRole: string | null;
}

export interface MemberDTO {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  userEmail: string;
  projectRole: string;
  projectLabel: string | null;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EligibleMemberDTO {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Mappers

function mapProject(row: ProjectRow, currentUserProjectRole: string | null = null): ProjectDTO {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    startDate: row.start_date,
    dueDate: row.due_date,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentUserProjectRole,
  };
}

function mapMember(row: MemberWithUserRow): MemberDTO {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    userName: row.user?.name ?? "",
    userEmail: row.user?.email ?? "",
    projectRole: row.project_role,
    projectLabel: row.project_label,
    addedBy: row.added_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEligibleMember(row: EligibleUserRow): EligibleMemberDTO {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
  };
}

// Constants

const PROJECT_SELECT =
  "id, name, description, status, start_date, due_date, created_by, updated_by, created_at, updated_at, deleted_at, deleted_by, deleted_reason";

const MEMBER_SELECT =
  "id, project_id, user_id, project_role, project_label, added_by, created_at, updated_at, removed_at, removed_by, removed_reason, user:app_users!user_id(id, name, email, role)";

const VALID_STATUSES = ["active", "completed", "archived"] as const;
const VALID_PROJECT_ROLES = ["project_manager", "collaborator"] as const;

// Permission helpers

export function requireNonAdmin(user: AuthUser): void {
  if (user.role === "admin") {
    throw new AppError(403, "FORBIDDEN", "Admin users cannot access project management.");
  }
}

export function requireGlobalProjectManager(user: AuthUser): void {
  if (user.role !== "project_manager") {
    throw new AppError(403, "FORBIDDEN", "Only project managers can create projects.");
  }
}

export async function isProjectMember(projectId: string, userId: string): Promise<boolean> {
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

export async function isProjectManagerForProject(projectId: string, userId: string): Promise<boolean> {
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

export async function requireProjectManagerForProject(projectId: string, userId: string): Promise<void> {
  const project = await getActiveProject(projectId);

  if (project.created_by === userId) {
    return;
  }

  const isPM = await isProjectManagerForProject(projectId, userId);

  if (!isPM) {
    throw new AppError(403, "FORBIDDEN", "Only the project manager of this project can perform this action.");
  }
}

// Validation helpers

function validateProjectName(name: unknown): string {
  if (typeof name !== "string" || !name.trim()) {
    throw new AppError(400, "INVALID_NAME", "Project name is required.");
  }

  const trimmed = name.trim();

  if (trimmed.length > 150) {
    throw new AppError(400, "INVALID_NAME", "Project name must not exceed 150 characters.");
  }

  return trimmed;
}

function validateOptionalStatus(status: unknown): string | undefined {
  if (status === undefined || status === null || status === "") {
    return undefined;
  }

  if (typeof status !== "string" || !(VALID_STATUSES as readonly string[]).includes(status)) {
    throw new AppError(400, "INVALID_STATUS", "Status must be active, completed, or archived.");
  }

  return status;
}

function validateOptionalDate(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
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

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toCalendarDateString(value: string): string {
  const dateOnlyMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);

  if (dateOnlyMatch) {
    return dateOnlyMatch[1];
  }

  const parsed = new Date(value);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validateDateNotInPast(date: string | null, errorCode: string, message: string): void {
  if (!date) return;

  if (toCalendarDateString(date) < getTodayDateString()) {
    throw new AppError(400, errorCode, message);
  }
}

function validateDateRange(startDate: string | undefined | null, dueDate: string | undefined | null): void {
  if (startDate && dueDate) {
    if (toCalendarDateString(dueDate) < toCalendarDateString(startDate)) {
      throw new AppError(400, "INVALID_DATE_RANGE", "Due date cannot be before start date.");
    }
  }
}

function validateProjectRole(role: unknown): string {
  if (typeof role !== "string" || !(VALID_PROJECT_ROLES as readonly string[]).includes(role)) {
    throw new AppError(400, "INVALID_PROJECT_ROLE", "Project role must be project_manager or collaborator.");
  }

  return role;
}

function validateOptionalProjectLabel(label: unknown): string | undefined {
  if (label === undefined || label === null || label === "") {
    return undefined;
  }

  if (typeof label !== "string") {
    throw new AppError(400, "INVALID_PROJECT_LABEL", "Project label must be a string.");
  }

  const trimmed = label.trim();

  if (trimmed.length > 100) {
    throw new AppError(400, "INVALID_PROJECT_LABEL", "Project label must not exceed 100 characters.");
  }

  return trimmed;
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

// Internal helpers

async function getActiveProject(projectId: string): Promise<ProjectRow> {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select(PROJECT_SELECT)
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

async function getActiveMember(memberId: string, projectId: string): Promise<MemberWithUserRow> {
  const { data, error } = await supabaseAdmin
    .from("project_members")
    .select(MEMBER_SELECT)
    .eq("id", memberId)
    .eq("project_id", projectId)
    .is("removed_at", null)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load member.");
  }

  if (!data) {
    throw new AppError(404, "MEMBER_NOT_FOUND", "Project member not found.");
  }

  return data as unknown as MemberWithUserRow;
}

// Project CRUD

interface CreateProjectInput {
  name?: unknown;
  description?: unknown;
  status?: unknown;
  start_date?: unknown;
  due_date?: unknown;
}

export async function createProject(input: CreateProjectInput, user: AuthUser): Promise<ProjectDTO> {
  requireNonAdmin(user);
  requireGlobalProjectManager(user);

  const name = validateProjectName(input.name);
  const description = typeof input.description === "string" ? input.description.trim() || null : null;
  const status = validateOptionalStatus(input.status) ?? "active";
  const startDate = validateOptionalDate(input.start_date, "start_date") ?? null;
  const dueDate = validateOptionalDate(input.due_date, "due_date") ?? null;

  validateDateNotInPast(startDate, "INVALID_START_DATE", "Start date cannot be before today.");
  validateDateNotInPast(dueDate, "INVALID_DUE_DATE", "Due date cannot be before today.");
  validateDateRange(startDate, dueDate);

  const { data, error } = await supabaseAdmin
    .from("projects")
    .insert({
      name,
      description,
      status,
      start_date: startDate,
      due_date: dueDate,
      created_by: user.id,
      updated_by: user.id,
    })
    .select(PROJECT_SELECT)
    .single();

  if (error || !data) {
    throw new AppError(500, "PROJECT_CREATE_FAILED", "Failed to create project.");
  }

  const project = data as ProjectRow;

  // Auto-add creator as project_manager member
  const { error: memberError } = await supabaseAdmin
    .from("project_members")
    .insert({
      project_id: project.id,
      user_id: user.id,
      project_role: "project_manager",
      added_by: user.id,
    });

  if (memberError) {
    // Rollback: hard-delete the project that was just created
    await supabaseAdmin.from("projects").delete().eq("id", project.id);
    throw new AppError(500, "PROJECT_CREATE_FAILED", "Failed to add creator as project member.");
  }

  await logActivity({
    actorUserId: user.id,
    action: "project_created",
    entityType: "project",
    entityId: project.id,
    metadata: { projectId: project.id, projectName: project.name },
  });

  return mapProject(project, "project_manager");
}

export async function listProjects(user: AuthUser): Promise<ProjectDTO[]> {
  requireNonAdmin(user);

  // Get project IDs where user is an active member
  const { data: memberships, error: memberError } = await supabaseAdmin
    .from("project_members")
    .select("project_id, project_role")
    .eq("user_id", user.id)
    .is("removed_at", null);

  if (memberError) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load projects.");
  }

  if ((!memberships || memberships.length === 0) && user.role !== "project_manager") {
    return [];
  }

  const projectRolesById = new Map<string, string>();
  for (const membership of memberships ?? []) {
    projectRolesById.set(
      membership.project_id,
      membership.project_role === "project_manager" ? "project_manager" : "collaborator"
    );
  }

  if (user.role === "project_manager") {
    const { data: createdProjects, error: createdProjectError } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("created_by", user.id)
      .is("deleted_at", null);

    if (createdProjectError) {
      throw new AppError(500, "DATABASE_ERROR", "Failed to load projects.");
    }

    for (const project of createdProjects ?? []) {
      projectRolesById.set(project.id, "project_manager");
    }
  }

  const projectIds = [...projectRolesById.keys()];

  if (projectIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("projects")
    .select(PROJECT_SELECT)
    .in("id", projectIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load projects.");
  }

  return ((data ?? []) as ProjectRow[]).map((project) =>
    mapProject(
      project,
      project.created_by === user.id ? "project_manager" : projectRolesById.get(project.id) ?? null
    )
  );
}

export async function getProject(projectId: string, user: AuthUser): Promise<ProjectDTO> {
  requireNonAdmin(user);

  const project = await getActiveProject(projectId);

  const isMember = project.created_by === user.id || (await isProjectMember(projectId, user.id));

  if (!isMember) {
    throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found.");
  }

  return mapProject(
    project,
    project.created_by === user.id
      ? "project_manager"
      : (await isProjectManagerForProject(projectId, user.id))
        ? "project_manager"
        : "collaborator"
  );
}

interface UpdateProjectInput {
  name?: unknown;
  description?: unknown;
  status?: unknown;
  start_date?: unknown;
  due_date?: unknown;
}

export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
  user: AuthUser
): Promise<ProjectDTO> {
  requireNonAdmin(user);
  await requireProjectManagerForProject(projectId, user.id);

  const existingProject = await getActiveProject(projectId);

  const updates: Record<string, unknown> = {};

  if (input.name !== undefined) {
    updates.name = validateProjectName(input.name);
  }

  if (input.description !== undefined) {
    updates.description = typeof input.description === "string" ? input.description.trim() || null : null;
  }

  if (input.status !== undefined) {
    const status = validateOptionalStatus(input.status);
    if (status) updates.status = status;
  }

  if (input.start_date !== undefined) {
    updates.start_date = validateOptionalDate(input.start_date, "start_date") ?? null;
    validateDateNotInPast(updates.start_date as string | null, "INVALID_START_DATE", "Start date cannot be before today.");
  }

  if (input.due_date !== undefined) {
    updates.due_date = validateOptionalDate(input.due_date, "due_date") ?? null;
    validateDateNotInPast(updates.due_date as string | null, "INVALID_DUE_DATE", "Due date cannot be before today.");
  }

  // Validate date range considering both existing and new values
  const finalStartDate = (updates.start_date !== undefined ? updates.start_date : existingProject.start_date) as string | null;
  const finalDueDate = (updates.due_date !== undefined ? updates.due_date : existingProject.due_date) as string | null;
  validateDateRange(finalStartDate, finalDueDate);

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, "NO_UPDATE_FIELDS", "At least one editable field is required.");
  }

  updates.updated_by = user.id;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("projects")
    .update(updates)
    .eq("id", projectId)
    .is("deleted_at", null)
    .select(PROJECT_SELECT)
    .single();

  if (error || !data) {
    throw new AppError(500, "PROJECT_UPDATE_FAILED", "Failed to update project.");
  }

  const updatedProject = data as ProjectRow;
  const changedFields = Object.keys(updates).filter((field) => !["updated_by", "updated_at"].includes(field));

  await logActivity({
    actorUserId: user.id,
    action: "project_updated",
    entityType: "project",
    entityId: projectId,
    metadata: {
      projectId,
      projectName: updatedProject.name,
      changedFields,
    },
  });

  await notifyProjectUpdated(
    {
      projectId,
      projectName: updatedProject.name,
      actorUserId: user.id,
    },
    changedFields
  );

  return mapProject(updatedProject, "project_manager");
}

interface DeleteProjectInput {
  reason?: unknown;
}

export async function deleteProject(
  projectId: string,
  input: DeleteProjectInput,
  user: AuthUser
): Promise<void> {
  requireNonAdmin(user);
  await requireProjectManagerForProject(projectId, user.id);
  const project = await getActiveProject(projectId);

  const reason = typeof input.reason === "string" ? input.reason.trim() || null : null;

  const { error } = await supabaseAdmin
    .from("projects")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
      deleted_reason: reason,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", projectId)
    .is("deleted_at", null);

  if (error) {
    throw new AppError(500, "PROJECT_DELETE_FAILED", "Failed to delete project.");
  }

  await logActivity({
    actorUserId: user.id,
    action: "project_deleted",
    entityType: "project",
    entityId: projectId,
    metadata: { projectId, projectName: project.name },
  });

  await notifyProjectDeleted({
    projectId,
    projectName: project.name,
    actorUserId: user.id,
  });
}

// Member CRUD

export async function listMembers(projectId: string, user: AuthUser): Promise<MemberDTO[]> {
  requireNonAdmin(user);
  const project = await getActiveProject(projectId);

  const isMember = project.created_by === user.id || (await isProjectMember(projectId, user.id));

  if (!isMember) {
    throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found.");
  }

  const { data, error } = await supabaseAdmin
    .from("project_members")
    .select(MEMBER_SELECT)
    .eq("project_id", projectId)
    .is("removed_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load members.");
  }

  return ((data ?? []) as unknown as MemberWithUserRow[]).map(mapMember);
}

export async function listEligibleMembers(projectId: string, user: AuthUser): Promise<EligibleMemberDTO[]> {
  requireNonAdmin(user);
  await getActiveProject(projectId);
  await requireProjectManagerForProject(projectId, user.id);

  const { data: activeMembers, error: memberError } = await supabaseAdmin
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .is("removed_at", null);

  if (memberError) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load project members.");
  }

  const activeMemberIds = new Set((activeMembers ?? []).map((member) => member.user_id));

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, name, email, role")
    .eq("is_active", true)
    .is("deleted_at", null)
    .neq("role", "admin")
    .order("name", { ascending: true });

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load eligible users.");
  }

  return ((data ?? []) as EligibleUserRow[])
    .filter((eligibleUser) => !activeMemberIds.has(eligibleUser.id))
    .map(mapEligibleMember);
}

interface AddMemberInput {
  user_id?: unknown;
  project_role?: unknown;
  project_label?: unknown;
}

export async function addMember(
  projectId: string,
  input: AddMemberInput,
  user: AuthUser
): Promise<MemberDTO> {
  requireNonAdmin(user);
  await requireProjectManagerForProject(projectId, user.id);
  const project = await getActiveProject(projectId);

  const targetUserId = validateUuid(input.user_id, "user_id");
  const projectRole = validateProjectRole(input.project_role);
  const projectLabel = validateOptionalProjectLabel(input.project_label) ?? null;

  // Verify target user exists and check eligibility
  const { data: targetUser, error: userError } = await supabaseAdmin
    .from("app_users")
    .select("id, role, is_active, deleted_at")
    .eq("id", targetUserId)
    .maybeSingle();

  if (userError) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to verify user.");
  }

  if (!targetUser) {
    throw new AppError(404, "USER_NOT_FOUND", "Target user not found.");
  }

  const targetRole = (targetUser as { role: UserRole }).role;
  const targetIsActive = (targetUser as { is_active: boolean }).is_active;
  const targetDeletedAt = (targetUser as { deleted_at: string | null }).deleted_at;

  if (targetRole === "admin") {
    throw new AppError(400, "CANNOT_ADD_ADMIN", "Admin users cannot be added as project members.");
  }

  if (!targetIsActive || targetDeletedAt) {
    throw new AppError(400, "USER_INACTIVE", "Cannot add an inactive or deleted user as a project member.");
  }

  // Global collaborators cannot be assigned the project_manager role
  if (projectRole === "project_manager" && targetRole !== "project_manager") {
    throw new AppError(
      400,
      "INVALID_PROJECT_MANAGER_MEMBER",
      "Only users with the Project Manager role can be added as project managers."
    );
  }

  // Check not already an active member
  const alreadyMember = await isProjectMember(projectId, targetUserId);

  if (alreadyMember) {
    throw new AppError(409, "MEMBER_ALREADY_EXISTS", "User is already an active member of this project.");
  }

  const { data, error } = await supabaseAdmin
    .from("project_members")
    .insert({
      project_id: projectId,
      user_id: targetUserId,
      project_role: projectRole,
      project_label: projectLabel,
      added_by: user.id,
    })
    .select(MEMBER_SELECT)
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      throw new AppError(409, "MEMBER_ALREADY_EXISTS", "User is already an active member of this project.");
    }

    throw new AppError(500, "MEMBER_ADD_FAILED", "Failed to add member.");
  }

  const member = mapMember(data as unknown as MemberWithUserRow);

  await logActivity({
    actorUserId: user.id,
    action: "project_member_added",
    entityType: "project",
    entityId: projectId,
    metadata: {
      projectId,
      projectName: project.name,
      memberId: member.id,
      targetUserId: member.userId,
      targetUserName: member.userName,
      projectRole: member.projectRole,
    },
  });

  await notifyProjectMemberAdded(
    {
      projectId,
      projectName: project.name,
      actorUserId: user.id,
    },
    member.userId
  );

  return member;
}

interface UpdateMemberInput {
  project_role?: unknown;
  project_label?: unknown;
}

export async function updateMember(
  projectId: string,
  memberId: string,
  input: UpdateMemberInput,
  user: AuthUser
): Promise<MemberDTO> {
  requireNonAdmin(user);
  await requireProjectManagerForProject(projectId, user.id);
  const project = await getActiveProject(projectId);

  const existingMember = await getActiveMember(memberId, projectId);

  const updates: Record<string, unknown> = {};

  if (input.project_role !== undefined) {
    updates.project_role = validateProjectRole(input.project_role);
  }

  if (input.project_label !== undefined) {
    updates.project_label = validateOptionalProjectLabel(input.project_label) ?? null;
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, "NO_UPDATE_FIELDS", "At least one editable field is required.");
  }

  // If promoting to project_manager, verify the member's global role allows it
  if (updates.project_role === "project_manager" && existingMember.project_role !== "project_manager") {
    const memberGlobalRole = existingMember.user?.role as UserRole | undefined;

    if (memberGlobalRole !== "project_manager") {
      throw new AppError(
        400,
        "INVALID_PROJECT_MANAGER_MEMBER",
        "Only users with the Project Manager role can be promoted to project manager."
      );
    }
  }

  // If demoting a PM away from project_manager, check they are not the last PM
  if (updates.project_role && updates.project_role !== "project_manager") {
    if (existingMember.project_role === "project_manager") {
      const { count, error: countError } = await supabaseAdmin
        .from("project_members")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("project_role", "project_manager")
        .is("removed_at", null);

      if (countError) {
        throw new AppError(500, "DATABASE_ERROR", "Failed to validate project manager count.");
      }

      if ((count ?? 0) <= 1) {
        throw new AppError(400, "LAST_PROJECT_MANAGER", "Cannot change the role of the last project manager.");
      }
    }
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("project_members")
    .update(updates)
    .eq("id", memberId)
    .eq("project_id", projectId)
    .is("removed_at", null)
    .select(MEMBER_SELECT)
    .single();

  if (error || !data) {
    throw new AppError(500, "MEMBER_UPDATE_FAILED", "Failed to update member.");
  }

  const member = mapMember(data as unknown as MemberWithUserRow);

  if (updates.project_role && updates.project_role !== existingMember.project_role) {
    await logActivity({
      actorUserId: user.id,
      action: "project_member_role_changed",
      entityType: "project",
      entityId: projectId,
      metadata: {
        projectId,
        projectName: project.name,
        memberId: member.id,
        targetUserId: member.userId,
        targetUserName: member.userName,
        from: existingMember.project_role,
        to: member.projectRole,
      },
    });
  }

  return member;
}

interface RemoveMemberInput {
  reason?: unknown;
}

export async function removeMember(
  projectId: string,
  memberId: string,
  input: RemoveMemberInput,
  user: AuthUser
): Promise<void> {
  requireNonAdmin(user);
  await requireProjectManagerForProject(projectId, user.id);
  const project = await getActiveProject(projectId);

  const member = await getActiveMember(memberId, projectId);

  // Block removing the last project_manager
  if (member.project_role === "project_manager") {
    const { count, error: countError } = await supabaseAdmin
      .from("project_members")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("project_role", "project_manager")
      .is("removed_at", null);

    if (countError) {
      throw new AppError(500, "DATABASE_ERROR", "Failed to validate project manager count.");
    }

    if ((count ?? 0) <= 1) {
      throw new AppError(400, "LAST_PROJECT_MANAGER", "Cannot remove the last project manager from a project.");
    }
  }

  const reason = typeof input.reason === "string" ? input.reason.trim() || null : null;

  const { error } = await supabaseAdmin
    .from("project_members")
    .update({
      removed_at: new Date().toISOString(),
      removed_by: user.id,
      removed_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId)
    .eq("project_id", projectId)
    .is("removed_at", null);

  if (error) {
    throw new AppError(500, "MEMBER_REMOVE_FAILED", "Failed to remove member.");
  }

  await logActivity({
    actorUserId: user.id,
    action: "project_member_removed",
    entityType: "project",
    entityId: projectId,
    metadata: {
      projectId,
      projectName: project.name,
      memberId,
      targetUserId: member.user_id,
      targetUserName: member.user?.name ?? "",
      projectRole: member.project_role,
    },
  });

  await notifyProjectMemberRemoved(
    {
      projectId,
      projectName: project.name,
      actorUserId: user.id,
    },
    member.user_id
  );
}
