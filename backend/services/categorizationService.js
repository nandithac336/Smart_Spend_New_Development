import { z } from "zod";
import { Category } from "../models/Category.js";
import { CategorySuggestion } from "../models/CategorySuggestion.js";
import { MerchantCategoryRule } from "../models/MerchantCategoryRule.js";
import { Transaction } from "../models/Transaction.js";
import { ApiError } from "../utils/apiError.js";
import { toMerchantKey } from "../utils/merchant.js";
import { categorizeWithAi, isCategorizationAiEnabled } from "./categorizationAiProvider.js";
import { confidenceLevel, findKeywordCategory } from "./categorizationRules.js";

const aiResultSchema = z.object({
  suggestedCategoryId: z.string().regex(/^[0-9a-f]{24}$/i),
  confidenceScore: z.number().min(0).max(1),
  explanation: z.string().max(300),
  detectedMerchant: z.string().max(80).nullable(),
  alternatives: z.array(z.object({
    categoryId: z.string().regex(/^[0-9a-f]{24}$/i),
    confidenceScore: z.number().min(0).max(1),
    explanation: z.string().max(200).default(""),
  }).strict()).max(3).default([]),
}).strict();

const aiCache = new Map();
const aiRequestsInFlight = new Map();
const aiRequestsByUser = new Map();
const AI_CACHE_TTL_MS = 5 * 60 * 1000;
const AI_CACHE_MAX = 1000;
const AI_RATE_WINDOW_MS = 15 * 60 * 1000;
const AI_MAX_REQUESTS_PER_USER = 30;

function cacheGet(key) {
  const entry = aiCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    aiCache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  if (aiCache.size >= AI_CACHE_MAX) aiCache.delete(aiCache.keys().next().value);
  aiCache.set(key, { value, expiresAt: Date.now() + AI_CACHE_TTL_MS });
}

function memoized(memo, key, loader) {
  if (!memo) return loader();
  if (!memo.has(key)) memo.set(key, Promise.resolve().then(loader));
  return memo.get(key);
}

function allowAiRequest(userId) {
  const now = Date.now();
  const key = String(userId);
  const recent = (aiRequestsByUser.get(key) || []).filter((timestamp) => now - timestamp < AI_RATE_WINDOW_MS);
  if (recent.length >= AI_MAX_REQUESTS_PER_USER) {
    aiRequestsByUser.set(key, recent);
    return false;
  }
  recent.push(now);
  aiRequestsByUser.set(key, recent);
  if (aiRequestsByUser.size > 10_000) {
    for (const [user, timestamps] of aiRequestsByUser) {
      if (timestamps.every((timestamp) => now - timestamp >= AI_RATE_WINDOW_MS)) aiRequestsByUser.delete(user);
    }
  }
  return true;
}

function toAlternative(categoryId, confidence, explanation) {
  return { categoryId, confidence, explanation };
}

function validateCategory(userId, categoryId, transactionType, session) {
  const query = Category.findOne({
    _id: categoryId,
    type: transactionType,
    $or: [{ userId: null }, { userId }],
  });
  return session ? query.session(session) : query;
}

async function getVisibleCategories(userId, transactionType) {
  return Category.find({
    type: transactionType,
    $or: [{ userId: null }, { userId }],
  }).select("_id name type").sort({ name: 1 }).lean();
}

function makeDecision({ category, confidence, source, explanation, alternatives = [], detectedMerchant }) {
  const level = confidenceLevel(confidence);
  return {
    suggestedCategoryId: level === "low" ? null : category?._id ?? null,
    confidence,
    confidenceLevel: level,
    source,
    explanation: explanation.slice(0, 300),
    detectedMerchant: detectedMerchant || null,
    alternatives: alternatives.slice(0, 3),
  };
}

