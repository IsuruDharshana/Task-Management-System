import { Router } from "express";
import {
  handleAddTaskAssignee,
  handleDeleteTask,
  handleGetTask,
  handleRemoveTaskAssignee,
  handleUpdateTask,
} from "../controllers/taskController.js";
import {
  handleCreateTaskComment as createComment,
  handleListTaskComments as listComments,
} from "../controllers/commentController.js";
import {
  handleCreateTaskAttachment as createAttachment,
  handleListTaskAttachments as listAttachments,
} from "../controllers/attachmentController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireRoles } from "../middlewares/roleMiddleware.js";
import { attachmentUpload } from "./attachmentRoutes.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireAuth);
router.use(requireRoles("project_manager", "collaborator"));

/**
 * @openapi
 * /tasks/{taskId}:
 *   get:
 *     tags: [Tasks]
 *     summary: Get a single task
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Task record
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
 *                     task:
 *                       $ref: '#/components/schemas/Task'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient role or not a project member
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
router.get("/:taskId", asyncHandler(handleGetTask));
/**
 * @openapi
 * /tasks/{taskId}/comments:
 *   get:
 *     tags: [Comments]
 *     summary: List comments on a task
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Comment list
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
 *                     comments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TaskComment'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient role or not a project member
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
router.get("/:taskId/comments", asyncHandler(listComments));
/**
 * @openapi
 * /tasks/{taskId}/comments:
 *   post:
 *     tags: [Comments]
 *     summary: Add a comment to a task
 *     parameters:
 *       - in: path
 *         name: taskId
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
 *       201:
 *         description: Comment created
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
 *         description: Insufficient role or not a project member
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
router.post("/:taskId/comments", asyncHandler(createComment));
/**
 * @openapi
 * /tasks/{taskId}/attachments:
 *   get:
 *     tags: [Attachments]
 *     summary: List attachments on a task
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Attachment list
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
 *                     attachments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TaskAttachment'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient role or not a project member
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
router.get("/:taskId/attachments", asyncHandler(listAttachments));
/**
 * @openapi
 * /tasks/{taskId}/attachments:
 *   post:
 *     tags: [Attachments]
 *     summary: Upload a file attachment to a task
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               displayName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Attachment uploaded
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
 *                     attachment:
 *                       $ref: '#/components/schemas/TaskAttachment'
 *       400:
 *         description: Unsupported file type or validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient role or not a project member
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
router.post("/:taskId/attachments", attachmentUpload.single("file"), asyncHandler(createAttachment));
/**
 * @openapi
 * /tasks/{taskId}:
 *   patch:
 *     tags: [Tasks]
 *     summary: Update a task
 *     parameters:
 *       - in: path
 *         name: taskId
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
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *                 nullable: true
 *               due_date:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *               status:
 *                 type: string
 *                 enum: [to_do, in_progress, completed]
 *     responses:
 *       200:
 *         description: Task updated
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
 *                     task:
 *                       $ref: '#/components/schemas/Task'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient role or not a project member
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:taskId", asyncHandler(handleUpdateTask));
/**
 * @openapi
 * /tasks/{taskId}:
 *   delete:
 *     tags: [Tasks]
 *     summary: Delete a task
 *     parameters:
 *       - in: path
 *         name: taskId
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
 *         description: Task deleted
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
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:taskId", asyncHandler(handleDeleteTask));
/**
 * @openapi
 * /tasks/{taskId}/assignees:
 *   post:
 *     tags: [Tasks]
 *     summary: Add an assignee to a task
 *     parameters:
 *       - in: path
 *         name: taskId
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
 *             required: [user_id]
 *             properties:
 *               user_id:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Assignee added
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
 *                     assignee:
 *                       $ref: '#/components/schemas/TaskAssignee'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient role or not a project member
 *       404:
 *         description: Task or user not found
 *       409:
 *         description: User already assigned
 *       500:
 *         description: Internal server error
 */
router.post("/:taskId/assignees", asyncHandler(handleAddTaskAssignee));
/**
 * @openapi
 * /tasks/{taskId}/assignees/{userId}:
 *   delete:
 *     tags: [Tasks]
 *     summary: Remove an assignee from a task
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: userId
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
 *         description: Assignee removed
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
 *         description: Task or assignee not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:taskId/assignees/:userId", asyncHandler(handleRemoveTaskAssignee));

export default router;
