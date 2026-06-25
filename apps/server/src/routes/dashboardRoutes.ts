import { Router } from "express";
import { handleGetDashboardSummary } from "../controllers/dashboardController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /dashboard/summary:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get aggregated dashboard statistics for the authenticated user
 *     responses:
 *       200:
 *         description: Dashboard summary
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
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalProjects:
 *                           type: integer
 *                         myTasks:
 *                           type: integer
 *                         projectTasks:
 *                           type: integer
 *                         todoTasks:
 *                           type: integer
 *                         inProgressTasks:
 *                           type: integer
 *                         completedTasks:
 *                           type: integer
 *                         dueSoonTasks:
 *                           type: integer
 *                         overdueTasks:
 *                           type: integer
 *                         highPriorityTasks:
 *                           type: integer
 *                         unreadNotifications:
 *                           type: integer
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Internal server error
 */
router.get("/summary", asyncHandler(handleGetDashboardSummary));

export default router;
