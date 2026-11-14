const DIMENSION_WEIGHTS = {
  incomeVsExpenses: 20,
  savingsRate: 20,
  budgetAdherence: 15,
  savingsGoalProgress: 10,
  subscriptionBurden: 10,
  recurringObligations: 10,
  spendingConsistency: 15,
};

function rounded(value) {
  return Math.round(value);
}

function burdenScore(ratio) {
  if (ratio <= 0.1) return 100;
  if (ratio <= 0.25) return rounded(100 - ((ratio - 0.1) / 0.15) * 25);
  if (ratio <= 0.4) return rounded(75 - ((ratio - 0.25) / 0.15) * 25);
  if (ratio <= 0.6) return rounded(50 - ((ratio - 0.4) / 0.2) * 30);
  return Math.max(0, rounded(20 - ((ratio - 0.6) / 0.4) * 20));
}

function normalizeDimensions(dimensions) {
  const weightTotal = dimensions.reduce((total, dimension) => total + dimension.baseWeight, 0);
  let assignedWeight = 0;
  return dimensions.map((dimension, index) => {
    const weight = index === dimensions.length - 1
      ? rounded((100 - assignedWeight) * 100) / 100
      : rounded((dimension.baseWeight / weightTotal) * 10_000) / 100;
    assignedWeight += weight;
    return {
      name: dimension.name,
      score: dimension.score,
      weight,
      explanation: dimension.explanation,
      figures: dimension.figures,
      improvementSuggestions: dimension.score < 80 ? dimension.improvementSuggestions : [],
    };
  });
}

