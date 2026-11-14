import { Types } from "mongoose";
import { Budget } from "../models/Budget.js";
import { Transaction } from "../models/Transaction.js";
import { getBudgetProgress, getBudgetSummary } from "./budgetService.js";
import { getGoalSummary } from "./goalService.js";
import { listWalletsWithBalance } from "./balanceService.js";
import { startOfLocalDate } from "../utils/dates.js";

const DAY_MS = 86_400_000;
const DEFAULT_TIME_ZONE = "Asia/Kolkata";

function localParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)])
  );
  return { year: values.year, month: values.month, day: values.day };
}

function marker(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function addCalendarDays(date, days) {
  return new Date(new Date(date).getTime() + days * DAY_MS);
}

function calendarKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function periodWindow(now, period, timeZone) {
  const { year, month, day } = localParts(now, timeZone);
  if (period === "year") {
    return { startDate: marker(year, 1, 1), endDate: marker(year + 1, 1, 1) };
  }
  if (period === "week") {
    const today = marker(year, month, day);
    const mondayOffset = (today.getUTCDay() + 6) % 7;
    const startDate = addCalendarDays(today, -mondayOffset);
    return { startDate, endDate: addCalendarDays(startDate, 7) };
  }
  const startDate = marker(year, month, 1);
  return {
    startDate,
    endDate: month === 12 ? marker(year + 1, 1, 1) : marker(year, month + 1, 1),
  };
}

export function resolveAnalyticsWindow(query = {}, user = {}, now = new Date()) {
  const timeZone = query.timezone || user.timezone || DEFAULT_TIME_ZONE;
  const period = query.period || "month";
  let startMarker;
  let endMarker;

  if (query.startDate && query.endDate) {
    startMarker = query.startDate;
    endMarker = addCalendarDays(query.endDate, 1);
  } else {
    const window = periodWindow(now, period, timeZone);
    startMarker = window.startDate;
    endMarker = window.endDate;
  }

  return {
    timeZone,
    period,
    startDate: calendarKey(startMarker),
    endDate: calendarKey(addCalendarDays(endMarker, -1)),
    start: startOfLocalDate(timeZone, startMarker),
    end: startOfLocalDate(timeZone, endMarker),
  };
}

function transactionMatch(userId, query, window) {
  const match = {
    userId: new Types.ObjectId(String(userId)),
    status: "confirmed",
    deletedAt: null,
    type: { $in: ["income", "expense"] },
    txnDate: { $gte: window.start, $lt: window.end },
  };
  if (query.categoryId) match.categoryId = new Types.ObjectId(query.categoryId);
  if (query.walletId) match.walletId = new Types.ObjectId(query.walletId);
  return match;
}

function moneyTotals(rows) {
  const totals = { income: 0, expense: 0, incomeCount: 0, expenseCount: 0 };
  for (const row of rows) {
    if (row._id === "income") {
      totals.income = row.total;
      totals.incomeCount = row.count;
    } else if (row._id === "expense") {
      totals.expense = row.total;
      totals.expenseCount = row.count;
    }
  }
  const netSavings = totals.income - totals.expense;
  return {
    ...totals,
    netSavings,
    savingsRate: totals.income ? Number(((netSavings / totals.income) * 100).toFixed(2)) : 0,
    transactionCount: totals.incomeCount + totals.expenseCount,
    averageTransactionAmount: totals.incomeCount + totals.expenseCount
      ? Math.round((totals.income + totals.expense) / (totals.incomeCount + totals.expenseCount))
      : 0,
  };
}

async function groupedTotals(match) {
  const rows = await Transaction.aggregate([
    { $match: match },
    { $group: { _id: "$type", total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  return moneyTotals(rows);
}

export async function getOverallSummary(user, query = {}, now = new Date()) {
  const window = resolveAnalyticsWindow(query, user, now);
  const totals = await groupedTotals(transactionMatch(user._id, query, window));
  return { ...totals, period: window };
}

function groupByLocalUnit(unit, timeZone) {
  if (unit === "day") {
    return {
      $dateToString: { date: "$txnDate", format: "%Y-%m-%d", timezone: timeZone },
    };
  }
  if (unit === "week") {
    return {
      $dateToString: {
        date: { $dateTrunc: { date: "$txnDate", unit: "week", startOfWeek: "monday", timezone: timeZone } },
        format: "%Y-%m-%d",
        timezone: timeZone,
      },
    };
  }
  return {
    $dateToString: {
      date: { $dateTrunc: { date: "$txnDate", unit: "month", timezone: timeZone } },
      format: "%Y-%m-%d",
      timezone: timeZone,
    },
  };
}

export async function getIncomeExpenseTrend(user, query = {}, unit = "month", now = new Date()) {
  const window = resolveAnalyticsWindow(query, user, now);
  const rows = await Transaction.aggregate([
    { $match: transactionMatch(user._id, query, window) },
    { $group: { _id: { date: groupByLocalUnit(unit, window.timeZone), type: "$type" }, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    { $sort: { "_id.date": 1 } },
  ]);
  const periods = new Map();
  for (const row of rows) {
    const key = row._id.date;
    const item = periods.get(key) || { date: key, income: 0, expense: 0, incomeCount: 0, expenseCount: 0 };
    item[row._id.type] = row.amount;
    item[`${row._id.type}Count`] = row.count;
    periods.set(key, item);
  }
  return { period: window, data: [...periods.values()] };
}

export async function getCategoryBreakdown(user, query = {}, type = "expense", now = new Date()) {
  const window = resolveAnalyticsWindow(query, user, now);
  const match = { ...transactionMatch(user._id, query, window), type };
  const rows = await Transaction.aggregate([
    { $match: match },
    { $group: { _id: "$categoryId", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    { $sort: { total: -1, _id: 1 } },
    {
      $lookup: {
        from: "categories",
        let: { categoryId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$categoryId"] },
                  { $or: [{ $eq: ["$userId", null] }, { $eq: ["$userId", new Types.ObjectId(String(user._id))] }] },
                ],
              },
            },
          },
          { $project: { name: 1, icon: 1 } },
        ],
        as: "category",
      },
    },
    {
      $project: {
        _id: 0,
        categoryId: "$_id",
        name: { $ifNull: [{ $first: "$category.name" }, "Uncategorized"] },
        icon: { $ifNull: [{ $first: "$category.icon" }, "📦"] },
        total: 1,
        count: 1,
      },
    },
  ]);
  const total = rows.reduce((sum, item) => sum + item.total, 0);
  const categories = rows.map((item) => ({
    ...item,
    percentage: total ? Number(((item.total / total) * 100).toFixed(2)) : 0,
  }));
  return {
    type,
    period: window,
    total,
    categories,
    highest: categories[0] || null,
    lowest: categories.at(-1) || null,
  };
}

export async function getWalletBreakdown(user, query = {}, now = new Date(), walletLimit) {
  const window = resolveAnalyticsWindow(query, user, now);
  const match = transactionMatch(user._id, query, window);
  const [rows, walletsWithBalance] = await Promise.all([
    Transaction.aggregate([
      { $match: match },
      { $group: { _id: { walletId: "$walletId", type: "$type" }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { "_id.walletId": 1 } },
      {
        $lookup: {
          from: "wallets",
          let: { walletId: "$_id.walletId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$walletId"] },
                    { $eq: ["$userId", new Types.ObjectId(String(user._id))] },
                  ],
                },
              },
            },
            { $project: { name: 1 } },
          ],
          as: "wallet",
        },
      },
      { $unwind: { path: "$wallet", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$_id.walletId",
          name: { $first: { $ifNull: ["$wallet.name", "Wallet"] } },
          income: { $sum: { $cond: [{ $eq: ["$_id.type", "income"] }, "$total", 0] } },
          expense: { $sum: { $cond: [{ $eq: ["$_id.type", "expense"] }, "$total", 0] } },
          transactionCount: { $sum: "$count" },
        },
      },
      { $sort: { name: 1 } },
    ]),
    listWalletsWithBalance(user._id, { includeArchived: true, limit: walletLimit }),
  ]);
  const totalActivity = rows.reduce((sum, row) => sum + row.income + row.expense, 0);
  const balances = new Map(walletsWithBalance.map((wallet) => [String(wallet._id), wallet.balance]));
  return {
    period: window,
    totalActivity,
    wallets: rows.map((row) => ({
      ...row,
      balance: balances.get(String(row._id)) ?? 0,
      activityPercentage: totalActivity ? Number((((row.income + row.expense) / totalActivity) * 100).toFixed(2)) : 0,
    })),
  };
}

