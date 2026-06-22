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

/**
 * @openapi
 * /attachments/{attachmentId}/download-url:
 *   post:
 *     tags: [Attachments]
 *     summary: Generate a signed download URL for an attachment
 *     parameters:
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Signed URL generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     signedUrl:
 *                       type: string
 *                       format: uri
 *                     expiresIn:
 *                       type: integer
 *                       description: Seconds until the URL expires
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient role or not a project member
 *       404:
 *         description: Attachment not found
 *       500:
 *         description: Internal server error
 */
router.post("/:attachmentId/download-url", asyncHandler(handleCreateAttachmentDownloadUrl));
/**
 * @openapi
 * /attachments/{attachmentId}:
 *   delete:
 *     tags: [Attachments]
 *     summary: Delete an attachment
 *     parameters:
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Attachment deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient role or not a project member
 *       404:
 *         description: Attachment not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:attachmentId", asyncHandler(handleDeleteTaskAttachment));

export default router;
