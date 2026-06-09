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
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireRoles } from "../middlewares/roleMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireAuth);
router.use(requireRoles("project_manager", "collaborator"));

router.get("/:taskId", asyncHandler(handleGetTask));
router.get("/:taskId/comments", asyncHandler(listComments));
router.post("/:taskId/comments", asyncHandler(createComment));
router.patch("/:taskId", asyncHandler(handleUpdateTask));
router.delete("/:taskId", asyncHandler(handleDeleteTask));
router.post("/:taskId/assignees", asyncHandler(handleAddTaskAssignee));
router.delete("/:taskId/assignees/:userId", asyncHandler(handleRemoveTaskAssignee));

export default router;
