import { Router } from "express";
import {
  handleGenerateDeadlineAlerts,
  handleGetUnreadNotificationCount,
  handleListNotifications,
  handleMarkAllNotificationsAsRead,
  handleMarkNotificationAsRead,
} from "../controllers/notificationController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List notifications for the authenticated user
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of notifications to return
 *     responses:
 *       200:
 *         description: Notification list
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
 *                     notifications:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Notification'
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Internal server error
 */
router.get("/", asyncHandler(handleListNotifications));
/**
 * @openapi
 * /notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get the count of unread notifications
 *     responses:
 *       200:
 *         description: Unread count
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
 *                     unreadCount:
 *                       type: integer
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Internal server error
 */
router.get("/unread-count", asyncHandler(handleGetUnreadNotificationCount));
/**
 * @openapi
 * /notifications/generate-deadline-alerts:
 *   post:
 *     tags: [Notifications]
 *     summary: Trigger generation of deadline-approaching alerts for the authenticated user
 *     responses:
 *       200:
 *         description: Alerts generated
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
 *                     createdCount:
 *                       type: integer
 *                     notificationsCreated:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Notification'
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Internal server error
 */
router.post("/generate-deadline-alerts", asyncHandler(handleGenerateDeadlineAlerts));
/**
 * @openapi
 * /notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read
 *     responses:
 *       200:
 *         description: All notifications marked read
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
 *                     updatedCount:
 *                       type: integer
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Internal server error
 */
router.patch("/read-all", asyncHandler(handleMarkAllNotificationsAsRead));
/**
 * @openapi
 * /notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark a single notification as read
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Notification marked read
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
 *                     notification:
 *                       $ref: '#/components/schemas/Notification'
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:id/read", asyncHandler(handleMarkNotificationAsRead));

export default router;