export async function getDailySpending(user, query = {}, now = new Date()) {
  const window = resolveAnalyticsWindow(query, user, now);
  const rows = await Transaction.aggregate([
    { $match: { ...transactionMatch(user._id, query, window), type: "expense" } },
    {
      $group: {
        _id: { $dateToString: { date: "$txnDate", format: "%Y-%m-%d", timezone: window.timeZone } },
        amount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const days = new Map(rows.map((row) => [row._id, { date: row._id, amount: row.amount, count: row.count }]));
  const first = new Date(`${window.startDate}T00:00:00.000Z`);
  const last = new Date(`${window.endDate}T00:00:00.000Z`);
  for (let day = first; day <= last; day = addCalendarDays(day, 1)) {
    const key = calendarKey(day);
    if (!days.has(key)) days.set(key, { date: key, amount: 0, count: 0 });
  }
  const data = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  const total = data.reduce((sum, item) => sum + item.amount, 0);
  const ranked = data.filter((item) => item.count > 0);
  return {
    period: window,
    total,
    averageDailyExpenditure: data.length ? Math.round(total / data.length) : 0,
    transactionCount: data.reduce((sum, item) => sum + item.count, 0),
    highestSpendingDay: ranked.reduce((best, item) => !best || item.amount > best.amount ? item : best, null),
    lowestSpendingDay: ranked.reduce((best, item) => !best || item.amount < best.amount ? item : best, null),
    data,
  };
}

export async function getMerchantAnalysis(user, query = {}, now = new Date(), limit = 10) {
  const window = resolveAnalyticsWindow(query, user, now);
  const merchants = await Transaction.aggregate([
    {
      $match: {
        ...transactionMatch(user._id, query, window),
        type: "expense",
        merchantKey: { $type: "string", $ne: "" },
      },
    },
    {
      $group: {
        _id: "$merchantKey",
        merchant: { $first: "$merchant" },
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1, count: -1, _id: 1 } },
    { $limit: limit },
  ]);
  return { period: window, merchants };
}

function percentageChange(current, previous) {
  return previous === 0 ? null : Number((((current - previous) / previous) * 100).toFixed(2));
}

function comparisonValue(current, previous) {
  return { current, previous, change: current - previous, percentageChange: percentageChange(current, previous) };
}

function comparisonWindows(query, user, now) {
  const timeZone = query.timezone || user.timezone || DEFAULT_TIME_ZONE;
  if (query.startDate && query.endDate) {
    if (query.compareStartDate && query.compareEndDate) {
      return {
        timeZone,
        current: resolveAnalyticsWindow({ ...query, period: "custom" }, user, now),
        previous: resolveAnalyticsWindow({
          timezone: timeZone,
          startDate: query.compareStartDate,
          endDate: query.compareEndDate,
          period: "custom",
        }, user, now),
      };
    }
    const currentStart = query.startDate;
    const currentEndExclusive = addCalendarDays(query.endDate, 1);
    const durationDays = Math.round((currentEndExclusive - currentStart) / DAY_MS);
    const previousEnd = addCalendarDays(currentStart, -1);
    const previousStart = addCalendarDays(previousEnd, -(durationDays - 1));
    return {
      timeZone,
      current: resolveAnalyticsWindow({ ...query, period: "custom" }, user, now),
      previous: resolveAnalyticsWindow({ timezone: timeZone, startDate: previousStart, endDate: previousEnd, period: "custom" }, user, now),
    };
  }

  const period = query.period || "month";
  const current = periodWindow(now, period, timeZone);
  let previous;
  if (period === "year") {
    const currentYear = current.startDate.getUTCFullYear();
    previous = { startDate: marker(currentYear - 1, 1, 1), endDate: marker(currentYear, 1, 1) };
  } else if (period === "week") {
    previous = {
      startDate: addCalendarDays(current.startDate, -7),
      endDate: current.startDate,
    };
  } else {
    const currentYear = current.startDate.getUTCFullYear();
    const currentMonth = current.startDate.getUTCMonth() + 1;
    const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    previous = {
      startDate: marker(previousYear, previousMonth, 1),
      endDate: marker(currentYear, currentMonth, 1),
    };
  }
  return {
    timeZone,
    current: resolveAnalyticsWindow({ timezone: timeZone, startDate: current.startDate, endDate: addCalendarDays(current.endDate, -1), period }, user, now),
    previous: resolveAnalyticsWindow({ timezone: timeZone, startDate: previous.startDate, endDate: addCalendarDays(previous.endDate, -1), period: "custom" }, user, now),
  };
}

export async function getPeriodComparison(user, query = {}, now = new Date()) {
  const windows = comparisonWindows(query, user, now);
  const [current, previous] = await Promise.all([
    groupedTotals(transactionMatch(user._id, query, windows.current)),
    groupedTotals(transactionMatch(user._id, query, windows.previous)),
  ]);
  const keys = ["income", "expense", "netSavings", "transactionCount", "averageTransactionAmount"];
  const metrics = Object.fromEntries(keys.map((key) => [key, comparisonValue(current[key], previous[key])]));
  return { period: query.period || "custom", currentPeriod: windows.current, previousPeriod: windows.previous, metrics };
}

export async function getCategoryComparison(user, query = {}, now = new Date()) {
  const windows = comparisonWindows(query, user, now);
  const [current, previous] = await Promise.all([
    getCategoryBreakdown(user, { ...query, startDate: windows.current.startDate, endDate: windows.current.endDate }, "expense", now),
    getCategoryBreakdown(user, { ...query, startDate: windows.previous.startDate, endDate: windows.previous.endDate }, "expense", now),
  ]);
  const priorById = new Map(previous.categories.map((row) => [String(row.categoryId), row]));
  const allCategoryIds = new Set([
    ...current.categories.map((row) => String(row.categoryId)),
    ...previous.categories.map((row) => String(row.categoryId)),
  ]);
  const currentById = new Map(current.categories.map((row) => [String(row.categoryId), row]));
  return {
    currentPeriod: windows.current,
    previousPeriod: windows.previous,
    categories: [...allCategoryIds].map((id) => {
      const currentItem = currentById.get(id);
      const previousItem = priorById.get(id);
      const currentTotal = currentItem?.total ?? 0;
      const previousTotal = previousItem?.total ?? 0;
      return {
        ...(currentItem || previousItem),
        total: currentTotal,
        previousTotal,
        change: currentTotal - previousTotal,
        percentageChange: percentageChange(currentTotal, previousTotal),
      };
    }).sort((a, b) => b.total - a.total),
  };
}

export async function getBudgetAnalytics(user, { limit } = {}) {
  let budgetQuery = Budget.find({ userId: user._id, status: "active" }).sort({ startDate: 1 });
  if (Number.isInteger(limit) && limit > 0) budgetQuery = budgetQuery.limit(limit);
  const budgets = await budgetQuery.lean();
  const progress = await Promise.all(budgets.map((budget) => getBudgetProgress(budget, user)));
  return { summary: getBudgetSummary(progress), budgets: budgets.map((budget, index) => ({ ...budget, progress: progress[index] })) };
}

export async function getSavingsAnalytics(user, options) {
  return getGoalSummary(user._id, user.timezone || DEFAULT_TIME_ZONE, options);
}

export async function getAnalyticsReport(user, query = {}, now = new Date()) {
  const [summary, categories, wallets, monthlyComparison] = await Promise.all([
    getOverallSummary(user, query, now),
    getCategoryBreakdown(user, query, "expense", now),
    getWalletBreakdown(user, query, now),
    getPeriodComparison(user, { period: "month", timezone: query.timezone }, now),
  ]);
  return { summary, categories, wallets, comparison: monthlyComparison };
}

export async function getTransactionCount(userId, query = {}, user = {}) {
  const window = resolveAnalyticsWindow(query, user);
  return Transaction.countDocuments(transactionMatch(userId, query, window));
}
