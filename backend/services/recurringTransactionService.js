import crypto from "node:crypto";
import { Category } from "../models/Category.js";
import { RecurringTransaction } from "../models/RecurringTransaction.js";
import { Transaction } from "../models/Transaction.js";
import { User } from "../models/User.js";
import { Wallet } from "../models/Wallet.js";
import { startOfLocalDate } from "../utils/dates.js";
import { makeDedupeHash, toMerchantKey } from "../utils/merchant.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function dateParts(value) {
  const date = new Date(value);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function dateFromParts(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function calculateNextDueDate(frequency, dueDate, startDate = dueDate) {
  const due = dateParts(dueDate);
  const anchor = dateParts(startDate);

  if (frequency === "daily") return new Date(new Date(dueDate).getTime() + DAY_MS);
  if (frequency === "weekly") return new Date(new Date(dueDate).getTime() + 7 * DAY_MS);
  if (frequency === "monthly") {
    const monthIndex = due.year * 12 + due.month - 1;
    const nextMonthIndex = monthIndex + 1;
    const year = Math.floor(nextMonthIndex / 12);
    const month = (nextMonthIndex % 12) + 1;
    return dateFromParts(year, month, Math.min(anchor.day, daysInMonth(year, month)));
  }
  if (frequency === "yearly") {
    const year = due.year + 1;
    return dateFromParts(year, anchor.month, Math.min(anchor.day, daysInMonth(year, anchor.month)));
  }
  throw new RangeError("Unsupported recurring frequency");
}

export function getRecurringClientId(scheduleId, dueDate) {
  const bytes = crypto
    .createHash("sha256")
    .update(`${scheduleId}:${new Date(dueDate).toISOString().slice(0, 10)}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getCalendarDateForTimeZone(now, timeZone) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  return dateFromParts(values.year, values.month, values.day);
}

async function validateScheduleReferences(schedule, session) {
  const wallet = await Wallet.findOne({
    _id: schedule.walletId,
    userId: schedule.userId,
    archived: false,
  }).session(session);
  if (!wallet) throw new Error("Recurring transaction wallet is unavailable or not owned by the user");

  if (schedule.categoryId) {
    const category = await Category.findOne({
      _id: schedule.categoryId,
      type: schedule.type,
      $or: [{ userId: null }, { userId: schedule.userId }],
    }).session(session);
    if (!category) throw new Error("Recurring transaction category is unavailable or not valid for its type");
  }
}

async function generateDueOccurrence(scheduleId, dueThrough, now) {
  const session = await RecurringTransaction.startSession();
  let outcome = { generated: false, completed: false };
  try {
    await session.withTransaction(async () => {
      outcome = { generated: false, completed: false };
      const schedule = await RecurringTransaction.findOne({
        _id: scheduleId,
        status: "active",
        nextDueDate: { $lte: dueThrough },
      }).session(session);
      if (!schedule) return;

      const dueDate = new Date(schedule.nextDueDate);
      if (schedule.endDate && dueDate > schedule.endDate) {
        schedule.status = "completed";
        await schedule.save({ session });
        outcome = { generated: false, completed: true };
        return;
      }

      await validateScheduleReferences(schedule, session);

      const user = await User.findById(schedule.userId).session(session);
      if (!user) throw new Error("Recurring transaction user no longer exists");
      const txnDate = startOfLocalDate(user.timezone || "Asia/Kolkata", dueDate);
      const clientId = getRecurringClientId(schedule._id, dueDate);
      const existing = await Transaction.findOne({ userId: schedule.userId, clientId }).session(session);

      if (existing) {
        if (String(existing.recurringScheduleId) !== String(schedule._id)) {
          throw new Error("Recurring transaction idempotency key conflicts with another transaction");
        }
      } else {
        const merchantKey = toMerchantKey(schedule.name);
        await Transaction.create(
          [
            {
              userId: schedule.userId,
              walletId: schedule.walletId,
              type: schedule.type,
              amount: schedule.amount,
              categoryId: schedule.categoryId,
              merchant: schedule.name,
              merchantKey,
              note: schedule.description,
              txnDate,
              capturedAt: now,
              source: "recurring",
              status: "confirmed",
              clientId,
              recurringScheduleId: schedule._id,
              dedupeHash: makeDedupeHash({
                userId: schedule.userId,
                merchantKey,
                amount: schedule.amount,
                txnDate,
              }),
            },
          ],
          { session }
        );
      }

      const nextDueDate = calculateNextDueDate(schedule.frequency, dueDate, schedule.startDate);
      schedule.lastGeneratedDate = dueDate;
      schedule.nextDueDate = nextDueDate;
      if (schedule.endDate && nextDueDate > schedule.endDate) schedule.status = "completed";
      await schedule.save({ session });
      outcome = { generated: !existing, completed: schedule.status === "completed", dueDate };
    });
  } finally {
    await session.endSession();
  }
  return outcome;
}

export async function processDueRecurringTransactions({ now = new Date(), userId, maxOccurrences = 100 } = {}) {
  if (!Number.isInteger(maxOccurrences) || maxOccurrences < 1 || maxOccurrences > 1000) {
    throw new RangeError("maxOccurrences must be an integer between 1 and 1000");
  }
  const filter = { status: "active", nextDueDate: { $lte: new Date(now.getTime() + 14 * 60 * 60 * 1000) } };
  if (userId) filter.userId = userId;
  const schedules = await RecurringTransaction.find(filter)
    .select("_id userId name nextDueDate")
    .sort({ nextDueDate: 1, _id: 1 })
    .lean();
  const results = [];

  for (const { _id, userId: scheduleUserId, name, nextDueDate } of schedules) {
    let processed = 0;
    try {
      const user = await User.findById(scheduleUserId).select("timezone").lean();
      if (!user) throw new Error("Recurring transaction user no longer exists");
      const dueThrough = getCalendarDateForTimeZone(now, user.timezone || "Asia/Kolkata");
      while (processed < maxOccurrences) {
        const outcome = await generateDueOccurrence(_id, dueThrough, now);
        if (!outcome.generated && !outcome.completed) break;
        if (outcome.generated) processed += 1;
        if (outcome.completed) break;
      }
      results.push({
        scheduleId: _id,
        userId: scheduleUserId,
        scheduleName: name,
        dueDate: nextDueDate,
        generated: processed,
        success: true,
      });
    } catch (error) {
      process.emitWarning(
        `Recurring schedule ${_id} failed: ${error.message}`,
        { code: "RECURRING_TRANSACTION_JOB_ERROR" }
      );
      results.push({
        scheduleId: _id,
        userId: scheduleUserId,
        scheduleName: name,
        dueDate: nextDueDate,
        generated: processed,
        success: false,
        error: error.message,
        errorCode: error.code,
      });
    }
  }
  return results;
}

export async function listUpcomingRecurringTransactions(user, { days = 30, now = new Date(), limit } = {}) {
  const today = getCalendarDateForTimeZone(now, user.timezone || "Asia/Kolkata");
  const horizon = new Date(today.getTime() + days * DAY_MS);
  let query = RecurringTransaction.find({
    userId: user._id,
    status: "active",
    nextDueDate: { $gte: today, $lte: horizon },
  })
    .sort({ nextDueDate: 1 });
  if (Number.isInteger(limit) && limit > 0) query = query.limit(limit);
  return query.populate([
      { path: "walletId", select: "name type" },
      { path: "categoryId", select: "name icon type" },
    ])
    .lean();
}
