import { Goal } from "../models/Goal.js";
import { GoalContribution } from "../models/GoalContribution.js";

function localCalendarParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}

function targetCalendarParts(date) {
  const value = new Date(date);
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

export function getGoalProgress(goal, now = new Date(), timeZone = "Asia/Kolkata") {
  const remainingAmount = Math.max(0, goal.targetAmount - goal.savedAmount);
  const percentageComplete = Math.min(100, Number(((goal.savedAmount / goal.targetAmount) * 100).toFixed(2)));
  const today = localCalendarParts(now, timeZone);
  const target = targetCalendarParts(goal.targetDate);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  const targetUtc = Date.UTC(target.year, target.month - 1, target.day);
  const daysRemaining = Math.max(0, Math.ceil((targetUtc - todayUtc) / 86_400_000));
  const monthsRemaining =
    (target.year - today.year) * 12 + target.month - today.month + (target.day >= today.day ? 1 : 0);

  return {
    targetAmount: goal.targetAmount,
    savedAmount: goal.savedAmount,
    remainingAmount,
    percentageComplete,
    isCompleted: goal.savedAmount >= goal.targetAmount,
    daysRemaining,
    requiredMonthlySavings:
      remainingAmount === 0 || targetUtc < todayUtc
        ? 0
        : Math.ceil(remainingAmount / Math.max(1, monthsRemaining)),
  };
}

export function validateContribution(goal, amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new RangeError("Amount must be positive whole paise");
  if (goal.status !== "active") throw new RangeError("Only active goals can receive contributions");
  if (amount > goal.targetAmount - goal.savedAmount) {
    throw new RangeError("Contribution cannot exceed the remaining target amount");
  }
}

export function validateWithdrawal(goal, amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new RangeError("Amount must be positive whole paise");
  if (!["active", "completed"].includes(goal.status)) {
    throw new RangeError("Only active or completed goals can be withdrawn from");
  }
  if (amount > goal.savedAmount) throw new RangeError("Withdrawal cannot exceed the saved amount");
}

export async function recordGoalAmountChange({ userId, goalId, amount, type, contributionDate, note }) {
  const session = await Goal.startSession();
  let updatedGoal;
  let contribution;
  try {
    await session.withTransaction(async () => {
      const goal = await Goal.findOne({ _id: goalId, userId }).session(session);
      if (!goal) return;

      try {
        if (type === "contribution") validateContribution(goal, amount);
        else validateWithdrawal(goal, amount);
      } catch (error) {
        const validationError = new Error(error.message);
        validationError.code = "GOAL_AMOUNT_INVALID";
        throw validationError;
      }

      const savedAmount = type === "contribution" ? goal.savedAmount + amount : goal.savedAmount - amount;
      const status =
        type === "contribution"
          ? savedAmount === goal.targetAmount
            ? "completed"
            : "active"
          : savedAmount < goal.targetAmount
            ? "active"
            : "completed";
      updatedGoal = await Goal.findOneAndUpdate(
        { _id: goalId, userId, savedAmount: goal.savedAmount, status: goal.status },
        { $set: { savedAmount, status } },
        { returnDocument: "after", runValidators: true, session }
      );
      if (!updatedGoal) {
        const conflict = new Error("Goal changed during contribution; retry the request");
        conflict.code = "GOAL_CONFLICT";
        throw conflict;
      }

      [contribution] = await GoalContribution.create(
        [{ userId, goalId, type, amount, contributionDate, note }],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  return { goal: updatedGoal, contribution };
}

export async function getGoalSummary(userId, timeZone, { limit } = {}) {
  let query = Goal.find({ userId, status: { $ne: "archived" } });
  if (Number.isInteger(limit) && limit > 0) query = query.sort({ targetDate: 1, _id: 1 }).limit(limit);
  const goals = await query.lean();
  const summary = goals.reduce(
    (result, goal) => {
      result.goalCount += 1;
      result.totalTargetAmount += goal.targetAmount;
      result.totalSavedAmount += goal.savedAmount;
      if (goal.status === "active") result.activeCount += 1;
      if (goal.status === "paused") result.pausedCount += 1;
      if (goal.status === "completed") result.completedCount += 1;
      return result;
    },
    { goalCount: 0, activeCount: 0, pausedCount: 0, completedCount: 0, totalTargetAmount: 0, totalSavedAmount: 0 }
  );
  summary.totalRemainingAmount = Math.max(0, summary.totalTargetAmount - summary.totalSavedAmount);
  summary.percentageComplete = summary.totalTargetAmount
    ? Number(((summary.totalSavedAmount / summary.totalTargetAmount) * 100).toFixed(2))
    : 0;
  return { summary, goals: goals.map((goal) => ({ ...goal, progress: getGoalProgress(goal, new Date(), timeZone) })) };
}

export async function listGoalContributions(userId, goalId) {
  return GoalContribution.find({ userId, goalId }).sort({ contributionDate: -1, _id: -1 }).lean();
}
