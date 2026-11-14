import { Category } from "../models/Category.js";
import { RecurringTransaction } from "../models/RecurringTransaction.js";
import { Transaction } from "../models/Transaction.js";
import { Wallet } from "../models/Wallet.js";
import {
  calculateNextDueDate,
  getCalendarDateForTimeZone,
  listUpcomingRecurringTransactions,
} from "../services/recurringTransactionService.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

async function assertReferences(userId, values) {
  const wallet = await Wallet.findOne({ _id: values.walletId, userId, archived: false }).select("_id");
  if (!wallet) throw ApiError.badRequest("Active wallet not found");
  if (!values.categoryId) return;
  const category = await Category.findOne({
    _id: values.categoryId,
    type: values.type,
    $or: [{ userId: null }, { userId }],
  }).select("_id");
  if (!category) throw ApiError.badRequest("Category not found or does not match the transaction type");
}

function populateSchedule(query) {
  return query.populate([
    { path: "walletId", select: "name type" },
    { path: "categoryId", select: "name icon type" },
  ]);
}

async function findOwnedSchedule(userId, id) {
  const schedule = await RecurringTransaction.findOne({ _id: id, userId });
  if (!schedule) throw ApiError.notFound("Recurring transaction not found");
  return schedule;
}

export const createRecurringTransaction = asyncHandler(async (req, res) => {
  const body = req.validated.body;
  await assertReferences(req.user._id, body);
  const schedule = await RecurringTransaction.create({
    ...body,
    userId: req.user._id,
    nextDueDate: body.startDate,
  });
  res.status(201).json({ success: true, data: schedule });
});

export const listRecurringTransactions = asyncHandler(async (req, res) => {
  const filter = { userId: req.user._id };
  if (req.validated.query.status) filter.status = req.validated.query.status;
  const schedules = await populateSchedule(RecurringTransaction.find(filter).sort({ nextDueDate: 1, createdAt: -1 })).lean();
  res.json({ success: true, data: schedules });
});

export const listUpcomingTransactions = asyncHandler(async (req, res) => {
  const schedules = await listUpcomingRecurringTransactions(req.user, {
    days: req.validated.query.days,
  });
  res.json({ success: true, data: schedules });
});

export const getRecurringTransaction = asyncHandler(async (req, res) => {
  const schedule = await populateSchedule(
    RecurringTransaction.findOne({ _id: req.validated.params.id, userId: req.user._id })
  ).lean();
  if (!schedule) throw ApiError.notFound("Recurring transaction not found");
  res.json({ success: true, data: schedule });
});

export const updateRecurringTransaction = asyncHandler(async (req, res) => {
  const schedule = await findOwnedSchedule(req.user._id, req.validated.params.id);
  if (["completed", "cancelled"].includes(schedule.status)) {
    throw ApiError.conflict("Completed or cancelled schedules cannot be updated");
  }
  const changes = req.validated.body;
  const next = { ...schedule.toObject(), ...changes };
  if (changes.walletId !== undefined || changes.categoryId !== undefined || changes.type !== undefined) {
    await assertReferences(req.user._id, next);
  }
  if (next.startDate > next.endDate && next.endDate) {
    throw ApiError.badRequest("End date must be on or after start date");
  }

  Object.assign(schedule, changes);
  if (changes.frequency !== undefined || changes.startDate !== undefined) {
    const nextOccurrence = schedule.lastGeneratedDate
      ? calculateNextDueDate(schedule.frequency, schedule.lastGeneratedDate, schedule.startDate)
      : schedule.startDate;
    schedule.nextDueDate = nextOccurrence < schedule.startDate ? schedule.startDate : nextOccurrence;
  }
  if (schedule.endDate && schedule.nextDueDate > schedule.endDate) schedule.status = "completed";
  await schedule.save();
  res.json({ success: true, data: schedule });
});

async function setScheduleStatus(req, status) {
  const schedule = await findOwnedSchedule(req.user._id, req.validated.params.id);
  if (status === "paused" && schedule.status !== "active") {
    throw ApiError.conflict("Only active schedules can be paused");
  }
  if (status === "active" && schedule.status !== "paused") {
    throw ApiError.conflict("Only paused schedules can be resumed");
  }
  schedule.status = status;
  if (status === "active") {
    const today = getCalendarDateForTimeZone(new Date(), req.user.timezone || "Asia/Kolkata");
    if (schedule.endDate && schedule.nextDueDate > schedule.endDate) {
      schedule.status = "completed";
    }
    while (schedule.status === "active" && schedule.nextDueDate < today) {
      schedule.nextDueDate = calculateNextDueDate(schedule.frequency, schedule.nextDueDate, schedule.startDate);
    }
    if (schedule.status === "active" && schedule.endDate && schedule.nextDueDate > schedule.endDate) {
      schedule.status = "completed";
    }
  }
  await schedule.save();
  return schedule;
}

export const pauseRecurringTransaction = asyncHandler(async (req, res) => {
  const schedule = await setScheduleStatus(req, "paused");
  res.json({ success: true, data: schedule });
});

export const resumeRecurringTransaction = asyncHandler(async (req, res) => {
  const schedule = await setScheduleStatus(req, "active");
  res.json({ success: true, data: schedule });
});

export const cancelRecurringTransaction = asyncHandler(async (req, res) => {
  const schedule = await findOwnedSchedule(req.user._id, req.validated.params.id);
  if (schedule.status === "cancelled") throw ApiError.conflict("Schedule is already cancelled");
  schedule.status = "cancelled";
  await schedule.save();
  res.json({ success: true, data: schedule });
});

export const deleteRecurringTransaction = asyncHandler(async (req, res) => {
  const schedule = await findOwnedSchedule(req.user._id, req.validated.params.id);
  if (schedule.status !== "cancelled") {
    schedule.status = "cancelled";
    await schedule.save();
  }
  res.json({ success: true, data: { id: schedule._id, status: schedule.status } });
});

export const getRecurringTransactionHistory = asyncHandler(async (req, res) => {
  const schedule = await findOwnedSchedule(req.user._id, req.validated.params.id);
  const transactions = await Transaction.find({
    userId: req.user._id,
    recurringScheduleId: schedule._id,
  })
    .sort({ txnDate: -1 })
    .limit(500)
    .lean();
  res.json({ success: true, data: transactions });
});
