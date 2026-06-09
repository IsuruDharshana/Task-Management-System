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

router.patch("/:commentId", asyncHandler(handleUpdateTaskComment));
router.delete("/:commentId", asyncHandler(handleDeleteTaskComment));

export default router;
