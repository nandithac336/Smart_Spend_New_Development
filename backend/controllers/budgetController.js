import { Budget } from "../models/Budget.js";
import { Category } from "../models/Category.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { assertBudgetPeriodDates, getBudgetProgress, getBudgetSummary } from "../services/budgetService.js";

async function assertCategory(userId, categoryId) {
  if (!categoryId) return;
  const category = await Category.findOne({
    _id: categoryId,
    type: "expense",
    $or: [{ userId: null }, { userId }],
  });
  if (!category) throw ApiError.badRequest("Expense category not found");
}

async function assertNoOverlap({ userId, categoryId, period, startDate, endDate, excludeId }) {
  const filter = {
    userId,
    categoryId: categoryId ?? null,
    period,
    status: "active",
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  };
  if (excludeId) filter._id = { $ne: excludeId };
  if (await Budget.exists(filter)) {
    throw ApiError.conflict("An active budget already overlaps this category and period");
  }
}

async function withProgress(budget, user) {
  const data = budget.toObject ? budget.toObject() : budget;
  return { ...data, id: data._id, progress: await getBudgetProgress(data, user) };
}

function activeFilter(userId, includeArchived) {
  return includeArchived ? { userId } : { userId, status: "active" };
}

export const createBudget = asyncHandler(async (req, res) => {
  const body = req.validated.body;
  const userId = req.user._id;
  try {
    assertBudgetPeriodDates(body.period, body.startDate, body.endDate, req.user.timezone || "Asia/Kolkata");
  } catch (error) {
    throw ApiError.badRequest(error.message);
  }
  await assertCategory(userId, body.categoryId);
  await assertNoOverlap({ userId, ...body });

  const budget = await Budget.create({ ...body, userId });
  res.status(201).json({ success: true, data: await withProgress(budget, req.user) });
});

export const listBudgets = asyncHandler(async (req, res) => {
  const budgets = await Budget.find(activeFilter(req.user._id, req.validated.query.includeArchived === "true"))
    .sort({ startDate: -1, createdAt: -1 });
  const data = await Promise.all(budgets.map((budget) => withProgress(budget, req.user)));
  res.json({ success: true, data });
});

export const getBudget = asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({ _id: req.validated.params.id, userId: req.user._id });
  if (!budget) throw ApiError.notFound("Budget not found");
  res.json({ success: true, data: await withProgress(budget, req.user) });
});

export const updateBudget = asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({ _id: req.validated.params.id, userId: req.user._id });
  if (!budget) throw ApiError.notFound("Budget not found");

  const changes = req.validated.body;
  const next = { ...budget.toObject(), ...changes };
  try {
    assertBudgetPeriodDates(next.period, next.startDate, next.endDate, req.user.timezone || "Asia/Kolkata");
  } catch (error) {
    throw ApiError.badRequest(error.message);
  }
  await assertCategory(req.user._id, next.categoryId);
  if (next.status === "active") {
    await assertNoOverlap({
      userId: req.user._id,
      categoryId: next.categoryId,
      period: next.period,
      startDate: next.startDate,
      endDate: next.endDate,
      excludeId: budget._id,
    });
  }

  Object.assign(budget, changes);
  await budget.save();
  res.json({ success: true, data: await withProgress(budget, req.user) });
});

export const archiveBudget = asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({ _id: req.validated.params.id, userId: req.user._id });
  if (!budget) throw ApiError.notFound("Budget not found");
  budget.status = "archived";
  await budget.save();
  res.json({ success: true, data: { id: budget._id, status: budget.status } });
});

export const getBudgetProgressById = asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({ _id: req.validated.params.id, userId: req.user._id });
  if (!budget) throw ApiError.notFound("Budget not found");
  res.json({ success: true, data: await withProgress(budget, req.user) });
});

export const getBudgetsSummary = asyncHandler(async (req, res) => {
  const budgets = await Budget.find(activeFilter(req.user._id, req.validated.query.includeArchived === "true"))
    .sort({ startDate: -1, createdAt: -1 });
  const data = await Promise.all(budgets.map((budget) => withProgress(budget, req.user)));
  res.json({ success: true, data: { summary: getBudgetSummary(data.map((item) => item.progress)), budgets: data } });
});
