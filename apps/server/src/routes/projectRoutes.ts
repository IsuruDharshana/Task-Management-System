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

/**
 * @openapi
 * /projects:
 *   post:
 *     tags: [Projects]
 *     summary: Create a new project (project_manager only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *                 nullable: true
 *               status:
 *                 type: string
 *                 enum: [active, completed, archived]
 *               start_date:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               due_date:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Project created
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
 *                     project:
 *                       $ref: '#/components/schemas/Project'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient role
 *       500:
 *         description: Internal server error
 */
router.post("/", requireRoles("project_manager"), asyncHandler(handleCreateProject));
/**
 * @openapi
 * /projects:
 *   get:
 *     tags: [Projects]
 *     summary: List all projects the authenticated user belongs to
 *     responses:
 *       200:
 *         description: Project list
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
 *                     projects:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Project'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient role
 *       500:
 *         description: Internal server error
 */
router.get("/", asyncHandler(handleListProjects));

// Task routes

/**
 * @openapi
 * /projects/{projectId}/tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: List tasks for a project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [to_do, in_progress, completed]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *       - in: query
 *         name: assigneeId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [due_date, priority, created_at]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Task list
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
 *                     tasks:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Task'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient role or not a member
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
router.get("/:projectId/tasks", asyncHandler(handleListProjectTasks));
/**
 * @openapi
 * /projects/{projectId}/tasks:
 *   post:
 *     tags: [Tasks]
 *     summary: Create a task in a project
 *     parameters:
 *       - in: path
 *         name: projectId
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
 *             required: [title]
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
 *               assignee_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       201:
 *         description: Task created
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
 *         description: Insufficient role or not a member
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
router.post("/:projectId/tasks", asyncHandler(handleCreateProjectTask));

/**
 * @openapi
 * /projects/{projectId}:
 *   get:
 *     tags: [Projects]
 *     summary: Get a single project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Project record
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
 *                     project:
 *                       $ref: '#/components/schemas/Project'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient role or not a member
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
router.get("/:projectId", asyncHandler(handleGetProject));
/**
 * @openapi
 * /projects/{projectId}:
 *   patch:
 *     tags: [Projects]
 *     summary: Update a project
 *     parameters:
 *       - in: path
 *         name: projectId
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *                 nullable: true
 *               status:
 *                 type: string
 *                 enum: [active, completed, archived]
 *               start_date:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               due_date:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Project updated
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
 *                     project:
 *                       $ref: '#/components/schemas/Project'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient role or not a member
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:projectId", asyncHandler(handleUpdateProject));
/**
 * @openapi
 * /projects/{projectId}:
 *   delete:
 *     tags: [Projects]
 *     summary: Delete a project
 *     parameters:
 *       - in: path
 *         name: projectId
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
 *         description: Project deleted
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
 *         description: Insufficient role or not a member
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:projectId", asyncHandler(handleDeleteProject));

// Member routes

/**
 * @openapi
 * /projects/{projectId}/eligible-members:
 *   get:
 *     tags: [Members]
 *     summary: List users who can be added as members to a project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Eligible user list
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
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/EligibleMember'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient role
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
router.get("/:projectId/eligible-members", asyncHandler(handleListEligibleMembers));
/**
 * @openapi
 * /projects/{projectId}/members:
 *   get:
 *     tags: [Members]
 *     summary: List members of a project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Member list
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
 *                     members:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Member'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient role
 *       404:
 *         description: Project not found
 *       500:
 *         description: Internal server error
 */
router.get("/:projectId/members", asyncHandler(handleListMembers));
/**
 * @openapi
 * /projects/{projectId}/members:
 *   post:
 *     tags: [Members]
 *     summary: Add a member to a project
 *     parameters:
 *       - in: path
 *         name: projectId
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
 *             required: [user_id, project_role]
 *             properties:
 *               user_id:
 *                 type: string
 *                 format: uuid
 *               project_role:
 *                 type: string
 *                 enum: [project_manager, collaborator]
 *               project_label:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Member added
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
 *                     member:
 *                       $ref: '#/components/schemas/Member'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient role
 *       404:
 *         description: Project or user not found
 *       409:
 *         description: User already a member
 *       500:
 *         description: Internal server error
 */
router.post("/:projectId/members", asyncHandler(handleAddMember));
/**
 * @openapi
 * /projects/{projectId}/members/{memberId}:
 *   patch:
 *     tags: [Members]
 *     summary: Update a project member's role or label
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: memberId
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
 *               project_role:
 *                 type: string
 *                 enum: [project_manager, collaborator]
 *               project_label:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Member updated
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
 *                     member:
 *                       $ref: '#/components/schemas/Member'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Insufficient role
 *       404:
 *         description: Project or member not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:projectId/members/:memberId", asyncHandler(handleUpdateMember));
/**
 * @openapi
 * /projects/{projectId}/members/{memberId}:
 *   delete:
 *     tags: [Members]
 *     summary: Remove a member from a project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: memberId
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
 *         description: Member removed
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
 *         description: Insufficient role
 *       404:
 *         description: Project or member not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:projectId/members/:memberId", asyncHandler(handleRemoveMember));

export default router;
