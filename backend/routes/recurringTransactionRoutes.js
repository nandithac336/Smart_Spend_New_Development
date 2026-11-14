import { Router } from "express";
import {
  cancelRecurringTransaction,
  createRecurringTransaction,
  deleteRecurringTransaction,
  getRecurringTransaction,
  getRecurringTransactionHistory,
  listRecurringTransactions,
  listUpcomingTransactions,
  pauseRecurringTransaction,
  resumeRecurringTransaction,
  updateRecurringTransaction,
} from "../controllers/recurringTransactionController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createRecurringSchema,
  recurringIdParam,
  recurringListQuery,
  recurringUpcomingQuery,
  updateRecurringSchema,
} from "../validators/schemas.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate({ query: recurringListQuery }), listRecurringTransactions);
router.post("/", validate({ body: createRecurringSchema }), createRecurringTransaction);
router.get("/upcoming", validate({ query: recurringUpcomingQuery }), listUpcomingTransactions);
router.get("/:id/history", validate({ params: recurringIdParam }), getRecurringTransactionHistory);
router.patch("/:id/pause", validate({ params: recurringIdParam }), pauseRecurringTransaction);
router.patch("/:id/resume", validate({ params: recurringIdParam }), resumeRecurringTransaction);
router.patch("/:id/cancel", validate({ params: recurringIdParam }), cancelRecurringTransaction);
router.get("/:id", validate({ params: recurringIdParam }), getRecurringTransaction);
router.patch("/:id", validate({ params: recurringIdParam, body: updateRecurringSchema }), updateRecurringTransaction);
router.delete("/:id", validate({ params: recurringIdParam }), deleteRecurringTransaction);

export default router;
