import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { env } from "../config/env.js";
import { sendPasswordResetEmail, sendUserOnboardingEmail } from "./emailService.js";
import type { UserRole } from "../types/auth.js";
import { AppError } from "../utils/appError.js";
import { generateTemporaryPassword, hashPassword } from "../utils/password.js";
import { logActivity } from "./activityLogService.js";

type AdminCreatableRole = "project_manager" | "collaborator";
type UserStatusFilter = "active" | "inactive" | "all";

interface AppUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  must_reset_password: boolean;
  token_version: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustResetPassword: boolean;
  tokenVersion: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ListUsersParams {
  search?: unknown;
  role?: unknown;
  status?: unknown;
}

interface CreateUserInput {
  name?: unknown;
  email?: unknown;
  role?: unknown;
}

interface UpdateUserInput {
  name?: unknown;
  email?: unknown;
  role?: unknown;
}

const USER_SELECT =
  "id, name, email, role, is_active, must_reset_password, token_version, last_login_at, created_at, updated_at, deleted_at";

const VALID_ROLES: UserRole[] = ["admin", "project_manager", "collaborator"];
const ADMIN_CREATABLE_ROLES: AdminCreatableRole[] = ["project_manager", "collaborator"];
const VALID_STATUSES: UserStatusFilter[] = ["active", "inactive", "all"];

function mapUser(row: AppUserRow): AdminUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    mustResetPassword: row.must_reset_password,
    tokenVersion: row.token_version,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function normalizeName(name: unknown): string {
  if (typeof name !== "string" || !name.trim()) {
    throw new AppError(400, "INVALID_NAME", "Name is required.");
  }

  return name.trim();
}

function normalizeEmail(email: unknown): string {
  if (typeof email !== "string" || !email.trim()) {
    throw new AppError(400, "INVALID_EMAIL", "A valid email address is required.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(normalizedEmail)) {
    throw new AppError(400, "INVALID_EMAIL", "A valid email address is required.");
  }

  return normalizedEmail;
}

function normalizeCreatableRole(role: unknown): AdminCreatableRole {
  if (
    typeof role !== "string" ||
    !ADMIN_CREATABLE_ROLES.includes(role as AdminCreatableRole)
  ) {
    throw new AppError(
      400,
      "INVALID_ROLE",
      "Role must be project_manager or collaborator."
    );
  }

  return role as AdminCreatableRole;
}

function normalizeRoleFilter(role: unknown): UserRole | undefined {
  if (role === undefined || role === null || role === "") {
    return undefined;
  }

  if (typeof role !== "string" || !VALID_ROLES.includes(role as UserRole)) {
    throw new AppError(
      400,
      "INVALID_ROLE_FILTER",
      "Role must be admin, project_manager, or collaborator."
    );
  }

  return role as UserRole;
}

function normalizeStatusFilter(status: unknown): UserStatusFilter {
  if (status === undefined || status === null || status === "") {
    return "all";
  }

  if (typeof status !== "string" || !VALID_STATUSES.includes(status as UserStatusFilter)) {
    throw new AppError(400, "INVALID_STATUS_FILTER", "Status must be active, inactive, or all.");
  }

  return status as UserStatusFilter;
}

function normalizeSearch(search: unknown): string | undefined {
  if (search === undefined || search === null) {
    return undefined;
  }

  if (typeof search !== "string") {
    throw new AppError(400, "INVALID_SEARCH", "Search must be a string.");
  }

  const trimmed = search.trim();
  return trimmed || undefined;
}

async function ensureEmailIsUnique(email: string, excludedUserId?: string): Promise<void> {
  let query = supabaseAdmin.from("app_users").select("id").eq("email", email).limit(1);

  if (excludedUserId) {
    query = query.neq("id", excludedUserId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to validate email uniqueness.");
  }

  if (data) {
    throw new AppError(409, "EMAIL_ALREADY_EXISTS", "A user with this email already exists.");
  }
}

async function getExistingUser(userId: string): Promise<AppUserRow> {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select(USER_SELECT)
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load user.");
  }

  if (!data) {
    throw new AppError(404, "USER_NOT_FOUND", "User was not found.");
  }

  return data as AppUserRow;
}

function assertNotSelf(targetUserId: string, adminUserId: string, code: string, message: string): void {
  if (targetUserId === adminUserId) {
    throw new AppError(400, code, message);
  }
}

export async function listUsers(params: ListUsersParams): Promise<AdminUser[]> {
  const search = normalizeSearch(params.search);
  const role = normalizeRoleFilter(params.role);
  const status = normalizeStatusFilter(params.status);

  let query = supabaseAdmin
    .from("app_users")
    .select(USER_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  if (role) {
    query = query.eq("role", role);
  }

  if (status !== "all") {
    query = query.eq("is_active", status === "active");
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to list users.");
  }

  return ((data ?? []) as AppUserRow[]).map(mapUser);
}

export async function getUserByIdForAdmin(userId: string): Promise<AdminUser> {
  const user = await getExistingUser(userId);
  return mapUser(user);
}

export async function createUserByAdmin(
  input: CreateUserInput,
  adminUserId: string
): Promise<{ user: AdminUser; emailSent: boolean }> {
  const name = normalizeName(input.name);
  const email = normalizeEmail(input.email);
  const role = normalizeCreatableRole(input.role);

  await ensureEmailIsUnique(email);

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .insert({
      name,
      email,
      role,
      password_hash: passwordHash,
      is_active: true,
      must_reset_password: true,
      token_version: 1,
    })
    .select(USER_SELECT)
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      throw new AppError(409, "EMAIL_ALREADY_EXISTS", "A user with this email already exists.");
    }

    throw new AppError(500, "USER_CREATE_FAILED", "Failed to create user.");
  }

  const user = mapUser(data as AppUserRow);
  const loginUrl = `${env.clientUrl}/login`;

  let emailSent = true;

  try {
    await sendUserOnboardingEmail({
      to: user.email,
      name: user.name,
      temporaryPassword,
      loginUrl,
    });
} catch (emailError) {
  emailSent = false;
  console.error("Failed to send Veyra onboarding email.", emailError);
}

  await logActivity({
    actorUserId: adminUserId,
    action: "admin_user_created",
    entityType: "user",
    entityId: user.id,
    metadata: {
      targetUserId: user.id,
      targetUserName: user.name,
      targetUserRole: user.role,
      emailSent,
    },
  });

  return {
    user,
    emailSent,
  };
}

