import { Types } from "mongoose";
import { Category } from "../models/Category.js";
import { RecurringTransaction } from "../models/RecurringTransaction.js";
import { Subscription } from "../models/Subscription.js";
import { Transaction } from "../models/Transaction.js";
import { calculateNextDueDate } from "./recurringTransactionService.js";
import { getConfirmedSubscriptionForecast } from "./subscriptionService.js";

const DAY_MS = 86_400_000;

export function calendarDateParts(value) {
  const date = new Date(value);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function calendarDate(year, month, day = 1) {
  return new Date(Date.UTC(year, month - 1, day));
}

export function addCalendarMonths(value, count) {
  const { year, month } = calendarDateParts(value);
  const index = year * 12 + month - 1 + count;
  return calendarDate(Math.floor(index / 12), (index % 12) + 1);
}

export function calendarMonthKey(value) {
  const { year, month } = calendarDateParts(value);
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function daysInCalendarMonth(value) {
  const { year, month } = calendarDateParts(value);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function enumerateCalendarMonths(start, endExclusive) {
  const months = [];
  for (let cursor = new Date(start); cursor < endExclusive; cursor = addCalendarMonths(cursor, 1)) {
    months.push(calendarMonthKey(cursor));
  }
  return months;
}

export function localDateKey(value, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const dateParts = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

export async function getMonthlyExpenseFeatures(userId, start, endExclusive, timeZone, excludedTransactionIds = []) {
  const rows = await Transaction.aggregate([
    {
      $match: {
        userId: new Types.ObjectId(String(userId)),
        type: "expense",
        status: "confirmed",
        deletedAt: null,
        txnDate: { $gte: start, $lt: endExclusive },
        ...(excludedTransactionIds.length
          ? { _id: { $nin: excludedTransactionIds.map((id) => new Types.ObjectId(String(id))) } }
          : {}),
      },
    },
    {
      $group: {
        _id: {
          month: { $dateToString: { date: "$txnDate", format: "%Y-%m", timezone: timeZone } },
          categoryId: "$categoryId",
          recurring: { $eq: ["$source", "recurring"] },
        },
        totalPaise: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.month": 1 } },
  ]);
  return rows.map((row) => ({
    month: row._id.month,
    categoryId: row._id.categoryId ? String(row._id.categoryId) : null,
    recurring: row._id.recurring,
    totalPaise: row.totalPaise,
    count: row.count,
  }));
}

export async function getConfirmedSubscriptionTransactionIds(userId, afterDate, beforeDate) {
  const subscriptions = await Subscription.find({
    userId: new Types.ObjectId(String(userId)),
    status: "confirmed",
    "detectionEvidence.payments.paidAt": { $gte: afterDate, $lt: beforeDate },
  })
    .sort({ _id: 1 })
    .limit(5_000)
    .select("detectionEvidence.payments.transactionId detectionEvidence.payments.paidAt")
    .lean();
  return subscriptions.flatMap((subscription) =>
    (subscription.detectionEvidence?.payments || [])
      .filter((payment) => payment.paidAt >= afterDate && payment.paidAt < beforeDate)
      .map((payment) => payment.transactionId)
  );
}

export async function getVisibleExpenseCategories(userId) {
  return Category.find({
    type: "expense",
    $or: [{ userId: null }, { userId: new Types.ObjectId(String(userId)) }],
  })
    .select("_id name icon")
    .sort({ name: 1 })
    .limit(250)
    .lean();
}

function dueDatesForSchedule(schedule, targetStartKey, targetEndKey, firstEligibleKey) {
  const dueDates = [];
  let dueDate = new Date(schedule.nextDueDate);
  let iterations = 0;
  while (dueDate.toISOString().slice(0, 10) < targetEndKey && iterations < 1_000) {
    const key = dueDate.toISOString().slice(0, 10);
    if (
      key >= targetStartKey &&
      key >= firstEligibleKey &&
      (!schedule.endDate || key <= schedule.endDate.toISOString().slice(0, 10))
    ) {
      dueDates.push(key);
    }
    dueDate = calculateNextDueDate(schedule.frequency, dueDate, schedule.startDate);
    iterations += 1;
  }
  return dueDates;
}

export async function getScheduledExpenseForecast({
  userId,
  targetStart,
  targetEnd,
  targetStartKey,
  targetEndKey,
  todayKey,
  timeZone,
  now,
}) {
  const schedules = await RecurringTransaction.find({
    userId,
    type: "expense",
    status: "active",
    nextDueDate: { $lt: targetEnd },
  })
    .sort({ nextDueDate: 1, _id: 1 })
    .limit(300)
    .select("_id name amount categoryId frequency startDate nextDueDate endDate")
    .lean();

  const [generated, activeSchedules] = await Promise.all([
    Transaction.find({
      userId,
      type: "expense",
      status: "confirmed",
      deletedAt: null,
      source: "recurring",
      recurringScheduleId: { $type: "objectId" },
      txnDate: { $gte: targetStart, $lt: targetEnd },
    })
      .select("recurringScheduleId txnDate amount categoryId")
      .sort({ txnDate: 1, _id: 1 })
      .limit(2_001)
      .lean(),
    RecurringTransaction.find({ userId, type: "expense", status: "active" })
      .select("name")
      .limit(1_001)
      .lean(),
  ]);
  const generatedTruncated = generated.length > 2_000;
  if (generatedTruncated) generated.length = 2_000;
  const generatedByKey = new Map(generated.map((item) => [
    `${String(item.recurringScheduleId)}:${localDateKey(item.txnDate, timeZone)}`,
    item,
  ]));
  const occurrences = [];
  let truncated = false;
  for (const schedule of schedules) {
    const dueDates = dueDatesForSchedule(schedule, targetStartKey, targetEndKey, todayKey);
    for (const date of dueDates) {
      const key = `${String(schedule._id)}:${date}`;
      const alreadyGenerated = generatedByKey.get(key);
      if (alreadyGenerated) {
        if (alreadyGenerated.txnDate > now) {
          occurrences.push({
            date,
            scheduleId: String(schedule._id),
            name: schedule.name,
            amountPaise: alreadyGenerated.amount,
            categoryId: alreadyGenerated.categoryId ? String(alreadyGenerated.categoryId) : null,
            alreadyRecorded: true,
          });
        }
        continue;
      }
      if (occurrences.length >= 2_000) {
        truncated = true;
        break;
      }
      occurrences.push({
        date,
        scheduleId: String(schedule._id),
        name: schedule.name,
        amountPaise: schedule.amount,
        categoryId: schedule.categoryId ? String(schedule.categoryId) : null,
      });
    }
    if (truncated) break;
  }
  for (const generatedTransaction of generated) {
    const date = localDateKey(generatedTransaction.txnDate, timeZone);
    if (
      generatedTransaction.txnDate > now &&
      date >= targetStartKey &&
      date < targetEndKey &&
      !occurrences.some((item) =>
        item.scheduleId === String(generatedTransaction.recurringScheduleId) &&
        item.date === date
      )
    ) {
      if (occurrences.length >= 2_000) {
        truncated = true;
        break;
      }
      occurrences.push({
        date,
        scheduleId: String(generatedTransaction.recurringScheduleId),
        name: "Scheduled expense",
        amountPaise: generatedTransaction.amount,
        categoryId: generatedTransaction.categoryId ? String(generatedTransaction.categoryId) : null,
        alreadyRecorded: true,
      });
    }
  }
  const subscriptionForecast = await getConfirmedSubscriptionForecast(userId, {
    targetStart,
    targetEnd,
    now,
    timeZone,
    excludedMerchants: activeSchedules.map((schedule) => schedule.name),
  });
  for (const occurrence of subscriptionForecast.occurrences) {
    if (occurrences.length >= 2_000) {
      truncated = true;
      break;
    }
    occurrences.push(occurrence);
  }
  const byCategory = {};
  const subscriptionsByCategory = {};
  let subscriptionsPaise = 0;
  for (const occurrence of occurrences) {
    const key = occurrence.categoryId || "uncategorized";
    byCategory[key] = (byCategory[key] || 0) + occurrence.amountPaise;
    if (occurrence.subscriptionId) {
      subscriptionsPaise += occurrence.amountPaise;
      subscriptionsByCategory[key] = (subscriptionsByCategory[key] || 0) + occurrence.amountPaise;
    }
  }
  return {
    totalPaise: occurrences.reduce((sum, item) => sum + item.amountPaise, 0),
    subscriptionsPaise,
    byCategory,
    subscriptionsByCategory,
    occurrences,
    truncated: truncated || schedules.length === 300 || generatedTruncated ||
      activeSchedules.length === 1_001 || subscriptionForecast.truncated,
  };
}

export function getDateRangeForMonths(monthKeys) {
  if (!monthKeys.length) return null;
  const [year, month] = monthKeys[0].split("-").map(Number);
  const [endYear, endMonth] = monthKeys.at(-1).split("-").map(Number);
  return {
    start: calendarDate(year, month),
    end: calendarDate(endYear, endMonth + 1),
  };
}