export function scoreFinancialHealth(input) {
  const candidates = [];
  const add = (dimension) => candidates.push({
    ...dimension,
    baseWeight: DIMENSION_WEIGHTS[dimension.key],
  });

  if (input.monthlyIncomePaise > 0 && input.monthlyExpensePaise >= 0) {
    const ratio = input.monthlyExpensePaise / input.monthlyIncomePaise;
    const score = ratio <= 0.75
      ? 100
      : ratio <= 1
        ? rounded(100 - ((ratio - 0.75) / 0.25) * 40)
        : Math.max(0, rounded(60 - (ratio - 1) * 100));
    add({
      key: "incomeVsExpenses",
      name: "Income versus expenses",
      score,
      explanation: `Average monthly expenses are ${rounded(ratio * 100)}% of average monthly income over the covered period.`,
      figures: {
        averageMonthlyIncomePaise: input.monthlyIncomePaise,
        averageMonthlyExpensesPaise: input.monthlyExpensePaise,
        expenseToIncomePercent: Number((ratio * 100).toFixed(2)),
      },
      improvementSuggestions: ["Keep monthly expenses below income and review the largest recurring costs."],
    });

    const savingsRatio = (input.monthlyIncomePaise - input.monthlyExpensePaise) / input.monthlyIncomePaise;
    const savingsScore = savingsRatio <= 0
      ? 0
      : savingsRatio < 0.05
        ? rounded((savingsRatio / 0.05) * 50)
        : savingsRatio < 0.2
          ? rounded(50 + ((savingsRatio - 0.05) / 0.15) * 40)
          : Math.min(100, rounded(90 + ((savingsRatio - 0.2) / 0.1) * 10));
    add({
      key: "savingsRate",
      name: "Savings rate",
      score: savingsScore,
      explanation: `The period savings rate is ${Number((savingsRatio * 100).toFixed(2))}%, calculated from confirmed income and expenses.`,
      figures: {
        incomePaise: input.totalIncomePaise,
        expensesPaise: input.totalExpensePaise,
        netSavingsPaise: input.totalIncomePaise - input.totalExpensePaise,
        savingsRatePercent: Number((savingsRatio * 100).toFixed(2)),
      },
      improvementSuggestions: ["Choose a manageable savings target and review spending that does not support your priorities."],
    });
  }

  if (input.budgets.length) {
    const scores = input.budgets.map(({ percentageUsed }) => {
      if (percentageUsed <= 80) return 100;
      if (percentageUsed <= 100) return rounded(100 - ((percentageUsed - 80) / 20) * 30);
      return Math.max(0, rounded(70 - (percentageUsed - 100) * 2));
    });
    const averageScore = rounded(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    const exceeded = input.budgets.filter((budget) => budget.percentageUsed >= 100).length;
    add({
      key: "budgetAdherence",
      name: "Budget adherence",
      score: averageScore,
      explanation: `${input.budgets.length} completed budget${input.budgets.length === 1 ? "" : "s"} averaged ${Number((input.budgets.reduce((sum, item) => sum + item.percentageUsed, 0) / input.budgets.length).toFixed(2))}% utilization; ${exceeded} were exceeded.`,
      figures: {
        budgetCount: input.budgets.length,
        exceededBudgetCount: exceeded,
        averageUtilizationPercent: Number((input.budgets.reduce((sum, item) => sum + item.percentageUsed, 0) / input.budgets.length).toFixed(2)),
        sampleTruncated: input.budgetsTruncated,
      },
      improvementSuggestions: ["Review budgets that are close to or above their limits and adjust either spending or the planned limit."],
    });
  }

  if (input.goals.length) {
    const score = rounded(input.goals.reduce((sum, goal) => sum + goal.percentageComplete, 0) / input.goals.length);
    add({
      key: "savingsGoalProgress",
      name: "Savings goal progress",
      score,
      explanation: `Active savings goals are ${score}% complete on average.`,
      figures: {
        activeGoalCount: input.goals.length,
        averageProgressPercent: score,
        totalSavedPaise: input.goals.reduce((sum, goal) => sum + goal.savedAmount, 0),
        totalTargetPaise: input.goals.reduce((sum, goal) => sum + goal.targetAmount, 0),
        sampleTruncated: input.goalsTruncated,
      },
      improvementSuggestions: ["Consider regular, affordable contributions toward active savings goals."],
    });
  }

  const monthlyBaseline = input.monthlyIncomePaise || input.monthlyExpensePaise;
  if (monthlyBaseline > 0 && input.subscriptionMonthlyCostPaise > 0) {
    const ratio = input.subscriptionMonthlyCostPaise / monthlyBaseline;
    add({
      key: "subscriptionBurden",
      name: "Subscription burden",
      score: burdenScore(ratio),
      explanation: `Confirmed subscriptions not matched to active recurring schedules cost about ${rounded(ratio * 100)}% of the monthly ${input.monthlyIncomePaise ? "income" : "expense"} baseline.`,
      figures: {
        monthlyConfirmedSubscriptionCostPaise: input.subscriptionMonthlyCostPaise,
        baselineMonthlyPaise: monthlyBaseline,
        burdenPercent: Number((ratio * 100).toFixed(2)),
        excludedOverlappingMerchants: input.overlappingSubscriptionMerchants,
      },
      improvementSuggestions: ["Review confirmed subscriptions and cancel services you no longer use."],
    });
  }

  if (monthlyBaseline > 0 && input.recurringMonthlyCostPaise > 0) {
    const ratio = input.recurringMonthlyCostPaise / monthlyBaseline;
    add({
      key: "recurringObligations",
      name: "Recurring payment obligations",
      score: burdenScore(ratio),
      explanation: `Active recurring expense schedules total about ${rounded(ratio * 100)}% of the monthly ${input.monthlyIncomePaise ? "income" : "expense"} baseline.`,
      figures: {
        monthlyRecurringExpensePaise: input.recurringMonthlyCostPaise,
        baselineMonthlyPaise: monthlyBaseline,
        obligationPercent: Number((ratio * 100).toFixed(2)),
        scheduleCount: input.recurringScheduleCount,
        sampleTruncated: input.recurringSchedulesTruncated,
      },
      improvementSuggestions: ["Check that scheduled expenses are still needed and fit comfortably within monthly cash flow."],
    });
  }

  if (input.expenseMonths.length >= 3) {
    const values = input.expenseMonths.map((month) => month.expensePaise);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
    const coefficientOfVariation = mean ? Math.sqrt(variance) / mean : 0;
    const first = values[0];
    const last = values.at(-1);
    const trendPercent = first > 0 ? ((last - first) / first) * 100 : last > 0 ? 100 : 0;
    const volatilityPenalty = Math.min(55, coefficientOfVariation * 60);
    const growthPenalty = Math.min(35, Math.max(0, trendPercent - 10) * 0.7);
    const score = Math.max(0, rounded(100 - volatilityPenalty - growthPenalty));
    add({
      key: "spendingConsistency",
      name: "Spending consistency and trends",
      score,
      explanation: `Monthly expenses varied by ${Number((coefficientOfVariation * 100).toFixed(2))}% around their average; the first-to-last month change was ${Number(trendPercent.toFixed(2))}%.`,
      figures: {
        monthlyExpensesPaise: input.expenseMonths.map((month) => ({ month: month.month, amountPaise: month.expensePaise })),
        coefficientOfVariationPercent: Number((coefficientOfVariation * 100).toFixed(2)),
        firstToLastChangePercent: Number(trendPercent.toFixed(2)),
      },
      improvementSuggestions: ["Compare unusually high months with your plans and build a buffer for expenses that vary."],
    });
  }

  const dimensions = normalizeDimensions(candidates);
  if (!dimensions.length) {
    return {
      score: null,
      grade: "insufficient_data",
      dimensions,
      positiveHabits: [],
      areasNeedingImprovement: [],
      normalizedWeightTotal: 0,
    };
  }
  const score = rounded(dimensions.reduce((total, dimension) =>
    total + dimension.score * dimension.weight, 0) / 100);
  const grade = score >= 85 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "fair" : "needs_attention";
  return {
    score,
    grade,
    dimensions,
    positiveHabits: dimensions
      .filter((dimension) => dimension.score >= 80)
      .map(({ name, score: dimensionScore, explanation }) => ({ name, score: dimensionScore, explanation })),
    areasNeedingImprovement: dimensions
      .filter((dimension) => dimension.score < 60)
      .map(({ name, score: dimensionScore, explanation, improvementSuggestions }) => ({
        name,
        score: dimensionScore,
        explanation,
        suggestions: improvementSuggestions,
      })),
    normalizedWeightTotal: Number(dimensions.reduce((sum, dimension) => sum + dimension.weight, 0).toFixed(2)),
  };
}
