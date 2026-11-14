import { Budget } from "../models/Budget.js";
import { Goal } from "../models/Goal.js";
import { RecurringTransaction } from "../models/RecurringTransaction.js";
import { ApiError } from "../utils/apiError.js";
import { toMerchantKey } from "../utils/merchant.js";
import { getIncomeExpenseTrend } from "./analyticsService.js";
import { getBudgetProgress } from "./budgetService.js";
import { getGoalProgress } from "./goalService.js";
import { getUserSubscriptionSummary } from "./subscriptionService.js";
import { scoreFinancialHealth } from "./financialHealthScoringService.js";

const HISTORY_MONTHS = 3;
const MAX_BUDGETS = 200;
const MAX_GOALS = 200;
const MAX_RECURRING_SCHEDULES = 1_000;
const DAY_MS = 86_400_000;

function calendarMonthMarker(now, timeZone, monthOffset = 0) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit" })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  return new Date(Date.UTC(parts.year, parts.month - 1 + monthOffset, 1));
}

function monthKey(date) {
  return date.toISOString().slice(0, 7);
}

function safePaise(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw ApiError.conflict(`${field} exceeds the safe integer range`);
  }
  return value;
}

function monthlyRecurringAmount(amount, frequency) {
  const multiplier = {
    daily: (365.25 / 12),
    weekly: (52 / 12),
    monthly: 1,
    yearly: (1 / 12),
  }[frequency];
  return Math.round(amount * multiplier);
}

function confidenceFor(transactionCount, activeMonths) {
  if (transactionCount >= 30 && activeMonths >= 3) return "high";
  if (transactionCount >= 10 && activeMonths >= 2) return "medium";
  return transactionCount > 0 ? "low" : "limited";
}

