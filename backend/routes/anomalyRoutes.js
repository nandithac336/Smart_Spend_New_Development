import { Router } from "express";
import {
  checkTransaction,
  detectAnomalies,
  getAnomaly,
  getAnomalySummary,
  listAnomalies,
  updateAnomalyStatus,
} from "../controllers/anomalyController.js";
import { requireAuth } from "../middleware/auth.js";
import { anomalyLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import {
  anomalyDetectSchema,
  anomalyIdParam,
  anomalyListQuery,
  anomalyStatusSchema,
  anomalyTransactionParam,
} from "../validators/schemas.js";

const router = Router();
router.use(requireAuth);
router.post("/detect", anomalyLimiter, validate({ body: anomalyDetectSchema }), detectAnomalies);
router.get("/summary", validate({}), getAnomalySummary);
router.get("/", validate({ query: anomalyListQuery }), listAnomalies);
router.get("/:id", validate({ params: anomalyIdParam }), getAnomaly);
router.patch(
  "/:id/status",
  validate({ params: anomalyIdParam, body: anomalyStatusSchema }),
  updateAnomalyStatus
);
router.post(
  "/transactions/:transactionId/check",
  anomalyLimiter,
  validate({ params: anomalyTransactionParam }),
  checkTransaction
);

export default router;
