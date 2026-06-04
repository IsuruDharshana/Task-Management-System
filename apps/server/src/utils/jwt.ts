import jwt, { type SignOptions } from "jsonwebtoken";
import { AppError } from "./appError.js";
import type { UserRole } from "../types/auth.js";

const allowedRoles: UserRole[] = ["admin", "project_manager", "collaborator"];

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  tokenVersion: number;
  type: "access";
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("Missing JWT_SECRET environment variable");
  }

  return secret;
}

export function signAccessToken(payload: Omit<AccessTokenPayload, "type">): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN || "1d") as SignOptions["expiresIn"];

  return jwt.sign(
    {
      ...payload,
      type: "access",
    },
    getJwtSecret(),
    {
      expiresIn,
    }
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (!decoded || typeof decoded !== "object") {
      throw new AppError(401, "INVALID_TOKEN", "Invalid authentication token.");
    }

    const payload = decoded as Partial<AccessTokenPayload>;

    if (
      payload.type !== "access" ||
      typeof payload.sub !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.tokenVersion !== "number" ||
      !allowedRoles.includes(payload.role as UserRole)
    ) {
      throw new AppError(401, "INVALID_TOKEN", "Invalid authentication token.");
    }

    return {
      sub: payload.sub,
      role: payload.role as UserRole,
      tokenVersion: payload.tokenVersion,
      type: "access",
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(401, "INVALID_TOKEN", "Invalid or expired authentication token.");
  }
}