async function historicalDecision(transaction, categories) {
  if (!transaction.merchantKey) return null;
  const groups = await Transaction.aggregate([
    {
      $match: {
        userId: transaction.userId,
        _id: { $ne: transaction._id },
        merchantKey: transaction.merchantKey,
        type: transaction.type,
        status: "confirmed",
        deletedAt: null,
        categoryId: { $ne: null },
      },
    },
    { $group: { _id: "$categoryId", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  if (!groups.length) return null;
  const visible = new Map(categories.map((category) => [String(category._id), category]));
  const candidates = groups.filter((group) => visible.has(String(group._id)));
  if (!candidates.length) return null;
  const total = candidates.reduce((sum, candidate) => sum + candidate.count, 0);
  const winner = candidates[0];
  const category = visible.get(String(winner._id));
  const confidence = Math.min(0.84, 0.6 + (winner.count / total) * 0.18 + Math.min(total, 3) * 0.02);
  return makeDecision({
    category,
    confidence,
    source: "history",
    explanation: `Based on ${winner.count} of your confirmed transactions with this merchant.`,
    detectedMerchant: transaction.merchant,
    alternatives: candidates.slice(1, 4).map((candidate) =>
      toAlternative(candidate._id, candidate.count / total, "Another category used for this merchant.")
    ),
  });
}

function aiCacheKey(userId, transaction, categories) {
  return JSON.stringify([
    String(userId),
    transaction.type,
    transaction.merchantKey,
    (transaction.note || "").slice(0, 300),
    categories.map(({ _id, name }) => [String(_id), name]),
  ]);
}

async function aiDecision(userId, transaction, categories) {
  if (!isCategorizationAiEnabled()) return null;
  const input = {
    transactionType: transaction.type,
    merchant: (transaction.merchant || "").slice(0, 80),
    description: (transaction.note || "").slice(0, 300),
    categories: categories.map((category) => ({
      id: String(category._id),
      name: category.name,
    })),
  };
  const key = aiCacheKey(userId, transaction, categories);
  let result = cacheGet(key);
  if (!result) {
    const pending = aiRequestsInFlight.get(key);
    if (pending) {
      result = await pending;
    } else {
      if (!allowAiRequest(userId)) return null;
      const request = categorizeWithAi(input).catch(() => null);
      aiRequestsInFlight.set(key, request);
      try {
        result = await request;
        if (result == null) return null;
        cacheSet(key, result);
      } catch {
        return null;
      } finally {
        aiRequestsInFlight.delete(key);
      }
    }
  }

  const parsed = aiResultSchema.safeParse(result);
  if (!parsed.success) return null;
  const categoryById = new Map(categories.map((category) => [String(category._id), category]));
  const category = categoryById.get(parsed.data.suggestedCategoryId);
  if (!category) return null;
  const alternatives = parsed.data.alternatives.flatMap((alternative) => {
    const allowed = categoryById.get(alternative.categoryId);
    return allowed && allowed._id.toString() !== category._id.toString()
      ? [toAlternative(allowed._id, alternative.confidenceScore, alternative.explanation)]
      : [];
  });
  const confidence = parsed.data.confidenceScore;
  return makeDecision({
    category,
    confidence,
    source: "ai",
    explanation: parsed.data.explanation,
    detectedMerchant: parsed.data.detectedMerchant || transaction.merchant,
    alternatives,
  });
}

async function createSuggestion(userId, transaction, decision) {
  try {
    await CategorySuggestion.updateOne(
      { userId, transactionId: transaction._id },
      {
        $setOnInsert: {
          userId,
          transactionId: transaction._id,
          transactionType: transaction.type,
          merchantKey: transaction.merchantKey || "",
          ...decision,
          status: "pending",
        },
      },
      { upsert: true }
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
  return CategorySuggestion.findOne({ userId, transactionId: transaction._id }).lean();
}

async function computeDecision(userId, transaction, categories, memo) {
  const merchantKey = transaction.merchantKey || toMerchantKey(transaction.merchant);
  let decision;
  if (merchantKey) {
    const rule = await memoized(
      memo,
      `rule:${userId}:${transaction.type}:${merchantKey}`,
      () => MerchantCategoryRule.findOne({
        userId,
        merchantKey,
        transactionType: transaction.type,
      }).lean()
    );
    if (rule) {
      const category = categories.find((candidate) => String(candidate._id) === String(rule.categoryId));
      if (category) {
        decision = makeDecision({
          category,
          confidence: 1,
          source: "user_rule",
          explanation: "Matched your merchant category preference.",
          detectedMerchant: transaction.merchant,
        });
      }
    }
  }

  const textKey = `${transaction.type}:${merchantKey}:${(transaction.note || "").slice(0, 300)}`;
  const keywordDecision = await memoized(
    memo,
    `keyword:${textKey}`,
    async () => findKeywordCategory({
      merchant: transaction.merchant,
      description: transaction.note,
      transactionType: transaction.type,
      categories,
    })
  );
  decision ??= keywordDecision && makeDecision({
    ...keywordDecision,
    detectedMerchant: transaction.merchant,
  });
  if (!decision) {
    decision = await memoized(
      memo,
      `history:${userId}:${transaction.type}:${merchantKey}`,
      () => historicalDecision(transaction, categories)
    );
  }
  if (!decision) {
    decision = await memoized(
      memo,
      `ai:${userId}:${textKey}`,
      () => aiDecision(userId, transaction, categories)
    );
  }
  return decision ?? makeDecision({
    confidence: 0,
    source: "none",
    explanation: "No confident category match was found. Choose a category manually.",
    detectedMerchant: transaction.merchant,
  });
}

export async function suggestTransactionCategory({ userId, transactionId, memo }) {
  const transaction = await Transaction.findOne({
    _id: transactionId,
    userId,
    status: "confirmed",
    deletedAt: null,
    type: { $in: ["income", "expense"] },
  }).lean();
  if (!transaction) throw ApiError.notFound("Transaction not found");
  if (transaction.categoryId) {
    return { status: "existing_category", categoryId: transaction.categoryId, transactionId: transaction._id };
  }

  const existing = await CategorySuggestion.findOne({ userId, transactionId: transaction._id }).lean();
  if (existing) return existing;

  const categories = await memoized(
    memo,
    `categories:${userId}:${transaction.type}`,
    () => getVisibleCategories(userId, transaction.type)
  );
  if (!categories.length) {
    return createSuggestion(userId, transaction, makeDecision({
      confidence: 0,
      source: "none",
      explanation: "No available categories match this transaction type.",
      detectedMerchant: transaction.merchant,
    }));
  }

  const decision = await computeDecision(userId, transaction, categories, memo);
  return createSuggestion(userId, transaction, decision);
}

export function queueCategorizationForTransaction(transaction) {
  if (!transaction || transaction.categoryId || transaction.type === "transfer") return;
  const userId = transaction.userId;
  const transactionId = transaction._id;
  queueMicrotask(() => {
    suggestTransactionCategory({ userId, transactionId }).catch(() => {
      process.emitWarning("Background transaction categorization failed", {
        code: "CATEGORIZATION_BACKGROUND_ERROR",
      });
    });
  });
}

export async function bulkSuggestTransactionCategories(userId, transactionIds) {
  const results = new Array(transactionIds.length);
  const memo = new Map();
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(3, transactionIds.length) }, async () => {
    while (nextIndex < transactionIds.length) {
      const index = nextIndex++;
      try {
        results[index] = {
          transactionId: transactionIds[index],
          success: true,
          data: await suggestTransactionCategory({ userId, transactionId: transactionIds[index], memo }),
        };
      } catch (error) {
        results[index] = {
          transactionId: transactionIds[index],
          success: false,
          error: {
            code: error.code || "CATEGORIZATION_FAILED",
            message: error.status ? error.message : "Could not categorize this transaction.",
          },
        };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

export async function listCategorySuggestions(userId, { page, limit, status }) {
  const filter = { userId };
  if (status) filter.status = status;
  const [data, total] = await Promise.all([
    CategorySuggestion.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("suggestedCategoryId", "name icon type")
      .populate("reviewedCategoryId", "name icon type")
      .lean(),
    CategorySuggestion.countDocuments(filter),
  ]);
  return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function upsertMerchantRule({ userId, merchant, merchantKey, transactionType, categoryId, session }) {
  const categoryQuery = validateCategory(userId, categoryId, transactionType, session);
  const category = await categoryQuery;
  if (!category) throw ApiError.badRequest("Category not found or does not match the transaction type");
  const options = { upsert: true, returnDocument: "after", setDefaultsOnInsert: true };
  if (session) options.session = session;
  try {
    return await MerchantCategoryRule.findOneAndUpdate(
      { userId, merchantKey, transactionType },
      { $set: { merchant, categoryId } },
      options
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const existing = await MerchantCategoryRule.findOne({ userId, merchantKey, transactionType });
    if (!existing) throw error;
    existing.merchant = merchant;
    existing.categoryId = categoryId;
    return existing.save(session ? { session } : undefined);
  }
}

export async function createOrUpdateMerchantRule(userId, input) {
  const merchantKey = toMerchantKey(input.merchant);
  if (!merchantKey) throw ApiError.badRequest("Merchant name must contain letters or numbers");
  return upsertMerchantRule({
    userId,
    merchant: input.merchant,
    merchantKey,
    transactionType: input.transactionType,
    categoryId: input.categoryId,
  });
}

export async function listMerchantRules(userId, { page, limit, transactionType }) {
  const filter = { userId };
  if (transactionType) filter.transactionType = transactionType;
  const [data, total] = await Promise.all([
    MerchantCategoryRule.find(filter)
      .sort({ merchantKey: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("categoryId", "name icon type")
      .lean(),
    MerchantCategoryRule.countDocuments(filter),
  ]);
  return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function updateMerchantRule(userId, ruleId, changes) {
  const rule = await MerchantCategoryRule.findOne({ _id: ruleId, userId });
  if (!rule) throw ApiError.notFound("Merchant rule not found");
  const merchant = changes.merchant ?? rule.merchant;
  const transactionType = changes.transactionType ?? rule.transactionType;
  const categoryId = changes.categoryId ?? rule.categoryId;
  const merchantKey = toMerchantKey(merchant);
  if (!merchantKey) throw ApiError.badRequest("Merchant name must contain letters or numbers");
  const category = await validateCategory(userId, categoryId, transactionType);
  if (!category) throw ApiError.badRequest("Category not found or does not match the transaction type");
  try {
    rule.merchant = merchant;
    rule.merchantKey = merchantKey;
    rule.transactionType = transactionType;
    rule.categoryId = categoryId;
    await rule.save();
  } catch (error) {
    if (error?.code === 11000) throw ApiError.conflict("A rule already exists for this merchant and transaction type");
    throw error;
  }
  return rule;
}

export async function deleteMerchantRule(userId, ruleId) {
  const deleted = await MerchantCategoryRule.findOneAndDelete({ _id: ruleId, userId });
  if (!deleted) throw ApiError.notFound("Merchant rule not found");
  return { id: deleted._id, deleted: true };
}

async function reviewSuggestion({ userId, suggestionId, categoryId, accepted }) {
  const session = await CategorySuggestion.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const suggestion = await CategorySuggestion.findOne({ _id: suggestionId, userId }).session(session);
      if (!suggestion) throw ApiError.notFound("Categorization suggestion not found");
      const transaction = await Transaction.findOne({
        _id: suggestion.transactionId,
        userId,
        deletedAt: null,
        status: "confirmed",
      }).session(session);
      if (!transaction) throw ApiError.notFound("Transaction not found");
      if (suggestion.status === (accepted ? "accepted" : "rejected")) {
        result = { suggestion, transaction, duplicate: true };
        return;
      }
      if (suggestion.status !== "pending") throw ApiError.conflict("Suggestion has already been reviewed");

      const selectedCategoryId = categoryId || (accepted ? suggestion.suggestedCategoryId : null);
      if (accepted && !selectedCategoryId) {
        throw ApiError.badRequest("Choose a category before accepting this low-confidence suggestion");
      }
      if (selectedCategoryId) {
        const category = await validateCategory(userId, selectedCategoryId, transaction.type, session);
        if (!category) throw ApiError.badRequest("Category not found or does not match the transaction type");
        if (transaction.categoryId && String(transaction.categoryId) !== String(selectedCategoryId)) {
          throw ApiError.conflict("A confirmed category already exists and will not be overwritten");
        }
        if (!transaction.categoryId) {
          transaction.categoryId = selectedCategoryId;
          await transaction.save({ session });
        }
      }

      suggestion.status = accepted ? "accepted" : "rejected";
      suggestion.reviewedCategoryId = selectedCategoryId;
      await suggestion.save({ session });

      if (
        selectedCategoryId &&
        transaction.merchant &&
        (!accepted || String(selectedCategoryId) !== String(suggestion.suggestedCategoryId))
      ) {
        const merchantKey = transaction.merchantKey || toMerchantKey(transaction.merchant);
        if (merchantKey) {
          await upsertMerchantRule({
            userId,
            merchant: transaction.merchant,
            merchantKey,
            transactionType: transaction.type,
            categoryId: selectedCategoryId,
            session,
          });
        }
      }
      result = { suggestion, transaction, duplicate: false };
    });
  } finally {
    await session.endSession();
  }
  return result;
}

export function acceptCategorySuggestion(userId, suggestionId, categoryId) {
  return reviewSuggestion({ userId, suggestionId, categoryId, accepted: true });
}

export function rejectCategorySuggestion(userId, suggestionId, categoryId) {
  return reviewSuggestion({ userId, suggestionId, categoryId, accepted: false });
}
