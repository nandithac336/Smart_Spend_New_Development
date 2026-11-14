import { Router } from "express";
import {
  addGoalContribution,
  archiveGoal,
  createGoal,
  getGoal,
  getGoalProgressById,
  getGoalsSummary,
  listGoalContributionHistory,
  listGoals,
  pauseGoal,
  resumeGoal,
  updateGoal,
  withdrawGoalAmount,
} from "../controllers/goalController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createGoalSchema,
  goalIdParam,
  goalListQuery,
  goalTransactionSchema,
  updateGoalSchema,
} from "../validators/schemas.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate({ query: goalListQuery }), listGoals);
router.post("/", validate({ body: createGoalSchema }), createGoal);
router.get("/summary", getGoalsSummary);
router.get("/:id/progress", validate({ params: goalIdParam }), getGoalProgressById);
router.get("/:id/contributions", validate({ params: goalIdParam }), listGoalContributionHistory);
router.post("/:id/contributions", validate({ params: goalIdParam, body: goalTransactionSchema }), addGoalContribution);
router.post("/:id/withdrawals", validate({ params: goalIdParam, body: goalTransactionSchema }), withdrawGoalAmount);
router.patch("/:id/pause", validate({ params: goalIdParam }), pauseGoal);
router.patch("/:id/resume", validate({ params: goalIdParam }), resumeGoal);
router.get("/:id", validate({ params: goalIdParam }), getGoal);
router.patch("/:id", validate({ params: goalIdParam, body: updateGoalSchema }), updateGoal);
router.delete("/:id", validate({ params: goalIdParam }), archiveGoal);

export default router;
