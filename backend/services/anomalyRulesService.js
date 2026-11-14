const DAY_MS = 86_400_000;
const MIN_AMOUNT_BASELINE = 8;
const MAX_AMOUNT = 10_000_000_000;

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function percentile(values, percentileValue) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(percentileValue * sorted.length) - 1)];
}

function robustAmountBaseline(transactions) {
  const amounts = transactions.map((item) => item.amount).filter(Number.isSafeInteger);
  if (amounts.length < MIN_AMOUNT_BASELINE) return null;
  const center = median(amounts);
  const deviations = amounts.map((amount) => Math.abs(amount - center));
  const mad = median(deviations) ?? 0;
  const p90 = percentile(amounts, 0.9);
  return {
    sampleSize: amounts.length,
    medianPaise: center,
    p90Paise: p90,
    madPaise: mad,
    thresholdPaise: Math.min(MAX_AMOUNT, Math.max(p90 * 1.5, center + 6 * mad, center * 3)),
  };
}

function isWithin(transaction, from, to) {
  const time = transaction.txnDate.getTime();
  return time >= from && time < to;
}

function merchantValue(transaction) {
  return transaction.merchantKey || "";
}

function anomaly(type, transaction, fields = {}) {
  return {
    type,
    transactionId: transaction._id,
    ...fields,
  };
}

function amountOutlier(transaction, samples, type) {
  const baseline = robustAmountBaseline(samples);
  if (!baseline || transaction.amount <= baseline.thresholdPaise) return null;
  return anomaly(type, transaction, {
    ratio: Number((transaction.amount / Math.max(1, baseline.medianPaise)).toFixed(2)),
    evidence: {
      amountPaise: transaction.amount,
      medianPaise: baseline.medianPaise,
      percentile90Paise: baseline.p90Paise,
      thresholdPaise: Math.round(baseline.thresholdPaise),
      sampleSize: baseline.sampleSize,
    },
  });
}

function findDuplicate(transaction, eligible) {
  const matches = eligible
    .filter((other) =>
      String(other._id) !== String(transaction._id) &&
      String(other.walletId) === String(transaction.walletId) &&
      other.type === transaction.type &&
      other.amount === transaction.amount &&
      merchantValue(other) !== "" &&
      merchantValue(other) === merchantValue(transaction)
    )
    .map((other) => ({
      transaction: other,
      deltaMs: Math.abs(other.txnDate.getTime() - transaction.txnDate.getTime()),
    }))
    .filter((match) => match.deltaMs <= DAY_MS)
    .sort((a, b) => a.deltaMs - b.deltaMs);
  if (!matches.length) return null;
  const match = matches[0];
  const exact = match.deltaMs <= 60_000;
  const pair = [String(transaction._id), String(match.transaction._id)].sort().join(":");
  return anomaly(exact ? "duplicate_exact" : "duplicate_possible", transaction, {
    exact,
    detectionKey: pair,
    evidence: {
      relatedTransactionId: match.transaction._id,
      amountPaise: transaction.amount,
      merchant: transaction.merchant || null,
      timestampDifferenceMinutes: Math.round(match.deltaMs / 60_000),
      matchingFields: ["amount", "merchant", "wallet", "type", "nearby date"],
    },
  });
}

function merchantChecks(transaction, history) {
  if (!transaction.merchantKey) return [];
  const prior = history.filter((item) =>
    item.merchantKey === transaction.merchantKey &&
    String(item._id) !== String(transaction._id) &&
    item.txnDate < transaction.txnDate
  );
  if (!prior.length) {
    return [anomaly("new_merchant", transaction, {
      evidence: { merchant: transaction.merchant || null, priorTransactions: 0 },
    })];
  }
  const events = [];
  const amountEvent = amountOutlier(transaction, prior, "unusual_merchant_amount");
  if (amountEvent) events.push(amountEvent);

  const previousWindow = transaction.txnDate.getTime() - 60 * DAY_MS;
  const recentWindowStart = transaction.txnDate.getTime() - 30 * DAY_MS;
  const recent = prior.filter((item) => isWithin(item, recentWindowStart, transaction.txnDate.getTime()));
  const previous = prior.filter((item) => isWithin(item, previousWindow, recentWindowStart));
  const recentTotal = recent.reduce((sum, item) => sum + item.amount, 0) + transaction.amount;
  const previousTotal = previous.reduce((sum, item) => sum + item.amount, 0);
  if (previous.length >= 3 && previousTotal > 0 && recentTotal >= previousTotal * 2.5) {
    events.push(anomaly("merchant_spending_increase", transaction, {
      ratio: Number((recentTotal / previousTotal).toFixed(2)),
      evidence: {
        recent30DaySpendPaise: recentTotal,
        previous30DaySpendPaise: previousTotal,
        recentTransactionCount: recent.length + 1,
        previousTransactionCount: previous.length,
      },
    }));
  }
  return events;
}

