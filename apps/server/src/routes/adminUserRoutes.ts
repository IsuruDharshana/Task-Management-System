import { Router } from "express";
import {
  createAdminUser,
  deactivateAdminUser,
  getAdminUser,
  listAdminUsers,
  reactivateAdminUser,
  resetAdminUserPassword,
  updateAdminUser,
} from "../controllers/adminUserController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireRoles } from "../middlewares/roleMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireAuth);
router.use(requireRoles("admin"));

/**
 * @openapi
 * /admin/users:
 *   get:
 *     tags: [Admin — Users]
 *     summary: List all users (admin only)
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, project_manager, collaborator]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *     responses:
 *       200:
 *         description: User list
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
 *                         $ref: '#/components/schemas/AdminUser'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not an admin
 *       500:
 *         description: Internal server error
 */
router.get("/", asyncHandler(listAdminUsers));
/**
 * @openapi
 * /admin/users/{id}:
 *   get:
 *     tags: [Admin — Users]
 *     summary: Get a single user by ID (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User record
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
 *                     user:
 *                       $ref: '#/components/schemas/AdminUser'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not an admin
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", asyncHandler(getAdminUser));
/**
 * @openapi
 * /admin/users:
 *   post:
 *     tags: [Admin — Users]
 *     summary: Create a new user (admin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, role]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [project_manager, collaborator]
 *     responses:
 *       201:
 *         description: User created — welcome email sent with temporary password
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
 *                     user:
 *                       $ref: '#/components/schemas/AdminUser'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not an admin
 *       409:
 *         description: Email already in use
 *       500:
 *         description: Internal server error
 */
router.post("/", asyncHandler(createAdminUser));
/**
 * @openapi
 * /admin/users/{id}:
 *   patch:
 *     tags: [Admin — Users]
 *     summary: Update a user's name, email, or role (admin only)
 *     parameters:
 *       - in: path
 *         name: id
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
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [project_manager, collaborator]
 *     responses:
 *       200:
 *         description: User updated
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
 *                     user:
 *                       $ref: '#/components/schemas/AdminUser'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not an admin
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:id", asyncHandler(updateAdminUser));
/**
 * @openapi
 * /admin/users/{id}/deactivate:
 *   patch:
 *     tags: [Admin — Users]
 *     summary: Deactivate a user account (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User deactivated
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
 *                     user:
 *                       $ref: '#/components/schemas/AdminUser'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not an admin
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:id/deactivate", asyncHandler(deactivateAdminUser));
/**
 * @openapi
 * /admin/users/{id}/reactivate:
 *   patch:
 *     tags: [Admin — Users]
 *     summary: Reactivate a deactivated user account (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User reactivated
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
 *                     user:
 *                       $ref: '#/components/schemas/AdminUser'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not an admin
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:id/reactivate", asyncHandler(reactivateAdminUser));
/**
 * @openapi
 * /admin/users/{id}/reset-password:
 *   patch:
 *     tags: [Admin — Users]
 *     summary: Reset a user's password to a new temporary password (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Password reset — user must change it on next login
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
 *                     user:
 *                       $ref: '#/components/schemas/AdminUser'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not an admin
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:id/reset-password", asyncHandler(resetAdminUserPassword));

export default router;
