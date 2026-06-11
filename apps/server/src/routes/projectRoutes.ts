import { Router } from "express";
import {
  handleCreateProject,
  handleListProjects,
  handleGetProject,
  handleUpdateProject,
  handleDeleteProject,
  handleListMembers,
  handleListEligibleMembers,
  handleAddMember,
  handleUpdateMember,
  handleRemoveMember,
} from "../controllers/projectController.js";
import {
  handleCreateTask as handleCreateProjectTask,
  handleListTasks as handleListProjectTasks,
} from "../controllers/taskController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireRoles } from "../middlewares/roleMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// All project routes require authentication and non-admin role
router.use(requireAuth);
router.use(requireRoles("project_manager", "collaborator"));

// Project routes
router.post("/", requireRoles("project_manager"), asyncHandler(handleCreateProject));
router.get("/", asyncHandler(handleListProjects));

// Task routes
router.get("/:projectId/tasks", asyncHandler(handleListProjectTasks));
router.post("/:projectId/tasks", asyncHandler(handleCreateProjectTask));

router.get("/:projectId", asyncHandler(handleGetProject));
router.patch("/:projectId", asyncHandler(handleUpdateProject));
router.delete("/:projectId", asyncHandler(handleDeleteProject));

// Member routes
router.get("/:projectId/eligible-members", asyncHandler(handleListEligibleMembers));
router.get("/:projectId/members", asyncHandler(handleListMembers));
router.post("/:projectId/members", asyncHandler(handleAddMember));
router.patch("/:projectId/members/:memberId", asyncHandler(handleUpdateMember));
router.delete("/:projectId/members/:memberId", asyncHandler(handleRemoveMember));

export default router;
