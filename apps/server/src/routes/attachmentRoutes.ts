import { Router } from "express";
import multer from "multer";
import {
  handleCreateAttachmentDownloadUrl,
  handleDeleteTaskAttachment,
} from "../controllers/attachmentController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireRoles } from "../middlewares/roleMiddleware.js";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
} from "../services/attachmentService.js";
import { AppError } from "../utils/appError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_ATTACHMENT_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(file.mimetype)) {
      callback(new AppError(400, "UNSUPPORTED_FILE_TYPE", "Attachment file type is not supported."));
      return;
    }

    callback(null, true);
  },
});

const router = Router();

router.use(requireAuth);
router.use(requireRoles("project_manager", "collaborator"));

router.post("/:attachmentId/download-url", asyncHandler(handleCreateAttachmentDownloadUrl));
router.delete("/:attachmentId", asyncHandler(handleDeleteTaskAttachment));

export default router;
