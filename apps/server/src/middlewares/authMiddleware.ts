import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../config/supabaseAdmin.js";
import { AppError } from "../utils/appError.js";
import { verifyAccessToken } from "../utils/jwt.js";
import type { AuthUser, UserRole } from "../types/auth.js";

interface AppUserAuthRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  must_reset_password: boolean;
  token_version: number;
  deleted_at: string | null;
}

function getTokenFromRequest(req: Request): string | null {
  const cookieName = process.env.AUTH_COOKIE_NAME || "veyra_access_token";
  const cookieToken = req.cookies?.[cookieName];

  if (cookieToken) {
    return cookieToken;
  }

  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length);
  }

  return null;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
    }

    const payload = verifyAccessToken(token);

    const { data, error } = await supabaseAdmin
      .from("app_users")
      .select("id, name, email, role, is_active, must_reset_password, token_version, deleted_at")
      .eq("id", payload.sub)
      .maybeSingle();

    if (error) {
      throw new AppError(500, "DATABASE_ERROR", "Failed to verify authentication.");
    }

    if (!data) {
      throw new AppError(401, "USER_NOT_FOUND", "Authenticated user no longer exists.");
    }

    const user = data as AppUserAuthRow;

    if (!user.is_active || user.deleted_at) {
      throw new AppError(403, "ACCOUNT_DISABLED", "This account is disabled.");
    }

    if (user.token_version !== payload.tokenVersion) {
      throw new AppError(401, "TOKEN_REVOKED", "Session is no longer valid.");
    }

    const authUser: AuthUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tokenVersion: user.token_version,
      mustResetPassword: user.must_reset_password,
    };

    req.user = authUser;
    next();
  } catch (error) {
    next(error);
  }
}