import { asyncHandler } from "../utils/asyncHandler.js";
import {
  acceptCategorySuggestion,
  bulkSuggestTransactionCategories,
  createOrUpdateMerchantRule,
  deleteMerchantRule,
  listCategorySuggestions,
  listMerchantRules,
  rejectCategorySuggestion,
  suggestTransactionCategory,
  updateMerchantRule,
} from "../services/categorizationService.js";

export const suggestCategory = asyncHandler(async (req, res) => {
  const data = await suggestTransactionCategory({
    userId: req.user._id,
    transactionId: req.validated.body.transactionId,
  });
  res.json({ success: true, data });
});

export const bulkSuggestCategories = asyncHandler(async (req, res) => {
  const data = await bulkSuggestTransactionCategories(
    req.user._id,
    req.validated.body.transactionIds
  );
  res.json({ success: true, data });
});

export const getCategorySuggestions = asyncHandler(async (req, res) => {
  const result = await listCategorySuggestions(req.user._id, req.validated.query);
  res.json({ success: true, ...result });
});

export const acceptSuggestion = asyncHandler(async (req, res) => {
  const result = await acceptCategorySuggestion(
    req.user._id,
    req.validated.params.id,
    req.validated.body.categoryId
  );
  res.json({
    success: true,
    data: { suggestion: result.suggestion, transaction: result.transaction },
    duplicate: result.duplicate,
  });
});

export const rejectSuggestion = asyncHandler(async (req, res) => {
  const result = await rejectCategorySuggestion(
    req.user._id,
    req.validated.params.id,
    req.validated.body.categoryId
  );
  res.json({
    success: true,
    data: { suggestion: result.suggestion, transaction: result.transaction },
    duplicate: result.duplicate,
  });
});

export const getMerchantRules = asyncHandler(async (req, res) => {
  const result = await listMerchantRules(req.user._id, req.validated.query);
  res.json({ success: true, ...result });
});

export const createMerchantRule = asyncHandler(async (req, res) => {
  const data = await createOrUpdateMerchantRule(req.user._id, req.validated.body);
  res.status(200).json({ success: true, data });
});

export const patchMerchantRule = asyncHandler(async (req, res) => {
  const data = await updateMerchantRule(
    req.user._id,
    req.validated.params.id,
    req.validated.body
  );
  res.json({ success: true, data });
});

export const removeMerchantRule = asyncHandler(async (req, res) => {
  const data = await deleteMerchantRule(req.user._id, req.validated.params.id);
  res.json({ success: true, data });
});
