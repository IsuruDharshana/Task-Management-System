import type { CookieOptions, Request, Response } from "express";
import { loginUser, resetPassword } from "../services/authService.js";

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "veyra_access_token";

function getAccessTokenCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000,
  };
}

function getClearCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  };
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  const result = await loginUser(email, password);

  res.cookie(AUTH_COOKIE_NAME, result.token, getAccessTokenCookieOptions());

  res.status(200).json({
    success: true,
    message: "Login successful.",
    data: {
      user: result.user,
      mustResetPassword: result.user.mustResetPassword,
    },
  });
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie(AUTH_COOKIE_NAME, getClearCookieOptions());

  res.status(200).json({
    success: true,
    message: "Logout successful.",
  });
}

export async function me(req: Request, res: Response): Promise<void> {
  res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
}

export async function resetOwnPassword(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication is required.",
        details: null,
      },
    });
    return;
  }

  const { currentPassword, newPassword } = req.body;

  const result = await resetPassword(req.user.id, currentPassword, newPassword);

  res.cookie(AUTH_COOKIE_NAME, result.token, getAccessTokenCookieOptions());

  res.status(200).json({
    success: true,
    message: "Password reset successful.",
    data: {
      user: result.user,
    },
  });
}