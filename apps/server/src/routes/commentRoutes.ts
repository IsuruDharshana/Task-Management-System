import { Router } from "express";
import {
  handleDeleteTaskComment,
  handleUpdateTaskComment,
} from "../controllers/commentController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireRoles } from "../middlewares/roleMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireAuth);
router.use(requireRoles("project_manager", "collaborator"));

/**
 * @openapi
 * /comments/{commentId}:
 *   patch:
 *     tags: [Comments]
 *     summary: Update the text of a comment
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [commentText]
 *             properties:
 *               commentText:
 *                 type: string
 *     responses:
 *       200:
 *         description: Comment updated
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
 *                     comment:
 *                       $ref: '#/components/schemas/TaskComment'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient role or not the comment author
 *       404:
 *         description: Comment not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:commentId", asyncHandler(handleUpdateTaskComment));
/**
 * @openapi
 * /comments/{commentId}:
 *   delete:
 *     tags: [Comments]
 *     summary: Delete a comment
 *     parameters:
 *       - in: path
 *         name: commentId
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
 *         description: Comment deleted
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
 *         description: Insufficient role or not the comment author
 *       404:
 *         description: Comment not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:commentId", asyncHandler(handleDeleteTaskComment));

export default router;
