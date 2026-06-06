import { Router } from "express";
import { login, logout, me, resetOwnPassword } from "../controllers/authController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/login", asyncHandler(login));
router.post("/logout", asyncHandler(logout));
router.get("/me", requireAuth, asyncHandler(me));
router.post("/reset-password", requireAuth, asyncHandler(resetOwnPassword));
router.patch("/change-password", requireAuth, asyncHandler(resetOwnPassword));

export default router;
