import { Types } from "mongoose";
import { Category } from "../models/Category.js";
import { Transaction } from "../models/Transaction.js";
import { ApiError } from "../utils/apiError.js";
import { resolveAnalyticsWindow } from "./analyticsService.js";
import {
  addCalendarMonths,
  calendarDate,
  calendarDateParts,
  calendarMonthKey,
  daysInCalendarMonth,
  enumerateCalendarMonths,
  getConfirmedSubscriptionTransactionIds,
  getDateRangeForMonths,
  getMonthlyExpenseFeatures,
  getScheduledExpenseForecast,
  getVisibleExpenseCategories,
  localDateKey,
} from "./predictionFeatureService.js";
import { calculateForecastAccuracy, forecastCurrentMonth, forecastMonthlyAmount } from "./predictionModelService.js";

const HISTORY_MONTHS = 12;
const MAX_BACKTEST_MONTHS = 12;
const CURRENCY = "INR";
const LIMITATIONS = [
  "This is a statistical estimate, not a guarantee or financial advice.",
  "Confirmed subscription payments are removed from the historical baseline and projected separately; matching active recurring schedules take precedence.",
  "Detected but unconfirmed subscriptions are not added to forecasts.",
  "Confidence describes available history, not proven predictive accuracy.",
];

function parseMonth(monthKey) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey || "");
  if (!match) throw ApiError.badRequest("month must use YYYY-MM");
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw ApiError.badRequest("month must be a valid calendar month");
  return calendarDate(year, month);
}

function getTargetMonth(user, monthKey, now) {
  const timezone = user.timezone || "Asia/Kolkata";
  const currentWindow = resolveAnalyticsWindow({ period: "month", timezone }, user, now);
  const currentMonthKey = currentWindow.startDate.slice(0, 7);
  const currentMonthStart = parseMonth(currentMonthKey);
  const targetStart = monthKey ? parseMonth(monthKey) : currentMonthStart;
  const targetMonthKey = calendarMonthKey(targetStart);
  const nextMonthKey = calendarMonthKey(addCalendarMonths(currentMonthStart, 1));
  if (![currentMonthKey, nextMonthKey].includes(targetMonthKey)) {
    throw ApiError.badRequest("Predictions are available for the current month or next month");
  }
  const nextStart = addCalendarMonths(targetStart, 1);
  const endDate = new Date(nextStart.getTime() - 86_400_000);
  const window = resolveAnalyticsWindow({
    startDate: targetStart,
    endDate,
    timezone,
  }, user, now);
  return { monthKey: targetMonthKey, window, currentMonthKey, nextMonthKey, timezone };
}

function targetHistoryMonths(targetMonthStart) {
  const start = addCalendarMonths(targetMonthStart, -HISTORY_MONTHS);
  const end = targetMonthStart;
  return enumerateCalendarMonths(start, end);
}

function dataForCategory(rows, categoryId) {
  return rows.filter((row) => row.categoryId === categoryId);
}

function monthlySeries(rows, months, categoryId, { recurring = false } = {}) {
  const totals = new Map();
  const selectedRows = categoryId === undefined ? rows : dataForCategory(rows, categoryId);
  for (const row of selectedRows) {
    if (row.recurring === recurring) {
      totals.set(row.month, (totals.get(row.month) || 0) + row.totalPaise);
    }
  }
  return months.map((month) => ({ month, amountPaise: totals.get(month) || 0 }));
}

function observedMonths(series) {
  const firstActive = series.findIndex((month) => month.amountPaise > 0);
  return firstActive < 0 ? [] : series.slice(firstActive);
}

function aggregateActual(rows, monthKey, recurring = null) {
  return rows
    .filter((row) => row.month === monthKey && (recurring === null || row.recurring === recurring))
    .reduce((sum, row) => sum + row.totalPaise, 0);
}

function aggregateActualCategory(rows, monthKey, categoryId, recurring = null) {
  return rows
    .filter((row) =>
      row.month === monthKey &&
      row.categoryId === categoryId &&
      (recurring === null || row.recurring === recurring)
    )
    .reduce((sum, row) => sum + row.totalPaise, 0);
}

