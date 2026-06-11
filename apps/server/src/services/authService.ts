import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { AppError } from "../utils/appError.js";
import { hashPassword, validatePasswordPolicy, verifyPassword } from "../utils/password.js";
import { signAccessToken } from "../utils/jwt.js";
import type { AuthUser, UserRole } from "../types/auth.js";
import { logActivity } from "./activityLogService.js";

interface AppUserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  must_reset_password: boolean;
  token_version: number;
  deleted_at: string | null;
}

interface LoginResult {
  token: string;
  user: AuthUser;
}

function mapUser(row: AppUserRow): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    tokenVersion: row.token_version,
    mustResetPassword: row.must_reset_password,
  };
}

function validateEmail(email: string): void {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    throw new AppError(400, "INVALID_EMAIL", "A valid email address is required.");
  }
}

export async function loginUser(email: string, password: string): Promise<LoginResult> {
  if (!email || !password) {
    throw new AppError(400, "MISSING_CREDENTIALS", "Email and password are required.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  validateEmail(normalizedEmail);

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select(
      "id, name, email, password_hash, role, is_active, must_reset_password, token_version, deleted_at"
    )
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to check user credentials.");
  }

  if (!data) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  const user = data as AppUserRow;

  if (!user.is_active || user.deleted_at) {
    throw new AppError(403, "ACCOUNT_DISABLED", "This account is disabled.");
  }

  const passwordMatches = await verifyPassword(password, user.password_hash);

  if (!passwordMatches) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  await supabaseAdmin
    .from("app_users")
    .update({
      last_login_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  const token = signAccessToken({
    sub: user.id,
    role: user.role,
    tokenVersion: user.token_version,
  });

  return {
    token,
    user: mapUser(user),
  };
}

export async function getUserById(userId: string): Promise<AuthUser> {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select(
      "id, name, email, password_hash, role, is_active, must_reset_password, token_version, deleted_at"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load user.");
  }

  if (!data) {
    throw new AppError(401, "USER_NOT_FOUND", "Authenticated user no longer exists.");
  }

  const user = data as AppUserRow;

  if (!user.is_active || user.deleted_at) {
    throw new AppError(403, "ACCOUNT_DISABLED", "This account is disabled.");
  }

  return mapUser(user);
}

export async function resetPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<LoginResult> {
  if (!currentPassword || !newPassword) {
    throw new AppError(
      400,
      "MISSING_PASSWORD_FIELDS",
      "Current password and new password are required."
    );
  }

  validatePasswordPolicy(newPassword);

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select(
      "id, name, email, password_hash, role, is_active, must_reset_password, token_version, deleted_at"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, "DATABASE_ERROR", "Failed to load user.");
  }

  if (!data) {
    throw new AppError(401, "USER_NOT_FOUND", "Authenticated user no longer exists.");
  }

  const user = data as AppUserRow;

  if (!user.is_active || user.deleted_at) {
    throw new AppError(403, "ACCOUNT_DISABLED", "This account is disabled.");
  }

  const passwordMatches = await verifyPassword(currentPassword, user.password_hash);

  if (!passwordMatches) {
    throw new AppError(401, "INVALID_CURRENT_PASSWORD", "Current password is incorrect.");
  }

  const newPasswordHash = await hashPassword(newPassword);
  const nextTokenVersion = user.token_version + 1;

  const { data: updatedUser, error: updateError } = await supabaseAdmin
    .from("app_users")
    .update({
      password_hash: newPasswordHash,
      must_reset_password: false,
      token_version: nextTokenVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select(
      "id, name, email, password_hash, role, is_active, must_reset_password, token_version, deleted_at"
    )
    .single();

  if (updateError || !updatedUser) {
    throw new AppError(500, "PASSWORD_RESET_FAILED", "Failed to reset password.");
  }

  const updated = updatedUser as AppUserRow;
  const action = user.must_reset_password
    ? "first_login_password_reset_completed"
    : "own_password_changed";

  await logActivity({
    actorUserId: updated.id,
    action,
    entityType: "account",
    entityId: updated.id,
    metadata: {
      message:
        action === "first_login_password_reset_completed"
          ? "User completed first login password reset"
          : "User changed own password",
    },
  });

  const token = signAccessToken({
    sub: updated.id,
    role: updated.role,
    tokenVersion: updated.token_version,
  });

  return {
    token,
    user: mapUser(updated),
  };
}
