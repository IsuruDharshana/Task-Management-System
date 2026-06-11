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

router.get("/:taskId", asyncHandler(handleGetTask));
router.get("/:taskId/comments", asyncHandler(listComments));
router.post("/:taskId/comments", asyncHandler(createComment));
router.get("/:taskId/attachments", asyncHandler(listAttachments));
router.post("/:taskId/attachments", attachmentUpload.single("file"), asyncHandler(createAttachment));
router.patch("/:taskId", asyncHandler(handleUpdateTask));
router.delete("/:taskId", asyncHandler(handleDeleteTask));
router.post("/:taskId/assignees", asyncHandler(handleAddTaskAssignee));
router.delete("/:taskId/assignees/:userId", asyncHandler(handleRemoveTaskAssignee));

export default router;
