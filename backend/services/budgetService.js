import { Transaction } from "../models/Transaction.js";
import { startOfLocalDate } from "../utils/dates.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const APPROACHING_LIMIT_PERCENT = 80;

function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function nextDateKey(value) {
  return new Date(new Date(`${dateKey(value)}T00:00:00.000Z`).getTime() + DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function parts(value) {
  const [year, month, day] = dateKey(value).split("-").map(Number);
  return { year, month, day };
}

export function assertBudgetPeriodDates(period, startDate, endDate, timeZone) {
  const start = parts(startDate);
  const end = parts(endDate);
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);

  if (startUtc > endUtc) throw new RangeError("Start date must be on or before end date");

  if (period === "weekly") {
    const monday = (new Date(startUtc).getUTCDay() + 6) % 7;
    if (monday !== 0 || endUtc - startUtc !== 6 * DAY_MS) {
      throw new RangeError("Weekly budgets must run Monday through Sunday");
    }
  } else if (period === "monthly") {
    const lastDay = new Date(Date.UTC(start.year, start.month, 0)).getUTCDate();
    if (start.day !== 1 || end.year !== start.year || end.month !== start.month || end.day !== lastDay) {
      throw new RangeError("Monthly budgets must cover a full calendar month");
    }
  } else if (period === "yearly") {
    if (start.month !== 1 || start.day !== 1 || end.year !== start.year || end.month !== 12 || end.day !== 31) {
      throw new RangeError("Yearly budgets must cover a full calendar year");
    }
  }

  return {
    start: startOfLocalDate(timeZone, startDate),
    end: startOfLocalDate(timeZone, new Date(`${nextDateKey(endDate)}T00:00:00.000Z`)),
  };
}

export async function getBudgetProgress(budget, user) {
  const { start, end } = assertBudgetPeriodDates(
    budget.period,
    budget.startDate,
    budget.endDate,
    user.timezone || "Asia/Kolkata"
  );
  const match = {
    userId: user._id,
    type: "expense",
    status: "confirmed",
    deletedAt: null,
    txnDate: { $gte: start, $lt: end },
  };
  if (budget.categoryId) match.categoryId = budget.categoryId;

  const rows = await Transaction.aggregate([
    { $match: match },
    { $group: { _id: null, actualSpending: { $sum: "$amount" }, transactionCount: { $sum: 1 } } },
  ]);
  const actualSpending = rows[0]?.actualSpending ?? 0;
  const rawPercentageUsed = (actualSpending / budget.amount) * 100;
  const percentageUsed = Number(rawPercentageUsed.toFixed(2));
  const remainingAmount = budget.amount - actualSpending;

  return {
    budgetAmount: budget.amount,
    actualSpending,
    remainingAmount,
    percentageUsed,
    percentageRemaining: Number(Math.max(0, (remainingAmount / budget.amount) * 100).toFixed(2)),
    isApproachingLimit: rawPercentageUsed >= APPROACHING_LIMIT_PERCENT && rawPercentageUsed < 100,
    isExceeded: rawPercentageUsed >= 100,
    transactionCount: rows[0]?.transactionCount ?? 0,
    periodStart: start,
    periodEnd: end,
  };
}

export function getBudgetSummary(progressItems) {
  const summary = progressItems.reduce(
    (result, item) => {
      result.budgetCount += 1;
      result.totalBudgetAmount += item.budgetAmount;
      result.totalActualSpending += item.actualSpending;
      result.totalRemainingAmount += item.remainingAmount;
      if (item.isApproachingLimit) result.approachingCount += 1;
      if (item.isExceeded) result.exceededCount += 1;
      return result;
    },
    {
      budgetCount: 0,
      totalBudgetAmount: 0,
      totalActualSpending: 0,
      totalRemainingAmount: 0,
      approachingCount: 0,
      exceededCount: 0,
    }
  );
  summary.percentageUsed = summary.totalBudgetAmount
    ? Number(((summary.totalActualSpending / summary.totalBudgetAmount) * 100).toFixed(2))
    : 0;
  return summary;
}