export async function getFinancialHealth(user, { now = new Date() } = {}) {
  const timeZone = user.timezone || "Asia/Kolkata";
  const currentMonth = calendarMonthMarker(now, timeZone);
  const startMarker = calendarMonthMarker(now, timeZone, -HISTORY_MONTHS);
  const endMarker = new Date(currentMonth.getTime() - DAY_MS);
  const startKey = monthKey(startMarker);
  const monthly = Array.from({ length: HISTORY_MONTHS }, (_value, index) => {
    const marker = new Date(Date.UTC(startMarker.getUTCFullYear(), startMarker.getUTCMonth() + index, 1));
    return { month: monthKey(marker), incomePaise: 0, expensePaise: 0, transactionCount: 0, expenseCount: 0 };
  });
  const monthlyByKey = new Map(monthly.map((item) => [item.month, item]));

  const [transactionTrend, budgets, goals, recurring, subscriptionSummary] = await Promise.all([
    getIncomeExpenseTrend(user, {
      startDate: startMarker,
      endDate: endMarker,
      timezone: timeZone,
    }, "month", now),
    Budget.find({
      userId: user._id,
      startDate: { $gte: startMarker, $lt: currentMonth },
      endDate: { $gte: startMarker, $lt: currentMonth },
    })
      .sort({ endDate: -1, _id: 1 })
      .limit(MAX_BUDGETS + 1)
      .lean(),
    Goal.find({ userId: user._id, status: "active" })
      .sort({ targetDate: 1, _id: 1 })
      .limit(MAX_GOALS + 1)
      .lean(),
    RecurringTransaction.find({ userId: user._id, status: "active", type: "expense" })
      .sort({ createdAt: -1, _id: 1 })
      .limit(MAX_RECURRING_SCHEDULES + 1)
      .select("name amount frequency")
      .lean(),
    getUserSubscriptionSummary(user._id, { now, timeZone }),
  ]);

  let totalIncomePaise = 0;
  let totalExpensePaise = 0;
  let transactionCount = 0;
  for (const row of transactionTrend.data) {
    const item = monthlyByKey.get(row.date.slice(0, 7));
    if (!item) continue;
    item.incomePaise = safePaise(row.income, "Monthly income");
    item.expensePaise = safePaise(row.expense, "Monthly expense");
    item.transactionCount = safePaise(row.incomeCount + row.expenseCount, "Transaction count");
    item.expenseCount = safePaise(row.expenseCount, "Expense count");
    totalIncomePaise += item.incomePaise;
    totalExpensePaise += item.expensePaise;
    transactionCount += item.transactionCount;
  }
  safePaise(totalIncomePaise, "Income total");
  safePaise(totalExpensePaise, "Expense total");

  const hasMoreBudgets = budgets.length > MAX_BUDGETS;
  budgets.length = Math.min(budgets.length, MAX_BUDGETS);
  const budgetProgress = await Promise.all(budgets.map((budget) => getBudgetProgress(budget, user)));
  const budgetItems = budgetProgress.map((progress) => ({
    percentageUsed: progress.percentageUsed,
    budgetAmountPaise: safePaise(progress.budgetAmount, "Budget amount"),
    actualSpendingPaise: safePaise(progress.actualSpending, "Budget spending"),
  }));

  const goalsTruncated = goals.length > MAX_GOALS;
  goals.length = Math.min(goals.length, MAX_GOALS);
  const goalItems = goals.map((goal) => ({
    ...getGoalProgress(goal, now, timeZone),
    targetAmount: safePaise(goal.targetAmount, "Goal target"),
    savedAmount: safePaise(goal.savedAmount, "Goal savings"),
  }));

  const recurringSchedulesTruncated = recurring.length > MAX_RECURRING_SCHEDULES;
  recurring.length = Math.min(recurring.length, MAX_RECURRING_SCHEDULES);
  let recurringMonthlyCostPaise = 0;
  for (const schedule of recurring) {
    recurringMonthlyCostPaise += monthlyRecurringAmount(schedule.amount, schedule.frequency);
  }
  safePaise(recurringMonthlyCostPaise, "Recurring obligations");
  const recurringMerchants = new Set(recurring.map((schedule) => toMerchantKey(schedule.name)).filter(Boolean));
  const confirmedSubscriptions = subscriptionSummary.confirmed.byMerchant;
  const nonOverlappingSubscriptions = confirmedSubscriptions.filter((item) =>
    !recurringMerchants.has(toMerchantKey(item.merchantName))
  );
  const subscriptionMonthlyCostPaise = nonOverlappingSubscriptions.reduce(
    (total, item) => total + safePaise(item.monthlyCostPaise, "Subscription cost"),
    0
  );
  safePaise(subscriptionMonthlyCostPaise, "Subscription costs");

  const expenseMonths = monthly
    .filter((item) => item.expenseCount > 0)
    .map(({ month, expensePaise }) => ({ month, expensePaise }));
  const activeMonths = monthly.filter((item) => item.transactionCount > 0).length;
  const hasTransactionBaseline = transactionCount >= 2 && activeMonths >= 2;
  const scoring = scoreFinancialHealth({
    totalIncomePaise,
    totalExpensePaise,
    monthlyIncomePaise: hasTransactionBaseline ? Math.round(totalIncomePaise / HISTORY_MONTHS) : 0,
    monthlyExpensePaise: hasTransactionBaseline ? Math.round(totalExpensePaise / HISTORY_MONTHS) : 0,
    budgets: budgetItems,
    budgetsTruncated: hasMoreBudgets,
    goals: goalItems,
    goalsTruncated,
    recurringMonthlyCostPaise,
    recurringScheduleCount: recurring.length,
    recurringSchedulesTruncated,
    subscriptionMonthlyCostPaise,
    overlappingSubscriptionMerchants: confirmedSubscriptions.length - nonOverlappingSubscriptions.length,
    expenseMonths,
  });
  const dataConfidence = {
    level: confidenceFor(transactionCount, activeMonths),
    transactionCount,
    activeMonths,
    historicalMonths: HISTORY_MONTHS,
    supportingDimensions: scoring.dimensions.length,
  };
  if (!transactionCount && scoring.dimensions.length) dataConfidence.level = "limited";

  const result = {
    score: scoring.score,
    grade: scoring.grade,
    positiveHabits: scoring.positiveHabits,
    areasNeedingImprovement: scoring.areasNeedingImprovement,
    dimensions: scoring.dimensions,
    normalizedWeightTotal: scoring.normalizedWeightTotal,
    dataConfidence,
    period: {
      startDate: startKey,
      endDate: new Date(currentMonth.getTime() - DAY_MS).toISOString().slice(0, 10),
      timeZone,
      completedMonths: HISTORY_MONTHS,
    },
    calculatedAt: now,
    limitations: [
      "This score reflects only the financial information recorded in SmartSpend and is not a guarantee of financial security.",
      "Debt, credit history, emergency savings outside recorded goals, assets, and unrecorded transactions are not included.",
    ],
  };
  return result;
}

export async function getFinancialHealthBreakdown(user, options) {
  const result = await getFinancialHealth(user, options);
  return {
    score: result.score,
    grade: result.grade,
    dimensions: result.dimensions,
    positiveHabits: result.positiveHabits,
    areasNeedingImprovement: result.areasNeedingImprovement,
    normalizedWeightTotal: result.normalizedWeightTotal,
    dataConfidence: result.dataConfidence,
    period: result.period,
    calculatedAt: result.calculatedAt,
    limitations: result.limitations,
  };
}