async function loadPredictionFeatures(user, target, now) {
  const monthStart = calendarDate(...Object.values(calendarDateParts(target.window.startDate)));
  const historicalMonths = targetHistoryMonths(monthStart);
  const range = getDateRangeForMonths(historicalMonths);
  const historyEndDate = new Date(monthStart.getTime() - 86_400_000);
  const historyStart = resolveAnalyticsWindow({
    startDate: range.start,
    endDate: historyEndDate,
    timezone: target.timezone,
  }, user, now);
  const excludedSubscriptionTransactionIds = await getConfirmedSubscriptionTransactionIds(
    user._id,
    historyStart.start,
    target.window.start
  );
  const rows = await getMonthlyExpenseFeatures(
    user._id,
    historyStart.start,
    historyStart.end,
    target.timezone,
    excludedSubscriptionTransactionIds
  );
  const actualEnd = new Date(Math.min(target.window.end.getTime(), now.getTime() + 1));
  if (target.window.start < actualEnd) {
    rows.push(...await getMonthlyExpenseFeatures(
      user._id,
      target.window.start,
      actualEnd,
      target.timezone
    ));
  }
  const nowKey = localDateKey(now, target.timezone);
  const targetStartKey = target.window.startDate;
  const endDate = new Date(`${target.window.endDate}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const targetEndKey = endDate.toISOString().slice(0, 10);
  const recurring = target.monthKey >= target.currentMonthKey
    ? await getScheduledExpenseForecast({
      userId: user._id,
      targetStart: target.window.start,
      targetEnd: target.window.end,
      targetStartKey,
      targetEndKey,
      todayKey: nowKey,
      timeZone: target.timezone,
      now,
    })
    : { totalPaise: 0, byCategory: {}, occurrences: [], truncated: false };
  return { rows, historicalMonths, recurring, monthStart };
}

function predictionMetadata(period, sampleSize) {
  return {
    currency: CURRENCY,
    forecastPeriod: period,
    confidence: {
      level: sampleSize >= 12 ? "high" : sampleSize >= 6 ? "medium" : sampleSize >= 3 ? "low" : "insufficient",
      historicalSampleSize: sampleSize,
    },
    methodology: "Robust bounded rolling monthly averages of confirmed non-recurring expenses; active scheduled expenses are projected separately.",
    limitations: LIMITATIONS,
  };
}

function buildMonthlyForecast(user, target, features, now) {
  const allMonths = features.historicalMonths.filter((month) => month < target.monthKey);
  const historicalSeries = observedMonths(monthlySeries(features.rows, allMonths, undefined, { recurring: false }));
  const recurringPaise = features.recurring.totalPaise;
  const currentMonth = target.monthKey === target.currentMonthKey;
  if (!currentMonth) {
    const baseline = forecastMonthlyAmount(historicalSeries);
    const predictedAmountPaise = baseline.status === "ok"
      ? baseline.predictedAmountPaise + recurringPaise
      : null;
    return {
      status: baseline.status,
      ...predictionMetadata(target.monthKey, baseline.confidence.sampleSize),
      predictedAmountPaise,
      expectedMonthEndPaise: predictedAmountPaise,
      actualMonthToDatePaise: 0,
      remainingExpectedPaise: predictedAmountPaise,
      dailyAveragePaise: predictedAmountPaise === null
        ? null
        : Math.round(predictedAmountPaise / daysInCalendarMonth(target.window.startDate)),
      nonRecurringForecastPaise: baseline.predictedAmountPaise,
      knownRecurringPaise: recurringPaise,
      knownSubscriptionPaise: features.recurring.subscriptionsPaise || 0,
      recurringScheduleCount: features.recurring.occurrences.length,
      historicalMonths: baseline.confidence.monthsAnalyzed,
      modelMethodology: baseline.methodology || null,
      message: baseline.status === "ok" ? null : "At least three active historical months are needed for a reliable estimate.",
    };
  }

  const currentActual = aggregateActual(features.rows, target.monthKey);
  const localToday = calendarDateParts(localDateKey(now, target.timezone));
  const elapsedDays = Math.min(daysInCalendarMonth(target.window.startDate), localToday.day);
  const baseline = forecastCurrentMonth({
    historicalMonthlyAmounts: historicalSeries,
    actualMonthToDatePaise: currentActual,
    elapsedDays,
    daysInMonth: daysInCalendarMonth(target.window.startDate),
    recurringRemainingPaise: recurringPaise,
  });
  return {
    status: baseline.status,
    ...predictionMetadata(target.monthKey, baseline.confidence.sampleSize),
    predictedAmountPaise: baseline.expectedMonthEndPaise,
    expectedMonthEndPaise: baseline.expectedMonthEndPaise,
    actualMonthToDatePaise: currentActual,
    remainingExpectedPaise: baseline.remainingExpectedPaise,
    dailyAveragePaise: baseline.dailyAveragePaise,
    nonRecurringForecastPaise: baseline.nonRecurringRemainingPaise ?? null,
    knownRecurringPaise: recurringPaise,
    knownSubscriptionPaise: features.recurring.subscriptionsPaise || 0,
    recurringScheduleCount: features.recurring.occurrences.length,
    historicalMonths: baseline.confidence.monthsAnalyzed,
    modelMethodology: baseline.methodology || null,
    message: baseline.status === "ok" ? null : "At least three active historical months are needed for a reliable estimate.",
  };
}

export async function getExpensePredictionOverview(user, { month, now = new Date() } = {}) {
  const target = getTargetMonth(user, month, now);
  const features = await loadPredictionFeatures(user, target, now);
  const currentTarget = getTargetMonth(user, target.currentMonthKey, now);
  const currentFeatures = target.monthKey === currentTarget.monthKey
    ? features
    : await loadPredictionFeatures(user, currentTarget, now);
  const current = buildMonthlyForecast(user, currentTarget, currentFeatures, now);
  const nextTarget = getTargetMonth(user, target.nextMonthKey, now);
  const nextFeatures = target.monthKey === nextTarget.monthKey
    ? features
    : await loadPredictionFeatures(user, nextTarget, now);
  const next = buildMonthlyForecast(user, nextTarget, nextFeatures, now);
  return {
    currency: CURRENCY,
    asOf: now,
    timezone: user.timezone || "Asia/Kolkata",
    currentMonth: current,
    nextMonth: next,
    status: current.status === "ok" || next.status === "ok" ? "ok" : "insufficient_data",
    methodology: "Historical confirmed, non-trashed expense totals; transfers, pending-review items and recurring-source transactions are excluded from baseline. Scheduled expenses are projected separately.",
    limitations: LIMITATIONS,
  };
}

export async function getMonthlyExpensePrediction(user, { month, now = new Date() } = {}) {
  const target = getTargetMonth(user, month, now);
  const features = await loadPredictionFeatures(user, target, now);
  return buildMonthlyForecast(user, target, features, now);
}

export async function getCategoryExpensePredictions(user, { month, categoryId, now = new Date() } = {}) {
  const target = getTargetMonth(user, month, now);
  if (categoryId && !(await Category.exists({
    _id: categoryId,
    type: "expense",
    $or: [{ userId: null }, { userId: user._id }],
  }))) throw ApiError.badRequest("Category filter is invalid");

  const features = await loadPredictionFeatures(user, target, now);
  const categories = await getVisibleExpenseCategories(user._id);
  const included = categories.filter((category) =>
    !categoryId || String(category._id) === String(categoryId)
  );
  const includeUncategorized = !categoryId && (
    features.rows.some((row) => row.categoryId === null) ||
    Object.hasOwn(features.recurring.byCategory, "uncategorized")
  );
  const monthStart = calendarDate(...Object.values(calendarDateParts(target.window.startDate)));
  const months = features.historicalMonths.filter((key) => key < target.monthKey);
  const currentMonth = target.monthKey === target.currentMonthKey;
  const todayKey = localDateKey(now, target.timezone);
  const elapsedDays = currentMonth
    ? Math.min(daysInCalendarMonth(monthStart), calendarDateParts(todayKey).day)
    : 0;
  const remainingDays = currentMonth ? daysInCalendarMonth(monthStart) - elapsedDays : daysInCalendarMonth(monthStart);
  const categoriesResult = [];

  for (const category of included) {
    categoriesResult.push(buildCategoryPrediction({
      categoryId: String(category._id),
      name: category.name,
      icon: category.icon,
      rows: features.rows,
      months,
      target,
      currentMonth,
      elapsedDays,
      remainingDays,
      recurringPaise: features.recurring.byCategory[String(category._id)] || 0,
      subscriptionPaise: features.recurring.subscriptionsByCategory[String(category._id)] || 0,
    }));
  }
  if (includeUncategorized) {
    categoriesResult.push(buildCategoryPrediction({
      categoryId: null,
      name: "Uncategorized",
      icon: "📦",
      rows: features.rows,
      months,
      target,
      currentMonth,
      elapsedDays,
      remainingDays,
      recurringPaise: features.recurring.byCategory.uncategorized || 0,
      subscriptionPaise: features.recurring.subscriptionsByCategory.uncategorized || 0,
    }));
  }
  return {
    status: categoriesResult.some((item) => item.status === "ok") ? "ok" : "insufficient_data",
    currency: CURRENCY,
    forecastPeriod: target.monthKey,
    timezone: target.timezone,
    categories: categoriesResult,
    categoriesTruncated: categories.length === 250,
    historicalMonthsAnalyzed: months.length,
    methodology: "Per-category forecast using only that category's confirmed, non-recurring expense history; scheduled expenses remain a separate component.",
    limitations: LIMITATIONS,
  };
}

function buildCategoryPrediction({
  categoryId,
  name,
  icon,
  rows,
  months,
  target,
  currentMonth,
  elapsedDays,
  remainingDays,
  recurringPaise,
  subscriptionPaise,
}) {
  const series = observedMonths(monthlySeries(rows, months, categoryId, { recurring: false }));
  const baseline = forecastMonthlyAmount(series);
  const actual = currentMonth ? aggregateActualCategory(rows, target.monthKey, categoryId) : 0;
  const previousMonthKey = calendarMonthKey(addCalendarMonths(target.window.startDate, -1));
  const previousMonthActualPaise = aggregateActualCategory(rows, previousMonthKey, categoryId);
  if (baseline.status !== "ok") {
    return {
      categoryId,
      name,
      icon,
      status: "insufficient_data",
      predictedAmountPaise: null,
      actualMonthToDatePaise: actual,
      previousMonthActualPaise,
      knownRecurringPaise: recurringPaise,
      knownSubscriptionPaise: subscriptionPaise,
      confidence: baseline.confidence,
      historicalSampleSize: baseline.confidence.sampleSize,
    };
  }
  const nonRecurring = currentMonth
    ? Math.round(baseline.predictedAmountPaise * remainingDays / daysInCalendarMonth(target.window.startDate))
    : baseline.predictedAmountPaise;
  const predictedAmountPaise = currentMonth
    ? actual + nonRecurring + recurringPaise
    : baseline.predictedAmountPaise + recurringPaise;
  return {
    categoryId,
    name,
    icon,
    status: "ok",
    predictedAmountPaise,
    actualMonthToDatePaise: actual,
    previousMonthActualPaise,
    changeVsPreviousMonthPaise: predictedAmountPaise - previousMonthActualPaise,
    remainingExpectedPaise: currentMonth ? nonRecurring + recurringPaise : predictedAmountPaise,
    nonRecurringForecastPaise: nonRecurring,
    knownRecurringPaise: recurringPaise,
    knownSubscriptionPaise: subscriptionPaise,
    confidence: baseline.confidence,
    historicalSampleSize: baseline.confidence.sampleSize,
    methodology: baseline.methodology,
  };
}

export async function getDailyExpensePrediction(user, { month, categoryId, now = new Date() } = {}) {
  const target = getTargetMonth(user, month, now);
  if (target.monthKey !== target.currentMonthKey && target.monthKey !== target.nextMonthKey) {
    throw ApiError.badRequest("Daily predictions are available for the current or next month");
  }
  if (categoryId && !(await Category.exists({
    _id: categoryId,
    type: "expense",
    $or: [{ userId: null }, { userId: user._id }],
  }))) throw ApiError.badRequest("Category filter is invalid");

  const features = await loadPredictionFeatures(user, target, now);
  const monthStart = calendarDate(...Object.values(calendarDateParts(target.window.startDate)));
  const months = features.historicalMonths.filter((key) => key < target.monthKey);
  const series = observedMonths(monthlySeries(
    features.rows,
    months,
    categoryId ? String(categoryId) : undefined,
    { recurring: false }
  ));
  const baseline = forecastMonthlyAmount(series);
  const days = daysInCalendarMonth(monthStart);
  const todayKey = localDateKey(now, target.timezone);
  const currentMonth = target.monthKey === target.currentMonthKey;
  const todayDay = currentMonth ? calendarDateParts(todayKey).day : 0;
  const dailyBasePaise = baseline.status === "ok" ? Math.round(baseline.predictedAmountPaise / days) : null;
  const actualRows = await Transaction.aggregate([
    {
      $match: {
        userId: new Types.ObjectId(String(user._id)),
        type: "expense",
        status: "confirmed",
        deletedAt: null,
        txnDate: { $gte: target.window.start, $lt: new Date(Math.min(target.window.end.getTime(), now.getTime() + 1)) },
        ...(categoryId ? { categoryId: new Types.ObjectId(categoryId) } : {}),
      },
    },
    {
      $group: {
        _id: { $dateToString: { date: "$txnDate", format: "%Y-%m-%d", timezone: target.timezone } },
        totalPaise: { $sum: "$amount" },
      },
    },
  ]);
  const actualByDate = new Map(actualRows.map((row) => [row._id, row.totalPaise]));
  const recurringByDate = new Map();
  const subscriptionsByDate = new Map();
  if (features.recurring.occurrences.length && (!categoryId || features.recurring.occurrences.some((item) => item.categoryId === String(categoryId)))) {
    for (const occurrence of features.recurring.occurrences) {
      if (categoryId && occurrence.categoryId !== String(categoryId)) continue;
      recurringByDate.set(occurrence.date, (recurringByDate.get(occurrence.date) || 0) + occurrence.amountPaise);
      if (occurrence.subscriptionId) {
        subscriptionsByDate.set(occurrence.date, (subscriptionsByDate.get(occurrence.date) || 0) + occurrence.amountPaise);
      }
    }
  }
  const data = [];
  for (let day = 1; day <= days; day += 1) {
    const date = `${target.monthKey}-${String(day).padStart(2, "0")}`;
    const isActual = currentMonth && day <= todayDay;
    const actualPaise = actualByDate.get(date) || 0;
    const recurringPaise = isActual ? 0 : (recurringByDate.get(date) || 0);
    data.push({
      date,
      status: isActual ? "actual" : baseline.status === "ok" ? "forecast" : "insufficient_data",
      actualAmountPaise: isActual ? actualPaise : null,
      predictedAmountPaise: isActual
        ? actualPaise
        : baseline.status === "ok" ? dailyBasePaise + recurringPaise : null,
      knownRecurringPaise: recurringPaise,
      knownSubscriptionPaise: isActual ? 0 : (subscriptionsByDate.get(date) || 0),
    });
  }
  return {
    status: baseline.status,
    currency: CURRENCY,
    forecastPeriod: target.monthKey,
    timezone: target.timezone,
    dailyAveragePaise: baseline.status === "ok" ? dailyBasePaise : null,
    historicalSampleSize: baseline.confidence.sampleSize,
    confidence: baseline.confidence.level,
    data,
    methodology: "Daily forecast is the historical non-recurring monthly baseline divided evenly across calendar days, with scheduled payments added on their due dates. Actual days use recorded expense totals.",
    limitations: LIMITATIONS,
  };
}

export async function getExpensePredictionAccuracy(user, { months = MAX_BACKTEST_MONTHS, now = new Date() } = {}) {
  const timezone = user.timezone || "Asia/Kolkata";
  const currentMonthKey = resolveAnalyticsWindow({ period: "month", timezone }, user, now).startDate.slice(0, 7);
  const currentMonthStart = parseMonth(currentMonthKey);
  const targetMonths = enumerateCalendarMonths(
    addCalendarMonths(currentMonthStart, -months),
    currentMonthStart
  );
  const historyStart = addCalendarMonths(currentMonthStart, -months - HISTORY_MONTHS);
  const range = resolveAnalyticsWindow({
    startDate: historyStart,
    endDate: new Date(currentMonthStart.getTime() - 86_400_000),
    timezone,
  }, user, now);
  const rows = await getMonthlyExpenseFeatures(user._id, range.start, range.end, timezone);
  const samples = [];
  for (const targetMonth of targetMonths) {
    const targetStart = parseMonth(targetMonth);
    const priorKeys = enumerateCalendarMonths(addCalendarMonths(targetStart, -HISTORY_MONTHS), targetStart);
    const series = observedMonths(monthlySeries(rows, priorKeys, undefined, { recurring: false }));
    const forecast = forecastMonthlyAmount(series);
    if (forecast.status !== "ok") continue;
    const actualAmountPaise = aggregateActual(rows, targetMonth, false);
    samples.push({
      month: targetMonth,
      predictedAmountPaise: forecast.predictedAmountPaise,
      actualAmountPaise,
    });
  }
  return {
    ...calculateForecastAccuracy(samples),
    currency: CURRENCY,
    metricScope: "Confirmed non-recurring expenses only; recurring source transactions are omitted from both predictions and actuals.",
    samples,
    limitations: [
      "Backtest forecasts use only recorded data dated before each target month.",
      "Periods without at least three prior active months are omitted.",
      "MAPE is not calculated for zero-actual periods.",
    ],
  };
}

export { parseMonth };
