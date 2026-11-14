import { Router } from "express";
import {
  getBudgetAnalyticsReport,
  getCategoryAnalytics,
  getCategoryComparisonAnalytics,
  getDailyAnalytics,
  getIncomeExpense,
  getMerchantAnalytics,
  getMonthlyAnalytics,
  getPeriodComparisonAnalytics,
  getSavingsAnalyticsReport,
  getSubscriptionAnalyticsReport,
  getAnalyticsSummary,
  getWalletAnalytics,
} from "../controllers/analyticsController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { analyticsQuery, comparisonQuery } from "../validators/schemas.js";

const router = Router();
router.use(requireAuth);
router.get("/summary", validate({ query: analyticsQuery }), getAnalyticsSummary);
router.get("/income-expense", validate({ query: analyticsQuery }), getIncomeExpense);
router.get("/categories/comparison", validate({ query: comparisonQuery }), getCategoryComparisonAnalytics);
router.get("/categories", validate({ query: analyticsQuery }), getCategoryAnalytics);
router.get("/wallets", validate({ query: analyticsQuery }), getWalletAnalytics);
router.get("/daily", validate({ query: analyticsQuery }), getDailyAnalytics);
router.get("/monthly", validate({ query: analyticsQuery }), getMonthlyAnalytics);
router.get("/merchants", validate({ query: analyticsQuery }), getMerchantAnalytics);
router.get("/comparison", validate({ query: comparisonQuery }), getPeriodComparisonAnalytics);
router.get("/budgets", validate({ query: analyticsQuery }), getBudgetAnalyticsReport);
router.get("/savings", validate({ query: analyticsQuery }), getSavingsAnalyticsReport);
router.get("/subscriptions", validate({}), getSubscriptionAnalyticsReport);

export default router;
