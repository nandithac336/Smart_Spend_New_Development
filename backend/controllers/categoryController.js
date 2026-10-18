import { Category } from "../models/Category.js";
import { Transaction } from "../models/Transaction.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listCategories = asyncHandler(async (req, res) => {
  const filter = { $or: [{ userId: null }, { userId: req.user._id }] };
  if (req.validated.query.type) filter.type = req.validated.query.type;
  const categories = await Category.find(filter).sort({ type: 1, userId: 1, name: 1 });
  res.json({ success: true, data: categories });
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create({ ...req.validated.body, userId: req.user._id });
  res.status(201).json({ success: true, data: category });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id, userId: req.user._id }); // only custom ones
  if (!category) throw ApiError.notFound("Custom category not found");
  if (await Transaction.exists({ userId: req.user._id, categoryId: category._id })) {
    throw ApiError.conflict("This category is used by transactions and cannot be deleted");
  }
  await category.deleteOne();
  res.json({ success: true, message: "Category deleted" });
});
