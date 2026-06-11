import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError } from "../utils/appError.js";

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (
    error instanceof SyntaxError &&
    "body" in error
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body contains invalid JSON.",
        details: null,
      },
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details ?? null,
      },
    });
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Attachment file must not exceed 10 MB."
        : "Invalid attachment upload.";

    return res.status(400).json({
      success: false,
      error: {
        code: error.code,
        message,
        details: null,
      },
    });
  }

  console.error(error);

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong.",
      details: null,
    },
  });
}
