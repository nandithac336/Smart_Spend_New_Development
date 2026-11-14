const TYPE_BASE_SCORES = {
  large_transaction: 48,
  duplicate_exact: 82,
  duplicate_possible: 62,
  new_merchant: 20,
  unusual_merchant_amount: 52,
  merchant_spending_increase: 48,
  high_frequency: 58,
  category_spending_increase: 45,
  category_amount_anomaly: 50,
  wallet_anomaly: 42,
};

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreAnomaly({ type, ratio = 1, count = 0, exact = false }) {
  let score = TYPE_BASE_SCORES[type] ?? 20;
  if (
    type === "large_transaction" ||
    type === "unusual_merchant_amount" ||
    type === "category_amount_anomaly" ||
    type === "wallet_anomaly"
  ) {
    score += Math.max(0, (ratio - 1) * 8);
  } else if (type === "merchant_spending_increase" || type === "category_spending_increase") {
    score += Math.max(0, (ratio - 1) * 7);
  } else if (type === "high_frequency") {
    score += Math.max(0, (count - 3) * 5);
  } else if (type === "duplicate_exact" && exact) {
    score += 12;
  }
  return clamp(score);
}

export function severityForScore(score) {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

export function buildScoredAnomaly(input) {
  const score = scoreAnomaly(input);
  return {
    ...input,
    score,
    severity: severityForScore(score),
  };
}
