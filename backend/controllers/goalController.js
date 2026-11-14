import { Goal } from "../models/Goal.js";
import { Wallet } from "../models/Wallet.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getGoalProgress,
  getGoalSummary,
  listGoalContributions,
  recordGoalAmountChange,
} from "../services/goalService.js";

async function assertWallet(userId, walletId) {
  if (!walletId) return;
  const wallet = await Wallet.findOne({ _id: walletId, userId, archived: false });
  if (!wallet) throw ApiError.badRequest("Active wallet not found");
}

function goalWithProgress(goal, user) {
  const data = goal.toObject ? goal.toObject() : goal;
  return {
    ...data,
    id: data._id,
    progress: getGoalProgress(data, new Date(), user.timezone || "Asia/Kolkata"),
  };
}

async function findOwnedGoal(userId, goalId) {
  const goal = await Goal.findOne({ _id: goalId, userId });
  if (!goal) throw ApiError.notFound("Goal not found");
  return goal;
}

function amountError(error) {
  if (error.code === "GOAL_AMOUNT_INVALID") throw ApiError.badRequest(error.message);
  if (error.code === "GOAL_CONFLICT") throw ApiError.conflict(error.message);
  throw error;
}

export const createGoal = asyncHandler(async (req, res) => {
  const body = req.validated.body;
  await assertWallet(req.user._id, body.walletId);
  const goal = await Goal.create({ ...body, userId: req.user._id });
  res.status(201).json({ success: true, data: goalWithProgress(goal, req.user) });
});

export const listGoals = asyncHandler(async (req, res) => {
  const filter = { userId: req.user._id };
  if (req.validated.query.status) filter.status = req.validated.query.status;
  else if (req.validated.query.includeArchived !== "true") filter.status = { $ne: "archived" };
  const goals = await Goal.find(filter).sort({ targetDate: 1, createdAt: -1 }).lean();
  res.json({ success: true, data: goals.map((goal) => goalWithProgress(goal, req.user)) });
});

export const getGoal = asyncHandler(async (req, res) => {
  const goal = await findOwnedGoal(req.user._id, req.validated.params.id);
  res.json({ success: true, data: goalWithProgress(goal, req.user) });
});

export const updateGoal = asyncHandler(async (req, res) => {
  const goal = await findOwnedGoal(req.user._id, req.validated.params.id);
  if (goal.status === "archived") throw ApiError.conflict("Archived goals cannot be updated");
  const changes = req.validated.body;
  await assertWallet(req.user._id, changes.walletId === undefined ? goal.walletId : changes.walletId);

  const targetAmount = changes.targetAmount ?? goal.targetAmount;
  if (targetAmount < goal.savedAmount) {
    throw ApiError.badRequest("Target amount cannot be lower than the amount already saved");
  }
  Object.assign(goal, changes);
  if (goal.status !== "paused") {
    goal.status = goal.savedAmount >= goal.targetAmount ? "completed" : "active";
  }
  await goal.save();
  res.json({ success: true, data: goalWithProgress(goal, req.user) });
});

export const getGoalProgressById = asyncHandler(async (req, res) => {
  const goal = await findOwnedGoal(req.user._id, req.validated.params.id);
  res.json({ success: true, data: goalWithProgress(goal, req.user) });
});

export const addGoalContribution = asyncHandler(async (req, res) => {
  let result;
  try {
    result = await recordGoalAmountChange({
      userId: req.user._id,
      goalId: req.validated.params.id,
      ...req.validated.body,
      type: "contribution",
      contributionDate: req.validated.body.contributionDate ?? new Date(),
    });
  } catch (error) {
    amountError(error);
  }
  if (!result.goal) throw ApiError.notFound("Goal not found");
  res.status(201).json({
    success: true,
    data: { contribution: result.contribution, goal: goalWithProgress(result.goal, req.user) },
  });
});

export const listGoalContributionHistory = asyncHandler(async (req, res) => {
  await findOwnedGoal(req.user._id, req.validated.params.id);
  const data = await listGoalContributions(req.user._id, req.validated.params.id);
  res.json({ success: true, data });
});

export const withdrawGoalAmount = asyncHandler(async (req, res) => {
  let result;
  try {
    result = await recordGoalAmountChange({
      userId: req.user._id,
      goalId: req.validated.params.id,
      ...req.validated.body,
      type: "withdrawal",
      contributionDate: req.validated.body.contributionDate ?? new Date(),
    });
  } catch (error) {
    amountError(error);
  }
  if (!result.goal) throw ApiError.notFound("Goal not found");
  res.status(201).json({
    success: true,
    data: { contribution: result.contribution, goal: goalWithProgress(result.goal, req.user) },
  });
});

async function changeGoalStatus(req, status) {
  const goal = await findOwnedGoal(req.user._id, req.validated.params.id);
  if (goal.status === "archived") throw ApiError.conflict("Archived goals cannot change status");
  if (status === "paused" && goal.status !== "active") throw ApiError.conflict("Only active goals can be paused");
  if (status === "active" && goal.status !== "paused") throw ApiError.conflict("Only paused goals can be resumed");
  goal.status = status === "active" && goal.savedAmount >= goal.targetAmount ? "completed" : status;
  await goal.save();
  return goal;
}

export const pauseGoal = asyncHandler(async (req, res) => {
  const goal = await changeGoalStatus(req, "paused");
  res.json({ success: true, data: goalWithProgress(goal, req.user) });
});

export const resumeGoal = asyncHandler(async (req, res) => {
  const goal = await changeGoalStatus(req, "active");
  res.json({ success: true, data: goalWithProgress(goal, req.user) });
});

export const archiveGoal = asyncHandler(async (req, res) => {
  const goal = await findOwnedGoal(req.user._id, req.validated.params.id);
  goal.status = "archived";
  await goal.save();
  res.json({ success: true, data: { id: goal._id, status: goal.status } });
});

export const getGoalsSummary = asyncHandler(async (req, res) => {
  const data = await getGoalSummary(req.user._id, req.user.timezone || "Asia/Kolkata");
  res.json({ success: true, data });
});
