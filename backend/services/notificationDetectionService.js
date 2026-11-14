import { Types } from "mongoose";
import { User } from "../models/User.js";
import { Goal } from "../models/Goal.js";
import { RecurringTransaction } from "../models/RecurringTransaction.js";
import { Subscription } from "../models/Subscription.js";
import { TransactionAnomaly } from "../models/TransactionAnomaly.js";
import { getBudgetAnalytics, getPeriodComparison } from "./analyticsService.js";
import { getGoalProgress } from "./goalService.js";
import { listUpcomingRecurringTransactions } from "./recurringTransactionService.js";
import { getUserSubscriptionSummary } from "./subscriptionService.js";
import { createNotification, createNotifications } from "./notificationService.js";
import { toMerchantKey } from "../utils/merchant.js";

const DAY_MS = 86_400_000;
const MAX_USERS_PER_BATCH = 100;
const MAX_NOTIFICATIONS_PER_USER = 250;
const UPCOMING_DAYS = 3;
const RECENT_SUBSCRIPTION_DAYS = 7;
const RECENT_ANOMALY_DAYS = 2;
const GOAL_MILESTONES = [25, 50, 75];

function localDateKey(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function event({
  type,
  title,
  message,
  relatedEntityType,
  relatedEntityId,
  severity,
  deduplicationKey,
  metadata = {},
}) {
  return {
    type,
    title,
    message,
    relatedEntityType,
    relatedEntityId,
    severity,
    deduplicationKey,
    metadata,
  };
}

function recurringIntervalMatches(schedule, subscription) {
  if (toMerchantKey(schedule.name) !== toMerchantKey(subscription.merchantName)) return false;
  const frequencies = {
    weekly: "weekly",
    monthly: "monthly",
    quarterly: "monthly",
    annual: "yearly",
  };
  return frequencies[subscription.frequency] === schedule.frequency;
}

function upcomingWithinDays(dateValue, now, days, timeZone) {
  const date = String(dateValue).slice(0, 10);
  const today = localDateKey(now, timeZone);
  const due = new Date(`${date}T00:00:00.000Z`);
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const delta = Math.floor((due - todayDate) / DAY_MS);
  return delta >= 0 && delta <= days;
}

export async function detectUserNotifications(user, { now = new Date() } = {}) {
  const userId = new Types.ObjectId(String(user._id));
  const timezone = user.timezone || "Asia/Kolkata";
  const [budgetReport, recurringItems, subscriptionSummary, subscriptions, anomalies, goals, recurringSchedules] =
    await Promise.all([
      getBudgetAnalytics(user, { limit: 200 }),
      listUpcomingRecurringTransactions(user, { days: UPCOMING_DAYS, now, limit: 100 }),
      getUserSubscriptionSummary(userId, { now, timeZone: timezone }),
      Subscription.find({
        userId,
        status: "detected",
        createdAt: { $gte: new Date(now.getTime() - RECENT_SUBSCRIPTION_DAYS * DAY_MS), $lte: now },
      })
        .sort({ createdAt: -1, _id: 1 })
        .limit(50)
        .select("merchantName frequency confidenceLevel createdAt")
        .lean(),
      TransactionAnomaly.find({
        userId,
        severity: { $in: ["high", "critical"] },
        status: "new",
        detectedAt: { $gte: new Date(now.getTime() - RECENT_ANOMALY_DAYS * DAY_MS), $lte: now },
      })
        .sort({ detectedAt: -1, _id: 1 })
        .limit(100)
        .select("_id transactionId severity explanation")
        .lean(),
      Goal.find({ userId, status: { $in: ["active", "completed"] } })
        .sort({ updatedAt: -1, _id: 1 })
        .limit(200)
        .lean(),
      RecurringTransaction.find({ userId, status: "active", type: "expense" })
        .sort({ nextDueDate: 1, _id: 1 })
        .limit(500)
        .select("name frequency")
        .lean(),
    ]);

  const notifications = [];
  for (const budget of budgetReport.budgets) {
    const progress = budget.progress;
    const periodKey = new Date(budget.startDate).toISOString().slice(0, 10);
    if (progress.isExceeded) {
      notifications.push(event({
        type: "budget_exceeded",
        title: "Budget limit exceeded",
        message: `${budget.name} has reached ${progress.percentageUsed}% of its limit.`,
        relatedEntityType: "budget",
        relatedEntityId: budget._id,
        severity: "high",
        deduplicationKey: `budget:${budget._id}:${periodKey}:exceeded`,
        metadata: { percentageUsed: progress.percentageUsed },
      }));
    } else if (progress.isApproachingLimit) {
      notifications.push(event({
        type: "budget_approaching",
        title: "Budget approaching its limit",
        message: `${budget.name} has reached ${progress.percentageUsed}% of its limit.`,
        relatedEntityType: "budget",
        relatedEntityId: budget._id,
        severity: "warning",
        deduplicationKey: `budget:${budget._id}:${periodKey}:approaching`,
        metadata: { percentageUsed: progress.percentageUsed },
      }));
    }
  }

  const confirmedAndDetectedRenewals = subscriptionSummary.upcomingPayments;
  for (const item of recurringItems) {
    const date = new Date(item.nextDueDate).toISOString().slice(0, 10);
    if (confirmedAndDetectedRenewals.some((subscription) =>
      recurringIntervalMatches(item, subscription) &&
      upcomingWithinDays(subscription.expectedPaymentDate, now, UPCOMING_DAYS, timezone)
    )) continue;
    notifications.push(event({
      type: "recurring_upcoming",
      title: "Upcoming recurring payment",
      message: `${item.name} is scheduled for ${date}.`,
      relatedEntityType: "recurring_transaction",
      relatedEntityId: item._id,
      severity: "info",
      deduplicationKey: `recurring:${item._id}:${date}`,
      metadata: { amountPaise: item.amount, frequency: item.frequency, dueDate: date },
    }));
  }

  for (const item of confirmedAndDetectedRenewals) {
    if (!upcomingWithinDays(item.expectedPaymentDate, now, UPCOMING_DAYS, timezone)) continue;
    if (recurringSchedules.some((schedule) => recurringIntervalMatches(schedule, item))) continue;
    notifications.push(event({
      type: "subscription_upcoming",
      title: "Estimated subscription renewal",
      message: `${item.merchantName} may renew around ${item.expectedPaymentDate}; this date is an estimate.`,
      relatedEntityType: "subscription",
      relatedEntityId: item.subscriptionId,
      severity: item.status === "confirmed" ? "info" : "warning",
      deduplicationKey: `subscription-renewal:${item.subscriptionId}:${item.expectedPaymentDate}`,
      metadata: {
        amountPaise: item.estimatedAmountPaise,
        frequency: item.frequency,
        confidenceLevel: item.confidenceLevel,
        status: item.status,
        estimatedDate: true,
      },
    }));
  }

  for (const subscription of subscriptions) {
    notifications.push(event({
      type: "subscription_detected",
      title: "Subscription pattern needs review",
      message: `${subscription.merchantName} appears to have a ${subscription.frequency} payment pattern. Review it before confirming.`,
      relatedEntityType: "subscription",
      relatedEntityId: subscription._id,
      severity: "info",
      deduplicationKey: `subscription-detected:${subscription._id}`,
      metadata: { frequency: subscription.frequency, confidenceLevel: subscription.confidenceLevel },
    }));
  }

  for (const goal of goals) {
    const progress = getGoalProgress(goal, now, timezone);
    if (goal.status === "completed" || progress.isCompleted) {
      notifications.push(event({
        type: "goal_reached",
        title: "Savings goal reached",
        message: `You reached your ${goal.name} savings goal.`,
        relatedEntityType: "goal",
        relatedEntityId: goal._id,
        severity: "info",
        deduplicationKey: `goal:${goal._id}:reached`,
        metadata: { savedAmountPaise: goal.savedAmount, targetAmountPaise: goal.targetAmount },
      }));
      continue;
    }
    const reached = GOAL_MILESTONES.filter((milestone) => progress.percentageComplete >= milestone);
    if (reached.length) {
      const milestone = reached.at(-1);
      notifications.push(event({
        type: "goal_milestone",
        title: "Savings goal progress",
        message: `${goal.name} is ${milestone}% complete.`,
        relatedEntityType: "goal",
        relatedEntityId: goal._id,
        severity: "info",
        deduplicationKey: `goal:${goal._id}:milestone:${milestone}`,
        metadata: { milestonePercent: milestone, savedAmountPaise: goal.savedAmount, targetAmountPaise: goal.targetAmount },
      }));
    }
  }

  for (const anomaly of anomalies) {
    notifications.push(event({
      type: "anomaly_detected",
      title: "High-severity spending anomaly",
      message: anomaly.explanation,
      relatedEntityType: "anomaly",
      relatedEntityId: anomaly._id,
      severity: anomaly.severity,
      deduplicationKey: `anomaly:${anomaly._id}`,
      metadata: { transactionId: anomaly.transactionId, anomalySeverity: anomaly.severity },
    }));
  }

  const localDay = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    day: "2-digit",
  }).format(now));
  if (localDay >= 20) {
    const comparison = await getPeriodComparison(user, { period: "month", timezone }, now);
    const current = comparison.metrics.expense.current;
    const previous = comparison.metrics.expense.previous;
    if (previous >= 100_000 && current - previous >= 100_000 && current >= previous * 1.5) {
      const month = comparison.currentPeriod.startDate.slice(0, 7);
      notifications.push(event({
        type: "spending_increase",
        title: "Monthly spending is significantly higher",
        message: `Spending this month is ${Math.round((current / previous - 1) * 100)}% higher than last month.`,
        relatedEntityType: "user",
        relatedEntityId: userId,
        severity: "warning",
        deduplicationKey: `spending-increase:${month}`,
        metadata: { currentMonthExpensePaise: current, previousMonthExpensePaise: previous },
      }));
    }
  }

  const boundedNotifications = notifications.slice(0, MAX_NOTIFICATIONS_PER_USER);
  const created = await createNotifications(userId, boundedNotifications, { now });
  return {
    evaluatedEvents: boundedNotifications.length,
    createdCount: created.length,
    duplicateCount: boundedNotifications.length - created.length,
    eventsTruncated: notifications.length > boundedNotifications.length,
  };
}

