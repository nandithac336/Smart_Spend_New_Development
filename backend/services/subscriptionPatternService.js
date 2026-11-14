import { toMerchantKey } from "../utils/merchant.js";

const FREQUENCIES = [
  { name: "weekly", expectedDays: 7, toleranceDays: 2 },
  { name: "monthly", expectedDays: 30.44, toleranceDays: 5 },
  { name: "quarterly", expectedDays: 91.31, toleranceDays: 14 },
  { name: "annual", expectedDays: 365.24, toleranceDays: 35 },
];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function confidenceLevel(score) {
  if (score >= 85) return "high";
  if (score >= 60) return "medium";
  return "low";
}

function occurrenceScore(count) {
  if (count >= 6) return 90;
  if (count === 5) return 80;
  if (count === 4) return 65;
  if (count === 3) return 45;
  return 20;
}

function scorePattern({ count, intervals, matchedIntervals, intervalQuality, amountVariationPercent }) {
  const intervalConsistency = intervals.length
    ? matchedIntervals / intervals.length * intervalQuality
    : 0;
  const amountSimilarity = Math.max(0, 100 - amountVariationPercent * 2);
  const score = Math.round(
    occurrenceScore(count) * 0.2 +
    intervalConsistency * 0.35 +
    amountSimilarity * 0.25 +
    100 * 0.1 +
    (intervals.length === 1 ? 55 : matchedIntervals / intervals.length * 100) * 0.1
  );
  return {
    score: Math.min(100, Math.max(0, score)),
    intervalConsistencyPercent: Math.round(intervalConsistency),
  };
}

function frequencyCandidate(intervals) {
  const candidates = FREQUENCIES.map((frequency) => {
    const matched = intervals.filter((days) =>
      Math.abs(days - frequency.expectedDays) <= frequency.toleranceDays
    );
    const ratio = intervals.length ? matched.length / intervals.length : 0;
    const quality = matched.length
      ? matched.reduce((sum, days) =>
        sum + Math.max(0, 100 - Math.abs(days - frequency.expectedDays) / frequency.toleranceDays * 50), 0
      ) / matched.length
      : 0;
    return { ...frequency, matched, ratio, quality };
  })
    .filter((candidate) => candidate.matched.length > 0 && candidate.ratio >= 0.67)
    .sort((left, right) =>
      right.ratio * right.quality - left.ratio * left.quality ||
      left.expectedDays - right.expectedDays
    );
  return candidates[0] || null;
}

function paymentFrom(transaction) {
  const merchant = transaction.merchant || transaction.merchantKey || "";
  const normalizedMerchant = toMerchantKey(merchant);
  const paidAt = new Date(transaction.txnDate);
  if (
    !normalizedMerchant ||
    !Number.isSafeInteger(transaction.amount) ||
    transaction.amount <= 0 ||
    Number.isNaN(paidAt.getTime())
  ) return null;
  return {
    transactionId: transaction._id,
    merchantName: String(transaction.merchant || transaction.merchantKey).trim(),
    normalizedMerchant,
    categoryId: transaction.categoryId || null,
    paidAt,
    amountPaise: transaction.amount,
  };
}

export function detectSubscriptionPatterns(transactions, { historyTruncated = false, detectedAt = new Date() } = {}) {
  const merchants = new Map();
  for (const transaction of transactions) {
    const payment = paymentFrom(transaction);
    if (!payment) continue;
    if (!merchants.has(payment.normalizedMerchant)) merchants.set(payment.normalizedMerchant, []);
    merchants.get(payment.normalizedMerchant).push(payment);
  }

  const patterns = [];
  let insufficientEvidenceCount = 0;
  let inconsistentPatternCount = 0;
  for (const [normalizedMerchant, unsortedPayments] of merchants) {
    const payments = [...new Map(
      unsortedPayments.map((item) => [String(item.transactionId), item])
    ).values()].sort((left, right) =>
      left.paidAt - right.paidAt || String(left.transactionId).localeCompare(String(right.transactionId))
    );
    if (payments.length < 2) {
      insufficientEvidenceCount += 1;
      continue;
    }

    const intervals = [];
    for (let index = 1; index < payments.length; index += 1) {
      intervals.push(Math.round((payments[index].paidAt - payments[index - 1].paidAt) / 86_400_000));
    }
    const candidate = frequencyCandidate(intervals);
    if (!candidate) {
      inconsistentPatternCount += 1;
      continue;
    }
    const amounts = payments.map((item) => item.amountPaise);
    const amountMedian = median(amounts);
    const amountVariationPercent = amountMedian > 0
      ? median(amounts.map((amount) => Math.abs(amount - amountMedian))) / amountMedian * 100
      : 100;
    const averageAmountPaise = Math.round(amounts.reduce((sum, value) => sum + value, 0) / amounts.length);
    const averageIntervalDays = Math.max(1, Math.round(
      candidate.matched.reduce((sum, value) => sum + value, 0) / candidate.matched.length
    ));
    const scoring = scorePattern({
      count: payments.length,
      intervals,
      matchedIntervals: candidate.matched.length,
      intervalQuality: candidate.quality,
      amountVariationPercent,
    });
    const categoryCounts = new Map();
    for (const payment of payments) {
      if (payment.categoryId) {
        const key = String(payment.categoryId);
        categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
      }
    }
    const categoryId = [...categoryCounts.entries()]
      .sort((left, right) => right[1] - left[1])[0]?.[0] || null;
    const lastPayment = payments.at(-1);
    const estimatedNextPaymentDate = new Date(
      lastPayment.paidAt.getTime() + averageIntervalDays * 86_400_000
    );

    patterns.push({
      merchantName: lastPayment.merchantName,
      normalizedMerchant,
      categoryId,
      averageAmountPaise,
      lastPaymentDate: lastPayment.paidAt,
      estimatedNextPaymentDate,
      frequency: candidate.name,
      confidenceScore: scoring.score,
      confidenceLevel: confidenceLevel(scoring.score),
      detectionEvidence: {
        transactionCount: payments.length,
        intervalsDays: intervals,
        matchedIntervals: candidate.matched.length,
        intervalConsistencyPercent: scoring.intervalConsistencyPercent,
        amountVariationPercent: Number(amountVariationPercent.toFixed(2)),
        merchantIdentityConsistencyPercent: 100,
        averageIntervalDays,
        payments: payments.map(({ transactionId, paidAt, amountPaise, categoryId }) => ({
          transactionId,
          paidAt,
          amountPaise,
          categoryId,
        })),
        historyTruncated,
        detectedAt,
      },
    });
  }
  return { patterns, insufficientEvidenceCount, inconsistentPatternCount };
}
