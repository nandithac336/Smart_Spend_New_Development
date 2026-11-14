import { Types } from "mongoose";
import { TransactionAnomaly } from "../models/TransactionAnomaly.js";
import { Transaction } from "../models/Transaction.js";
import { ApiError } from "../utils/apiError.js";
import { resolveAnalyticsWindow } from "./analyticsService.js";
import { detectTransactionAnomalies } from "./anomalyRulesService.js";
import { buildScoredAnomaly } from "./anomalyScoringService.js";

const DAY_MS = 86_400_000;
const HISTORY_DAYS = 365;
const MAX_HISTORY_RECORDS = 5_000;
const MAX_DETECTION_BATCH = 200;
const ELIGIBLE_TYPES = ["income", "expense"];

function dateLabel(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function eligibleTransactionFilter(userId) {
  return {
    userId: new Types.ObjectId(String(userId)),
    status: "confirmed",
    deletedAt: null,
    type: { $in: ELIGIBLE_TYPES },
  };
}

function detectionWindow(user, { startDate, endDate } = {}) {
  if (startDate && endDate) {
    return resolveAnalyticsWindow({
      startDate,
      endDate,
      timezone: user.timezone || "Asia/Kolkata",
      period: "custom",
    }, user);
  }
  const end = new Date();
  const start = new Date(end.getTime() - 30 * DAY_MS);
  const timeZone = user.timezone || "Asia/Kolkata";
  return {
    start,
    end,
    startDate: dateLabel(start, timeZone),
    endDate: dateLabel(end, timeZone),
  };
}

function publicAnomaly(anomaly) {
  const value = anomaly.toObject ? anomaly.toObject() : { ...anomaly };
  delete value.detectionKey;
  delete value.__v;
  return value;
}

function eventDetectionKey(event, transaction) {
  return event.detectionKey || `${event.type}:${String(transaction._id)}`;
}

async function saveDetections(userId, transaction, events) {
  const records = [];
  for (const event of events) {
    const scored = buildScoredAnomaly(event);
    const detectionKey = eventDetectionKey(event, transaction);
    try {
      await TransactionAnomaly.updateOne(
        {
          userId,
          transactionId: transaction._id,
          anomalyType: event.type,
          detectionKey,
        },
        {
          $setOnInsert: {
            userId,
            transactionId: transaction._id,
            anomalyType: event.type,
            detectionKey,
            severity: scored.severity,
            score: scored.score,
            explanation: explanationFor(scored),
            suggestedAction: actionFor(scored),
            evidence: scored.evidence,
            status: "new",
            detectedAt: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
    const record = await TransactionAnomaly.findOne({
      userId,
      transactionId: transaction._id,
      anomalyType: event.type,
      detectionKey,
    }).lean();
    if (record) records.push(publicAnomaly(record));
  }
  return records;
}

function explanationFor(event) {
  const evidence = event.evidence || {};
  switch (event.type) {
    case "large_transaction":
      return `This expense is above your personal historical threshold of ${evidence.thresholdPaise} paise, based on ${evidence.sampleSize} transactions.`;
    case "duplicate_exact":
      return "A transaction with the same amount, merchant, type, wallet, and nearly identical timestamp was found.";
    case "duplicate_possible":
      return "A transaction with the same amount, merchant, type, and wallet was found within one day.";
    case "new_merchant":
      return "This merchant does not appear in your available transaction history. A new merchant alone is not proof of fraud.";
    case "unusual_merchant_amount":
      return `This amount is higher than your past amounts for this merchant (about ${event.ratio} times the historical median).`;
    case "merchant_spending_increase":
      return `Spending at this merchant over the recent 30-day window is about ${event.ratio} times the preceding 30-day total.`;
    case "high_frequency":
      return evidence.suddenIncrease
        ? `Transaction frequency in this wallet increased compared with the prior 28 days.`
        : `${evidence.transactionCount} transactions were recorded in this wallet within ${evidence.windowMinutes} minutes.`;
    case "category_spending_increase":
      return `Recent 30-day spending in this category is about ${event.ratio} times the preceding 30-day total.`;
    case "category_amount_anomaly":
      return `This expense is above your historical amount threshold for this category, based on ${evidence.sampleSize} transactions.`;
    case "wallet_anomaly":
      return `This amount is higher than your usual transaction amounts in this wallet (about ${event.ratio} times the historical median).`;
    default:
      return "This transaction differs from a pattern in your confirmed transaction history.";
  }
}

function actionFor(event) {
  if (event.type === "duplicate_exact" || event.type === "duplicate_possible") {
    return "Check the related transaction and confirm whether both entries are valid.";
  }
  if (event.type === "new_merchant") {
    return "Check the merchant and transaction details if you do not recognize them.";
  }
  return "Review the transaction details and contact your bank if you do not recognize it.";
}

async function loadEligibleTargets(userId, filter, limit) {
  return Transaction.find({ ...eligibleTransactionFilter(userId), ...filter })
    .sort({ txnDate: -1, _id: -1 })
    .limit(limit)
    .select("userId walletId type amount categoryId merchant merchantKey txnDate capturedAt status deletedAt")
    .lean();
}

async function detectForTargets(userId, targets) {
  if (!targets.length) return { scannedCount: 0, anomalies: [], insufficientBaselineCount: 0 };
  const start = Math.min(...targets.map((transaction) => transaction.txnDate.getTime()));
  const end = Math.max(...targets.map((transaction) => transaction.txnDate.getTime()));
  const historyStart = new Date(start - HISTORY_DAYS * DAY_MS);
  const historyEnd = new Date(end + DAY_MS);
  const history = await Transaction.find({
    ...eligibleTransactionFilter(userId),
    txnDate: { $gte: historyStart, $lte: historyEnd },
  })
    .sort({ txnDate: -1, _id: -1 })
    .limit(MAX_HISTORY_RECORDS)
    .select("userId walletId type amount categoryId merchant merchantKey txnDate status deletedAt")
    .lean();
  const allCandidates = [...new Map([...history, ...targets].map((item) => [String(item._id), item])).values()];
  const outputs = [];
  let insufficientBaselineCount = 0;
  for (const transaction of targets) {
    const baselineCount = history.filter((item) =>
      item.txnDate < transaction.txnDate &&
      item.type === transaction.type &&
      item.userId.toString() === userId.toString()
    ).length;
    if (baselineCount < 8) insufficientBaselineCount += 1;
    const events = detectTransactionAnomalies(transaction, allCandidates);
    const persisted = await saveDetections(userId, transaction, events);
    outputs.push(...persisted);
  }
  return {
    scannedCount: targets.length,
    anomalies: outputs,
    insufficientBaselineCount,
    historyTruncated: history.length === MAX_HISTORY_RECORDS,
    analyzedHistoryCount: history.length,
  };
}

export async function detectUserAnomalies(user, { startDate, endDate, limit = 100 } = {}) {
  const window = detectionWindow(user, { startDate, endDate });
  const targets = await loadEligibleTargets(user._id, {
    txnDate: { $gte: window.start, $lt: window.end },
  }, Math.min(limit, MAX_DETECTION_BATCH));
  const result = await detectForTargets(user._id, targets);
  return {
    ...result,
    period: {
      startDate: window.startDate,
      endDate: window.endDate,
      timeZone: user.timezone || "Asia/Kolkata",
    },
    limit: Math.min(limit, MAX_DETECTION_BATCH),
  };
}

export async function checkTransactionAnomalies(userId, transactionId) {
  const transaction = await Transaction.findOne({
    _id: transactionId,
    ...eligibleTransactionFilter(userId),
  })
    .select("userId walletId type amount categoryId merchant merchantKey txnDate capturedAt status deletedAt")
    .lean();
  if (!transaction) throw ApiError.notFound("Eligible transaction not found");
  const result = await detectForTargets(userId, [transaction]);
  return {
    transactionId: transaction._id,
    scanned: true,
    insufficientBaseline: result.insufficientBaselineCount > 0,
    anomalies: result.anomalies,
    analyzedHistoryCount: result.analyzedHistoryCount,
    historyTruncated: result.historyTruncated,
  };
}

export async function listUserAnomalies(userId, query) {
  const filter = { userId };
  if (query.severity) filter.severity = query.severity;
  if (query.type) filter.anomalyType = query.type;
  if (query.status) filter.status = query.status;
  if (query.startDate || query.endDate) {
    filter.detectedAt = {};
    if (query.startDate) filter.detectedAt.$gte = query.startDate;
    if (query.endDate) filter.detectedAt.$lt = new Date(query.endDate.getTime() + DAY_MS);
  }
  const [records, total] = await Promise.all([
    TransactionAnomaly.find(filter)
      .sort({ detectedAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate("transactionId", "type amount merchant txnDate walletId categoryId")
      .lean(),
    TransactionAnomaly.countDocuments(filter),
  ]);
  return {
    data: records.map(publicAnomaly),
    pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) },
  };
}

export async function getUserAnomaly(userId, anomalyId) {
  const record = await TransactionAnomaly.findOne({ _id: anomalyId, userId })
    .populate("transactionId", "type amount merchant note txnDate walletId categoryId")
    .lean();
  if (!record) throw ApiError.notFound("Anomaly not found");
  return publicAnomaly(record);
}

const STATUS_TRANSITIONS = {
  new: new Set(["reviewed", "dismissed", "resolved"]),
  reviewed: new Set(["dismissed", "resolved"]),
  dismissed: new Set(["reviewed", "resolved"]),
  resolved: new Set(["reviewed"]),
};

export async function updateUserAnomalyStatus(userId, anomalyId, status) {
  const anomalyRecord = await TransactionAnomaly.findOne({ _id: anomalyId, userId });
  if (!anomalyRecord) throw ApiError.notFound("Anomaly not found");
  if (anomalyRecord.status !== status && !STATUS_TRANSITIONS[anomalyRecord.status]?.has(status)) {
    throw ApiError.conflict("This anomaly status transition is not allowed");
  }
  if (anomalyRecord.status !== status) {
    anomalyRecord.status = status;
    anomalyRecord.reviewedAt = new Date();
    await anomalyRecord.save();
  }
  return publicAnomaly(anomalyRecord);
}

export async function getUserAnomalySummary(userId) {
  const rows = await TransactionAnomaly.aggregate([
    { $match: { userId: new Types.ObjectId(String(userId)) } },
    { $facet: {
      total: [{ $count: "count" }],
      byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
      byType: [{ $group: { _id: "$anomalyType", count: { $sum: 1 } } }],
      bySeverity: [{ $group: { _id: "$severity", count: { $sum: 1 } } }],
    } },
  ]);
  const row = rows[0] || {};
  const countValues = (items) => Object.fromEntries(items.map(({ _id, count }) => [_id, count]));
  const byStatus = countValues(row.byStatus || []);
  const bySeverity = countValues(row.bySeverity || []);
  return {
    total: row.total?.[0]?.count || 0,
    new: byStatus.new || 0,
    highAndCritical: (bySeverity.high || 0) + (bySeverity.critical || 0),
    reviewed: byStatus.reviewed || 0,
    dismissed: byStatus.dismissed || 0,
    resolved: byStatus.resolved || 0,
    byType: countValues(row.byType || []),
    bySeverity: { low: 0, medium: 0, high: 0, critical: 0, ...bySeverity },
  };
}
