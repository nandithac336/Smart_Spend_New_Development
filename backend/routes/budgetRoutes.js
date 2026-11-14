import { Router } from "express";
import {
  archiveBudget,
  createBudget,
  getBudget,
  getBudgetProgressById,
  getBudgetsSummary,
  listBudgets,
  updateBudget,
} from "../controllers/budgetController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  budgetIdParam,
  budgetListQuery,
  createBudgetSchema,
  updateBudgetSchema,
} from "../validators/schemas.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate({ query: budgetListQuery }), listBudgets);
router.post("/", validate({ body: createBudgetSchema }), createBudget);
router.get("/summary", validate({ query: budgetListQuery }), getBudgetsSummary);
router.get("/:id/progress", validate({ params: budgetIdParam }), getBudgetProgressById);
router.get("/:id", validate({ params: budgetIdParam }), getBudget);
router.patch("/:id", validate({ params: budgetIdParam, body: updateBudgetSchema }), updateBudget);
router.delete("/:id", validate({ params: budgetIdParam }), archiveBudget);

export default router;
