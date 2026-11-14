import { Router } from "express";
import {
  getCategoryPredictions,
  getDailyPrediction,
  getMonthlyPrediction,
  getPredictionAccuracy,
  getPredictionOverview,
} from "../controllers/predictionController.js";
import { requireAuth } from "../middleware/auth.js";
import { predictionLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import {
  predictionAccuracyQuery,
  predictionCategoryQuery,
  predictionDailyQuery,
  predictionMonthQuery,
} from "../validators/schemas.js";

const router = Router();
router.use(requireAuth, predictionLimiter);
router.get("/overview", validate({ query: predictionMonthQuery }), getPredictionOverview);
router.get("/monthly", validate({ query: predictionMonthQuery }), getMonthlyPrediction);
router.get("/categories", validate({ query: predictionCategoryQuery }), getCategoryPredictions);
router.get("/daily", validate({ query: predictionDailyQuery }), getDailyPrediction);
router.get("/accuracy", validate({ query: predictionAccuracyQuery }), getPredictionAccuracy);

export default router;