export async function runNotificationDetectionBatch({ afterUserId, limit = MAX_USERS_PER_BATCH, now = new Date() } = {}) {
  const boundedLimit = Math.min(Math.max(1, limit), MAX_USERS_PER_BATCH);
  const query = afterUserId ? { _id: { $gt: new Types.ObjectId(String(afterUserId)) } } : {};
  const users = await User.find(query)
    .sort({ _id: 1 })
    .limit(boundedLimit)
    .select("_id timezone")
    .lean();
  const results = [];
  for (const user of users) {
    try {
      results.push({ userId: user._id, ...(await detectUserNotifications(user, { now })) });
    } catch (error) {
      process.emitWarning("Notification detection failed for a user", {
        code: "NOTIFICATION_DETECTION_ERROR",
      });
      results.push({ userId: user._id, error: true });
    }
  }
  return {
    results,
    nextAfterUserId: users.length === boundedLimit ? users.at(-1)._id : null,
    usersProcessed: users.length,
  };
}

export async function notifyRecurringJobFailures(results, {
  notify,
  onFailure = () => process.emitWarning("A recurring failure notification could not be created", {
    code: "NOTIFICATION_CREATE_ERROR",
  }),
  now = new Date(),
} = {}) {
  let failures = 0;
  for (const result of results.filter((item) => !item.success && item.userId && item.scheduleName && item.dueDate)) {
    try {
      await (notify || createNotification)(result.userId, event({
        type: "recurring_failed",
        title: "Recurring transaction could not be generated",
        message: `${result.scheduleName} could not be generated. Review the schedule and wallet settings.`,
        relatedEntityType: "recurring_transaction",
        relatedEntityId: result.scheduleId,
        severity: "high",
        deduplicationKey: `recurring-failed:${result.scheduleId}:${new Date(result.dueDate).toISOString().slice(0, 10)}`,
        metadata: { dueDate: result.dueDate, failureCode: result.errorCode || "GENERATION_FAILED" },
      }), { now });
    } catch {
      failures += 1;
      onFailure();
    }
  }
  return { failures };
}
