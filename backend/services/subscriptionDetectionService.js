import { Types } from "mongoose";
import { Category } from "../models/Category.js";
import { Subscription } from "../models/Subscription.js";
import { Transaction } from "../models/Transaction.js";
import { ApiError } from "../utils/apiError.js";
import { toMerchantKey } from "../utils/merchant.js";
import { detectSubscriptionPatterns } from "./subscriptionPatternService.js";

const HISTORY_DAYS = 5 * 366;
const MAX_TRANSACTIONS = 5_000;

function publicSubscription(subscription) {
  const value = subscription.toObject ? subscription.toObject() : { ...subscription };
  delete value.__v;
  if (value.detectionEvidence) delete value.detectionEvidence.payments;
  return value;
}

function detectionWindow({ startDate, endDate, limit = MAX_TRANSACTIONS } = {}, now = new Date()) {
  const endDateStart = endDate ? new Date(endDate) : now;
  if (endDateStart > now) throw ApiError.badRequest("endDate cannot be in the future");
  const start = startDate ? new Date(startDate) : new Date(endDateStart.getTime() - HISTORY_DAYS * 86_400_000);
  if (start > endDateStart) throw ApiError.badRequest("startDate must be on or before endDate");
  if (endDateStart.getTime() - start.getTime() > HISTORY_DAYS * 86_400_000) {
    throw ApiError.badRequest("Subscription detection history cannot exceed five years");
  }
  const end = endDate ? new Date(endDateStart.getTime() + 86_400_000 - 1) : now;
  return { start, end, limit };
}

export async function detectUserSubscriptions(user, options = {}, { now = new Date() } = {}) {
  const window = detectionWindow(options, now);
  const transactions = await Transaction.find({
    userId: new Types.ObjectId(String(user._id)),
    type: "expense",
    status: "confirmed",
    deletedAt: null,
    source: { $ne: "recurring" },
    txnDate: { $gte: window.start, $lte: window.end },
  })
    .sort({ txnDate: -1, _id: -1 })
    .limit(window.limit + 1)
    .select("_id merchant merchantKey amount categoryId txnDate")
    .lean();
  const historyTruncated = transactions.length > window.limit;
  if (historyTruncated) transactions.length = window.limit;
  transactions.reverse();

  const detection = detectSubscriptionPatterns(transactions, { historyTruncated, detectedAt: now });
  const categoryIds = [...new Set(detection.patterns.map((pattern) => pattern.categoryId).filter(Boolean))];
  const visibleCategories = await Category.find({
    _id: { $in: categoryIds },
    type: "expense",
    $or: [{ userId: null }, { userId: user._id }],
  }).select("_id").lean();
  const validCategoryIds = new Set(visibleCategories.map((category) => String(category._id)));

  const saved = [];
  for (const pattern of detection.patterns) {
    if (pattern.categoryId && !validCategoryIds.has(pattern.categoryId)) pattern.categoryId = null;
    const filter = {
      userId: user._id,
      normalizedMerchant: pattern.normalizedMerchant,
      frequency: pattern.frequency,
    };
    const existing = await Subscription.findOne(filter).lean();
    if (existing) {
      const mergedPayments = new Map();
      for (const payment of [
        ...(existing.detectionEvidence?.payments || []),
        ...pattern.detectionEvidence.payments,
      ]) {
        mergedPayments.set(String(payment.transactionId), payment);
      }
      const candidateTransactions = [...mergedPayments.values()].map((payment) => ({
        _id: payment.transactionId,
        merchant: pattern.merchantName,
        amount: payment.amountPaise,
        categoryId: payment.categoryId || existing.categoryId || null,
        txnDate: payment.paidAt,
      }));
      const mergedPattern = detectSubscriptionPatterns(candidateTransactions, {
        historyTruncated: historyTruncated || existing.detectionEvidence?.historyTruncated || false,
        detectedAt: now,
      }).patterns.find((item) => item.frequency === pattern.frequency);
      if (!mergedPattern) {
        saved.push(publicSubscription(existing));
        continue;
      }
      Object.assign(pattern, mergedPattern);
      if (pattern.categoryId && !validCategoryIds.has(pattern.categoryId)) pattern.categoryId = null;
    }
    try {
      await Subscription.findOneAndUpdate(
        filter,
        { $set: pattern, $setOnInsert: { status: "detected" } },
        { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
    const subscription = await Subscription.findOne(filter).lean();
    if (subscription) saved.push(publicSubscription(subscription));
  }

  return {
    scannedTransactions: transactions.length,
    historyTruncated,
    detectedCount: saved.filter((item) => item.status === "detected").length,
    confirmedCount: saved.filter((item) => item.status === "confirmed").length,
    insufficientEvidenceCount: detection.insufficientEvidenceCount,
    inconsistentPatternCount: detection.inconsistentPatternCount,
    subscriptions: saved,
  };
}

export async function listUserSubscriptions(userId, filters) {
  const query = { userId: new Types.ObjectId(String(userId)) };
  if (filters.status) query.status = filters.status;
  if (filters.frequency) query.frequency = filters.frequency;
  if (filters.confidenceLevel) query.confidenceLevel = filters.confidenceLevel;
  if (filters.merchant) query.normalizedMerchant = toMerchantKey(filters.merchant);
  if (filters.startDate || filters.endDate) {
    query.lastPaymentDate = {
      ...(filters.startDate ? { $gte: filters.startDate } : {}),
      ...(filters.endDate ? { $lt: new Date(filters.endDate.getTime() + 86_400_000) } : {}),
    };
  }
  const [data, total] = await Promise.all([
    Subscription.find(query)
      .sort({ lastPaymentDate: -1, _id: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .select("-detectionEvidence.payments")
      .lean(),
    Subscription.countDocuments(query),
  ]);
  return {
    data: data.map(publicSubscription),
    pagination: { page: filters.page, limit: filters.limit, total, pages: Math.ceil(total / filters.limit) },
  };
}