function frequencyChecks(transaction, eligible) {
  const start = transaction.txnDate.getTime() - 60 * 60 * 1000;
  const sameWalletAndType = eligible.filter((item) =>
    String(item.walletId) === String(transaction.walletId) &&
    item.type === transaction.type &&
    item.txnDate.getTime() <= transaction.txnDate.getTime()
  );
  const recentHour = sameWalletAndType.filter((item) => item.txnDate.getTime() >= start);
  const recentWeekStart = transaction.txnDate.getTime() - 7 * DAY_MS;
  const previousMonthStart = transaction.txnDate.getTime() - 35 * DAY_MS;
  const recentWeek = sameWalletAndType.filter((item) => item.txnDate.getTime() >= recentWeekStart);
  const previous28Days = sameWalletAndType.filter((item) =>
    item.txnDate.getTime() >= previousMonthStart &&
    item.txnDate.getTime() < recentWeekStart
  );
  const suddenIncrease =
    recentWeek.length >= 3 &&
    previous28Days.length >= 8 &&
    recentWeek.length / 7 >= (previous28Days.length / 28) * 2.5;
  if (recentHour.length < 4 && !suddenIncrease) return [];
  const count = recentHour.length >= 4 ? recentHour.length : recentWeek.length;
  return [anomaly("high_frequency", transaction, {
    count,
    evidence: {
      transactionCount: count,
      windowMinutes: recentHour.length >= 4 ? 60 : 10_080,
      walletId: transaction.walletId,
      suddenIncrease,
      recentWeekCount: recentWeek.length,
      previous28DayCount: previous28Days.length,
    },
  })];
}

function categoryIncrease(transaction, history) {
  if (!transaction.categoryId || transaction.type !== "expense") return [];
  const prior = history.filter((item) =>
    String(item.categoryId) === String(transaction.categoryId) &&
    item.type === "expense" &&
    item.txnDate < transaction.txnDate
  );
  if (prior.length < 6) return [];
  const amountEvent = amountOutlier(transaction, prior, "category_amount_anomaly");
  const recentStart = transaction.txnDate.getTime() - 30 * DAY_MS;
  const priorStart = transaction.txnDate.getTime() - 60 * DAY_MS;
  const recent = prior.filter((item) => isWithin(item, recentStart, transaction.txnDate.getTime()));
  const older = prior.filter((item) => isWithin(item, priorStart, recentStart));
  const oldDailyBaseline = older.reduce((sum, item) => sum + item.amount, 0);
  const recentTotal = recent.reduce((sum, item) => sum + item.amount, 0) + transaction.amount;
  const events = amountEvent ? [amountEvent] : [];
  if (older.length < 3 || oldDailyBaseline <= 0 || recentTotal < oldDailyBaseline * 2.5) return events;
  events.push(anomaly("category_spending_increase", transaction, {
    ratio: Number((recentTotal / oldDailyBaseline).toFixed(2)),
    evidence: {
      categoryId: transaction.categoryId,
      recent30DaySpendPaise: recentTotal,
      previous30DaySpendPaise: oldDailyBaseline,
      recentTransactionCount: recent.length + 1,
      previousTransactionCount: older.length,
    },
  }));
  return events;
}

function walletAnomaly(transaction, history) {
  const walletHistory = history.filter((item) =>
    String(item.walletId) === String(transaction.walletId) &&
    item.type === transaction.type &&
    item.txnDate < transaction.txnDate
  );
  const event = amountOutlier(transaction, walletHistory, "wallet_anomaly");
  if (event) {
    event.evidence.walletId = transaction.walletId;
  }
  return event;
}

export function detectTransactionAnomalies(transaction, history) {
  const eligible = history.filter((item) =>
    item.userId.toString() === transaction.userId.toString() &&
    item.status === "confirmed" &&
    item.deletedAt == null &&
    ["income", "expense"].includes(item.type)
  );
  const sameTypeHistory = eligible.filter((item) =>
    item.type === transaction.type && String(item._id) !== String(transaction._id) &&
    item.txnDate < transaction.txnDate
  );
  const events = [];

  const duplicate = findDuplicate(transaction, eligible);
  if (duplicate) events.push(duplicate);
  if (transaction.type === "expense") {
    const large = amountOutlier(transaction, sameTypeHistory, "large_transaction");
    if (large) events.push(large);
    events.push(...merchantChecks(transaction, eligible));
    events.push(...frequencyChecks(transaction, eligible));
    events.push(...categoryIncrease(transaction, eligible));
  }
  const wallet = walletAnomaly(transaction, eligible);
  if (wallet) events.push(wallet);
  return events;
}

export function getAmountBaseline(transactions) {
  return robustAmountBaseline(transactions);
}
