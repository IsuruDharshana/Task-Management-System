import { Router } from "express";
import { handleListActivityLogs } from "../controllers/activityLogController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireAuth);
router.get("/", asyncHandler(handleListActivityLogs));

export default router;