export async function updateUserByAdmin(
  userId: string,
  input: UpdateUserInput,
  adminUserId: string
): Promise<AdminUser> {
  const existingUser = await getExistingUser(userId);
  const updates: Partial<Pick<AppUserRow, "name" | "email" | "role" | "updated_at">> = {};

  if (input.name !== undefined) {
    updates.name = normalizeName(input.name);
  }

  if (input.email !== undefined) {
    const email = normalizeEmail(input.email);

    if (email !== existingUser.email) {
      await ensureEmailIsUnique(email, userId);
    }

    updates.email = email;
  }

  if (input.role !== undefined) {
    updates.role = normalizeCreatableRole(input.role);
  }

  if (!updates.name && !updates.email && !updates.role) {
    throw new AppError(400, "NO_UPDATE_FIELDS", "At least one editable field is required.");
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .update(updates)
    .eq("id", userId)
    .is("deleted_at", null)
    .select(USER_SELECT)
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      throw new AppError(409, "EMAIL_ALREADY_EXISTS", "A user with this email already exists.");
    }

    throw new AppError(500, "USER_UPDATE_FAILED", "Failed to update user.");
  }

  const user = mapUser(data as AppUserRow);
  await logActivity({
    actorUserId: adminUserId,
    action: "admin_user_updated",
    entityType: "user",
    entityId: user.id,
    metadata: {
      targetUserId: user.id,
      targetUserName: user.name,
      targetUserRole: user.role,
      changedFields: Object.keys(updates).filter((field) => field !== "updated_at"),
    },
  });

  return user;
}

export async function deactivateUserByAdmin(
  userId: string,
  adminUserId: string
): Promise<AdminUser> {
  assertNotSelf(
    userId,
    adminUserId,
    "CANNOT_DEACTIVATE_SELF",
    "Admins cannot deactivate their own account."
  );

  const existingUser = await getExistingUser(userId);

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .update({
      is_active: false,
      token_version: existingUser.token_version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .is("deleted_at", null)
    .select(USER_SELECT)
    .single();

  if (error || !data) {
    throw new AppError(500, "USER_DEACTIVATE_FAILED", "Failed to deactivate user.");
  }

  const user = mapUser(data as AppUserRow);
  await logActivity({
    actorUserId: adminUserId,
    action: "admin_user_deactivated",
    entityType: "user",
    entityId: user.id,
    metadata: { targetUserId: user.id, targetUserName: user.name, targetUserRole: user.role },
  });

  return user;
}

export async function reactivateUserByAdmin(userId: string, adminUserId: string): Promise<AdminUser> {
  await getExistingUser(userId);

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .update({
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .is("deleted_at", null)
    .select(USER_SELECT)
    .single();

  if (error || !data) {
    throw new AppError(500, "USER_REACTIVATE_FAILED", "Failed to reactivate user.");
  }

  const user = mapUser(data as AppUserRow);
  await logActivity({
    actorUserId: adminUserId,
    action: "admin_user_reactivated",
    entityType: "user",
    entityId: user.id,
    metadata: { targetUserId: user.id, targetUserName: user.name, targetUserRole: user.role },
  });

  return user;
}

export async function resetUserPasswordByAdmin(
  userId: string,
  adminUserId: string
): Promise<{ user: AdminUser }> {
  assertNotSelf(
    userId,
    adminUserId,
    "CANNOT_RESET_OWN_PASSWORD",
    "Admins cannot reset their own password through this endpoint."
  );

  const existingUser = await getExistingUser(userId);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .update({
      password_hash: passwordHash,
      must_reset_password: true,
      token_version: existingUser.token_version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .is("deleted_at", null)
    .select(USER_SELECT)
    .single();

  if (error || !data) {
    throw new AppError(500, "PASSWORD_RESET_FAILED", "Failed to reset user password.");
  }

  const user = mapUser(data as AppUserRow);
  const loginUrl = `${env.clientUrl}/login`;

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      temporaryPassword,
      loginUrl,
    });
  } catch (emailError) {
    console.error("Failed to send Veyra password reset email.", emailError);
  }

  await logActivity({
    actorUserId: adminUserId,
    action: "admin_user_password_reset",
    entityType: "user",
    entityId: user.id,
    metadata: { targetUserId: user.id, targetUserName: user.name, targetUserRole: user.role },
  });

  return {
    user,
  };
}
