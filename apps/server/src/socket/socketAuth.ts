import { parse } from "cookie";
import type { Socket } from "socket.io";
import { supabaseAdmin } from "../config/supabaseAdmin.js";
import type { AuthUser, UserRole } from "../types/auth.js";
import { verifyAccessToken } from "../utils/jwt.js";

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

function getSocketCookieToken(socket: Socket): string | null {
  const rawCookie = socket.handshake.headers.cookie;
  if (!rawCookie) return null;

  const cookieName = process.env.AUTH_COOKIE_NAME || "veyra_access_token";
  const cookies = parse(rawCookie);
  return cookies[cookieName] ?? null;
}

export async function authenticateSocket(socket: Socket): Promise<AuthUser> {
  const token = getSocketCookieToken(socket);

  if (!token) {
    throw new Error("UNAUTHORIZED");
  }

  const payload = verifyAccessToken(token);

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, name, email, role, is_active, must_reset_password, token_version, deleted_at")
    .eq("id", payload.sub)
    .maybeSingle();

  if (error || !data) {
    throw new Error("UNAUTHORIZED");
  }

  const user = data as AppUserAuthRow;

  if (!user.is_active || user.deleted_at || user.token_version !== payload.tokenVersion) {
    throw new Error("UNAUTHORIZED");
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tokenVersion: user.token_version,
    mustResetPassword: user.must_reset_password,
  };
}
