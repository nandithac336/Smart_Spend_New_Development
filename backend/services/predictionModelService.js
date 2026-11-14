const MIN_ACTIVE_MONTHS = 3;

function average(values) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function confidenceFor(sampleSize) {
  if (sampleSize >= 12) return "high";
  if (sampleSize >= 6) return "medium";
  return "low";
}

export function forecastMonthlyAmount(monthlyAmounts) {
  const observed = monthlyAmounts.filter((item) => Number.isSafeInteger(item.amountPaise) && item.amountPaise >= 0);
  const activeMonths = observed.filter((item) => item.amountPaise > 0).length;
  if (activeMonths < MIN_ACTIVE_MONTHS) {
    return {
      status: "insufficient_data",
      predictedAmountPaise: null,
      confidence: { level: "insufficient", sampleSize: activeMonths, monthsAnalyzed: observed.length },
    };
  }

  const recent = observed.slice(-3).map((item) => item.amountPaise);
  const older = observed.slice(0, -3).map((item) => item.amountPaise);
  const recentAverage = average(recent);
  const baseline = older.length
    ? recentAverage * 0.6 + average(older) * 0.4
    : recentAverage;
  const predictedAmountPaise = Math.max(0, Math.round(baseline));
  const sampleSize = activeMonths;

  return {
    status: "ok",
    predictedAmountPaise,
    confidence: { level: confidenceFor(sampleSize), sampleSize, monthsAnalyzed: observed.length },
    methodology: older.length
      ? "60% recent-three-month mean blended with 40% of earlier observed monthly means."
      : "Mean of the latest three observed monthly expense totals.",
  };
}

export function forecastCurrentMonth({
  historicalMonthlyAmounts,
  actualMonthToDatePaise,
  elapsedDays,
  daysInMonth,
  recurringRemainingPaise,
}) {
  const baseline = forecastMonthlyAmount(historicalMonthlyAmounts);
  if (baseline.status !== "ok") {
    return {
      ...baseline,
      actualMonthToDatePaise,
      expectedMonthEndPaise: null,
      remainingExpectedPaise: null,
      dailyAveragePaise: null,
      knownRecurringRemainingPaise: recurringRemainingPaise,
    };
  }
  const remainingDays = Math.max(0, daysInMonth - elapsedDays);
  const nonRecurringRemainingPaise = Math.round(
    baseline.predictedAmountPaise * remainingDays / daysInMonth
  );
  const remainingExpectedPaise = nonRecurringRemainingPaise + recurringRemainingPaise;
  const expectedMonthEndPaise = actualMonthToDatePaise + remainingExpectedPaise;
  return {
    ...baseline,
    actualMonthToDatePaise,
    nonRecurringRemainingPaise,
    knownRecurringRemainingPaise: recurringRemainingPaise,
    remainingExpectedPaise,
    expectedMonthEndPaise,
    dailyAveragePaise: Math.round(expectedMonthEndPaise / daysInMonth),
    elapsedDays,
    remainingDays,
  };
}

export function calculateForecastAccuracy(samples) {
  const valid = samples.filter((sample) =>
    Number.isSafeInteger(sample.predictedAmountPaise) &&
    Number.isSafeInteger(sample.actualAmountPaise) &&
    sample.predictedAmountPaise >= 0 &&
    sample.actualAmountPaise >= 0
  );
  if (!valid.length) {
    return {
      status: "insufficient_data",
      evaluatedPeriods: 0,
      maePaise: null,
      mapePercent: null,
      zeroActualPeriods: 0,
    };
  }
  const absoluteErrors = valid.map((sample) =>
    Math.abs(sample.predictedAmountPaise - sample.actualAmountPaise)
  );
  const percentageErrors = valid
    .filter((sample) => sample.actualAmountPaise > 0)
    .map((sample) =>
      Math.abs(sample.predictedAmountPaise - sample.actualAmountPaise) /
      sample.actualAmountPaise * 100
    );
  return {
    status: "ok",
    evaluatedPeriods: valid.length,
    maePaise: Math.round(average(absoluteErrors)),
    mapePercent: percentageErrors.length ? Number(average(percentageErrors).toFixed(2)) : null,
    zeroActualPeriods: valid.filter((sample) => sample.actualAmountPaise === 0).length,
    methodology: "Rolling-origin monthly backtest; each forecast uses only completed months preceding its forecast month. MAPE omits zero-actual periods.",
  };
}
