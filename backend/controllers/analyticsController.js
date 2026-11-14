import { Category } from "../models/Category.js";
import { Wallet } from "../models/Wallet.js";
import {
  getBudgetAnalytics,
  getCategoryBreakdown,
  getCategoryComparison,
  getDailySpending,
  getIncomeExpenseTrend,
  getMerchantAnalysis,
  getOverallSummary,
  getPeriodComparison,
  getSavingsAnalytics,
  getWalletBreakdown,
  resolveAnalyticsWindow,
} from "../services/analyticsService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { getUserSubscriptionSummary } from "../services/subscriptionService.js";

async function validateOwnedFilters(user, query) {
  if (query.walletId && !(await Wallet.exists({ _id: query.walletId, userId: user._id }))) {
    throw ApiError.badRequest("Wallet filter is invalid");
  }
  if (
    query.categoryId &&
    !(await Category.exists({
      _id: query.categoryId,
      $or: [{ userId: null }, { userId: user._id }],
    }))
  ) {
    throw ApiError.badRequest("Category filter is invalid");
  }
}

function endpoint(handler) {
  return asyncHandler(async (req, res) => {
    const query = req.validated?.query || {};
    await validateOwnedFilters(req.user, query);
    res.json({ success: true, data: await handler(req.user, query) });
  });
}

export const getAnalyticsSummary = endpoint(getOverallSummary);
export const getIncomeExpense = endpoint((user, query) =>
  getIncomeExpenseTrend(user, query, query.period === "week" ? "week" : "month")
);
export const getCategoryAnalytics = endpoint((user, query) =>
  getCategoryBreakdown(user, query, query.type || "expense")
);
export const getCategoryComparisonAnalytics = endpoint(getCategoryComparison);
export const getWalletAnalytics = endpoint(getWalletBreakdown);
export const getDailyAnalytics = endpoint((user, query) => {
  const window = resolveAnalyticsWindow(query, user);
  const spanDays = (new Date(`${window.endDate}T00:00:00.000Z`) - new Date(`${window.startDate}T00:00:00.000Z`)) / 86_400_000 + 1;
  if (spanDays > 366) throw ApiError.badRequest("Daily reports are limited to 366 calendar days");
  return getDailySpending(user, query);
});
export const getMonthlyAnalytics = endpoint((user, query) => getIncomeExpenseTrend(user, query, "month"));
export const getMerchantAnalytics = endpoint(getMerchantAnalysis);
export const getPeriodComparisonAnalytics = endpoint(getPeriodComparison);
export const getBudgetAnalyticsReport = endpoint(getBudgetAnalytics);
export const getSavingsAnalyticsReport = endpoint(getSavingsAnalytics);
export const getSubscriptionAnalyticsReport = asyncHandler(async (req, res) => {
  const data = await getUserSubscriptionSummary(req.user._id, {
    timeZone: req.user.timezone || "Asia/Kolkata",
  });
  res.json({ success: true, data });
});
