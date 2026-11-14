import { Router } from "express";
import {
  getFinancialHealthDetails,
  getFinancialHealthScore,
} from "../controllers/financialHealthController.js";
import { requireAuth } from "../middleware/auth.js";
import { financialHealthLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";

const router = Router();
router.use(requireAuth, financialHealthLimiter);
router.get("/score", validate({}), getFinancialHealthScore);
router.get("/breakdown", validate({}), getFinancialHealthDetails);

export default router;
