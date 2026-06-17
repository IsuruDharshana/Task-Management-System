import { Router } from "express";
import { handleGetDashboardSummary } from "../controllers/dashboardController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireAuth);
router.get("/summary", asyncHandler(handleGetDashboardSummary));

export default router;
