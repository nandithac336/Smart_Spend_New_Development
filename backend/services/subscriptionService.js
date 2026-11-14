import { Types } from "mongoose";
import { Category } from "../models/Category.js";
import { Subscription } from "../models/Subscription.js";
import { ApiError } from "../utils/apiError.js";
import { toMerchantKey } from "../utils/merchant.js";

const ACTIVE_STATUSES = ["detected", "confirmed"];
const DAY_MS = 86_400_000;

function publicSubscription(subscription) {
  const value = subscription.toObject ? subscription.toObject() : { ...subscription };
  delete value.__v;
  if (value.detectionEvidence) delete value.detectionEvidence.payments;
  return value;
}

function addPaise(total, amount) {
  const next = total + amount;
  if (!Number.isSafeInteger(next)) {
    throw ApiError.conflict("Subscription totals exceed the safe integer range");
  }
  return next;
}

function localDateKey(date, timeZone) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeMerchantName(value) {
  const normalized = toMerchantKey(value || "");
  return normalized.slice(0, 120);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

async function validateCategory(userId, categoryId) {
  if (!categoryId) return null;
  const category = await Category.findOne({
    _id: categoryId,
    type: "expense",
    $or: [{ userId: null }, { userId }],
  }).select("_id").lean();
  if (!category) throw ApiError.badRequest("Category is invalid or unavailable");
  return category._id;
}

async function findOwnedSubscription(userId, subscriptionId) {
  const subscription = await Subscription.findOne({
    _id: subscriptionId,
    userId: new Types.ObjectId(String(userId)),
  }).lean();
  if (!subscription) throw ApiError.notFound("Subscription not found");
  return subscription;
}

export async function getUserSubscription(userId, subscriptionId) {
  return publicSubscription(await findOwnedSubscription(userId, subscriptionId));
}

export async function getUserSubscriptionHistory(userId, subscriptionId, { page, limit }) {
  const subscription = await findOwnedSubscription(userId, subscriptionId);
  const payments = subscription.detectionEvidence.payments || [];
  const sorted = [...payments].sort((left, right) =>
    new Date(right.paidAt) - new Date(left.paidAt) ||
    String(right.transactionId).localeCompare(String(left.transactionId))
  );
  const total = sorted.length;
  return {
    data: sorted.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    historyTruncated: subscription.detectionEvidence.historyTruncated,
  };
}

export async function updateUserSubscription(userId, subscriptionId, updates) {
  const subscription = await Subscription.findOne({
    _id: subscriptionId,
    userId: new Types.ObjectId(String(userId)),
  });
  if (!subscription) throw ApiError.notFound("Subscription not found");
  if (!ACTIVE_STATUSES.includes(subscription.status)) {
    throw ApiError.conflict("Dismissed or cancelled subscriptions cannot be edited");
  }
  const nextMerchant = updates.merchantName ?? subscription.merchantName;
  const nextNormalizedMerchant = normalizeMerchantName(nextMerchant);
  const nextFrequency = updates.frequency ?? subscription.frequency;
  if (!nextNormalizedMerchant) throw ApiError.badRequest("Merchant name must contain letters or numbers");
  const duplicate = await Subscription.exists({
    userId: subscription.userId,
    normalizedMerchant: nextNormalizedMerchant,
    frequency: nextFrequency,
    _id: { $ne: subscription._id },
  });
  if (duplicate) throw ApiError.conflict("A subscription with this merchant and frequency already exists");

  if (Object.hasOwn(updates, "categoryId")) {
    subscription.categoryId = await validateCategory(subscription.userId, updates.categoryId);
  }
  subscription.merchantName = nextMerchant;
  subscription.normalizedMerchant = nextNormalizedMerchant;
  if (updates.averageAmountPaise !== undefined) subscription.averageAmountPaise = updates.averageAmountPaise;
  if (updates.frequency !== undefined) subscription.frequency = updates.frequency;
  if (updates.estimatedNextPaymentDate !== undefined) {
    subscription.estimatedNextPaymentDate = updates.estimatedNextPaymentDate;
  }
  await subscription.save();
  return publicSubscription(subscription);
}

const ALLOWED_TRANSITIONS = {
  confirmed: new Set(["detected", "confirmed"]),
  dismissed: new Set(["detected", "dismissed"]),
  cancelled: new Set(["detected", "confirmed", "cancelled"]),
};

export async function transitionUserSubscription(userId, subscriptionId, status) {
  const subscription = await Subscription.findOne({
    _id: subscriptionId,
    userId: new Types.ObjectId(String(userId)),
  });
  if (!subscription) throw ApiError.notFound("Subscription not found");
  if (!ALLOWED_TRANSITIONS[status]?.has(subscription.status)) {
    throw ApiError.conflict(`Cannot change a ${subscription.status} subscription to ${status}`);
  }
  if (subscription.status !== status) {
    subscription.status = status;
    await subscription.save();
  }
  return publicSubscription(subscription);
}

export async function getUserSubscriptionSummary(userId, { now = new Date(), timeZone = "Asia/Kolkata" } = {}) {
  const uid = new Types.ObjectId(String(userId));
  const grouped = await Subscription.aggregate([
    { $match: { userId: uid, status: { $in: ACTIVE_STATUSES } } },
    {
      $project: {
        status: 1,
        merchantName: 1,
        normalizedMerchant: 1,
        categoryId: 1,
        frequency: 1,
        averageAmountPaise: 1,
        monthlyCostPaise: {
          $round: [{
            $multiply: ["$averageAmountPaise", {
              $switch: {
                branches: [
                  { case: { $eq: ["$frequency", "weekly"] }, then: 52 / 12 },
                  { case: { $eq: ["$frequency", "quarterly"] }, then: 1 / 3 },
                  { case: { $eq: ["$frequency", "annual"] }, then: 1 / 12 },
                ],
                default: 1,
              },
            }],
          }, 0],
        },
        annualCostPaise: {
          $round: [{
            $multiply: ["$averageAmountPaise", {
              $switch: {
                branches: [
                  { case: { $eq: ["$frequency", "weekly"] }, then: 52 },
                  { case: { $eq: ["$frequency", "quarterly"] }, then: 4 },
                  { case: { $eq: ["$frequency", "annual"] }, then: 1 },
                ],
                default: 12,
              },
            }],
          }, 0],
        },
      },
    },
    {
      $group: {
        _id: { status: "$status", merchantName: "$merchantName", categoryId: "$categoryId" },
        count: { $sum: 1 },
        monthlyCostPaise: { $sum: "$monthlyCostPaise" },
        annualCostPaise: { $sum: "$annualCostPaise" },
      },
    },
  ]);
  const confirmed = { count: 0, monthlyCostPaise: 0, annualCostPaise: 0, byMerchant: [], byCategory: [] };
  const detected = { count: 0, monthlyCostPaise: 0, annualCostPaise: 0, byMerchant: [], byCategory: [] };
  const merchantTotals = new Map();
  const detectedMerchantTotals = new Map();
  const categoryTotals = new Map();
  const detectedCategoryTotals = new Map();
  const categoryIds = [];
  for (const row of grouped) {
    if (!Number.isSafeInteger(row.monthlyCostPaise) || !Number.isSafeInteger(row.annualCostPaise)) {
      throw ApiError.conflict("Subscription totals exceed the safe integer range");
    }
    const isConfirmed = row._id.status === "confirmed";
    const target = isConfirmed ? confirmed : detected;
    target.count += row.count;
    target.monthlyCostPaise = addPaise(target.monthlyCostPaise, row.monthlyCostPaise);
    target.annualCostPaise = addPaise(target.annualCostPaise, row.annualCostPaise);
    const merchantTotalsForStatus = isConfirmed ? merchantTotals : detectedMerchantTotals;
    const categoryTotalsForStatus = isConfirmed ? categoryTotals : detectedCategoryTotals;
    const merchantKey = row._id.merchantName;
    const merchant = merchantTotalsForStatus.get(merchantKey) || { merchantName: merchantKey, count: 0, monthlyCostPaise: 0, annualCostPaise: 0 };
    merchant.count += row.count;
    merchant.monthlyCostPaise = addPaise(merchant.monthlyCostPaise, row.monthlyCostPaise);
    merchant.annualCostPaise = addPaise(merchant.annualCostPaise, row.annualCostPaise);
    merchantTotalsForStatus.set(merchantKey, merchant);
    const categoryKey = row._id.categoryId ? String(row._id.categoryId) : "uncategorized";
    const category = categoryTotalsForStatus.get(categoryKey) || {
      categoryId: row._id.categoryId ? String(row._id.categoryId) : null,
      count: 0,
      monthlyCostPaise: 0,
      annualCostPaise: 0,
    };
    category.count += row.count;
    category.monthlyCostPaise = addPaise(category.monthlyCostPaise, row.monthlyCostPaise);
    category.annualCostPaise = addPaise(category.annualCostPaise, row.annualCostPaise);
    categoryTotalsForStatus.set(categoryKey, category);
    if (row._id.categoryId) categoryIds.push(row._id.categoryId);
  }
  const categories = await Category.find({
    _id: { $in: categoryIds },
    type: "expense",
    $or: [{ userId: null }, { userId: uid }],
  }).select("_id name").lean();
  const categoryNames = new Map(categories.map((item) => [String(item._id), item.name]));
  confirmed.byMerchant = [...merchantTotals.values()].sort((a, b) => b.monthlyCostPaise - a.monthlyCostPaise);
  detected.byMerchant = [...detectedMerchantTotals.values()].sort((a, b) => b.monthlyCostPaise - a.monthlyCostPaise);
  const namedCategories = (items) => [...items.values()]
    .map((item) => ({ ...item, categoryName: item.categoryId ? categoryNames.get(item.categoryId) || null : "Uncategorized" }))
    .sort((a, b) => b.monthlyCostPaise - a.monthlyCostPaise);
  confirmed.byCategory = namedCategories(categoryTotals);
  detected.byCategory = namedCategories(detectedCategoryTotals);

  const horizonEnd = addDays(now, 30);
  const upcomingCandidates = await Subscription.find({
    userId: uid,
    status: { $in: ACTIVE_STATUSES },
    estimatedNextPaymentDate: { $lte: horizonEnd },
  })
    .sort({ estimatedNextPaymentDate: 1, _id: 1 })
    .limit(5_001)
    .select("merchantName estimatedNextPaymentDate averageAmountPaise frequency confidenceLevel status detectionEvidence.averageIntervalDays")
    .lean();
  const detectedSubscriptions = await Subscription.find({ userId: uid, status: "detected" })
    .sort({ confidenceScore: -1, lastPaymentDate: -1 })
    .limit(20)
    .select("merchantName frequency confidenceScore confidenceLevel averageAmountPaise estimatedNextPaymentDate")
    .lean();
  const [detectedCount, confirmedCount] = await Promise.all([
    Subscription.countDocuments({ userId: uid, status: "detected" }),
    Subscription.countDocuments({ userId: uid, status: "confirmed" }),
  ]);
  const upcoming = [];
  for (const subscription of upcomingCandidates.slice(0, 5_000)) {
    const intervalDays = subscription.detectionEvidence?.averageIntervalDays ||
      ({ weekly: 7, monthly: 30, quarterly: 91, annual: 365 }[subscription.frequency]);
    let expectedDate = new Date(subscription.estimatedNextPaymentDate);
    let iterations = 0;
    while (expectedDate <= now && iterations < 2_000) {
      expectedDate = addDays(expectedDate, intervalDays);
      iterations += 1;
    }
    if (expectedDate > now && expectedDate <= horizonEnd) {
      upcoming.push({
        subscriptionId: String(subscription._id),
        merchantName: subscription.merchantName,
        expectedPaymentDate: localDateKey(expectedDate, timeZone),
        estimatedAmountPaise: subscription.averageAmountPaise,
        frequency: subscription.frequency,
        confidenceLevel: subscription.confidenceLevel,
        status: subscription.status,
        confidenceScore: subscription.confidenceScore,
      });
    }
  }
  upcoming.sort((left, right) =>
    left.expectedPaymentDate.localeCompare(right.expectedPaymentDate) ||
    left.merchantName.localeCompare(right.merchantName)
  );

  return {
    currency: "INR",
    estimatedMonthlyCostPaise: confirmed.monthlyCostPaise,
    estimatedAnnualCostPaise: confirmed.annualCostPaise,
    activeConfirmedSubscriptions: confirmedCount,
    detectedSubscriptionCount: detectedCount,
    confirmed,
    detected: {
      ...detected,
      subscriptions: detectedSubscriptions,
      subscriptionsTruncated: detectedCount > detectedSubscriptions.length,
    },
    upcomingPayments: upcoming.slice(0, 50),
    upcomingHorizonDays: 30,
    upcomingTruncated: upcoming.length > 50 || upcomingCandidates.length > 5_000,
  };
}

export async function getConfirmedSubscriptionForecast(userId, {
  targetStart,
  targetEnd,
  now,
  timeZone,
  excludedMerchants = [],
} = {}) {
  const uid = new Types.ObjectId(String(userId));
  const subscriptions = await Subscription.find({
    userId: uid,
    status: "confirmed",
    estimatedNextPaymentDate: { $lt: targetEnd },
  })
    .sort({ estimatedNextPaymentDate: 1, _id: 1 })
    .limit(500)
    .select("_id merchantName normalizedMerchant categoryId averageAmountPaise estimatedNextPaymentDate frequency detectionEvidence")
    .lean();
  const scheduledMerchants = new Set(excludedMerchants.map(toMerchantKey).filter(Boolean));
  const occurrences = [];
  for (const subscription of subscriptions) {
    if (scheduledMerchants.has(subscription.normalizedMerchant)) continue;
    let dueDate = new Date(subscription.estimatedNextPaymentDate);
    let iterations = 0;
    while (dueDate < targetStart && iterations < 2_000) {
      dueDate = addDays(dueDate, subscription.detectionEvidence.averageIntervalDays);
      iterations += 1;
    }
    while (dueDate > now && dueDate < targetEnd && iterations < 2_100) {
      if (dueDate >= targetStart) {
        occurrences.push({
          date: localDateKey(dueDate, timeZone),
          scheduleId: `subscription:${String(subscription._id)}`,
          name: subscription.merchantName,
          normalizedMerchant: subscription.normalizedMerchant,
          amountPaise: subscription.averageAmountPaise,
          categoryId: subscription.categoryId ? String(subscription.categoryId) : null,
          subscriptionId: String(subscription._id),
          confidenceLevel: subscription.confidenceLevel,
        });
      }
      dueDate = addDays(dueDate, subscription.detectionEvidence.averageIntervalDays);
      iterations += 1;
    }
    if (occurrences.length >= 2_000) break;
  }
  const byCategory = {};
  let totalPaise = 0;
  for (const occurrence of occurrences) {
    const key = occurrence.categoryId || "uncategorized";
    byCategory[key] = addPaise(byCategory[key] || 0, occurrence.amountPaise);
    totalPaise = addPaise(totalPaise, occurrence.amountPaise);
  }
  return { totalPaise, byCategory, occurrences, truncated: subscriptions.length === 500 || occurrences.length >= 2_000 };
}
