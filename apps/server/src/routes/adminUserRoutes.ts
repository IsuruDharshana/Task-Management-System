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

router.get("/", asyncHandler(listAdminUsers));
router.get("/:id", asyncHandler(getAdminUser));
router.post("/", asyncHandler(createAdminUser));
router.patch("/:id", asyncHandler(updateAdminUser));
router.patch("/:id/deactivate", asyncHandler(deactivateAdminUser));
router.patch("/:id/reactivate", asyncHandler(reactivateAdminUser));
router.patch("/:id/reset-password", asyncHandler(resetAdminUserPassword));

export default router;
