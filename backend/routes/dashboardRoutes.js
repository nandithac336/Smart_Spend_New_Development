import { Router } from "express";
import { getDashboard } from "../controllers/dashboardController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { dashboardQuery } from "../validators/schemas.js";

const router = Router();
router.get("/", requireAuth, validate({ query: dashboardQuery }), getDashboard);

export default router;
