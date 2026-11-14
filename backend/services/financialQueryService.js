import { getCategoryBreakdown, getDailySpending, getIncomeExpenseTrend, getMerchantAnalysis, getOverallSummary, getPeriodComparison, getWalletBreakdown } from "./analyticsService.js";
import { getBudgetAnalytics, getSavingsAnalytics } from "./analyticsService.js";
import { listUpcomingRecurringTransactions } from "./recurringTransactionService.js";
import { listWalletsWithBalance } from "./balanceService.js";
import { Transaction } from "../models/Transaction.js";
import { Category } from "../models/Category.js";
import { toMerchantKey } from "../utils/merchant.js";
import { getUserSubscriptionSummary } from "./subscriptionService.js";
import {
  getCategoryExpensePredictions,
  getExpensePredictionOverview,
} from "./expensePredictionService.js";
import { getFinancialHealth } from "./financialHealthService.js";

const DEFAULT_TIME_ZONE = "Asia/Kolkata";
const normalized = (value) => toMerchantKey(value).replace(/\s+/g, " ").trim();
const publicCategory = (category) => category && ({
  name: category.name,
  totalPaise: category.total,
  transactionCount: category.count,
  percentage: category.percentage,
});

export function identifyFinancialIntent(message) {
  const text = normalized(message);
  if (/\b(invest|stock|crypto|tax advice|legal advice|transfer money|change transaction|create budget|pay|send money)\b/.test(text)) {
    return { type: "unsupported" };
  }
  if (
    /\b(financial health|health score|financial score|financial habits|improve my financial|improve my health score)\b/.test(text) ||
    /\bwhy\b.*\bscore\b.*\blow\b/.test(text)
  ) {
    return { type: "financial_health" };
  }
  if (/\b(subscriptions?|renewals?|charged regularly|charge me regularly|regular charges)\b/.test(text)) {
    return { type: "subscriptions" };
  }
  if (
    /\b(forecast|predict(?:ion)?|might|may|expected|expect|will)\b/.test(text) &&
    /\b(spend|spending|expense|expenses|category|increase|month-end|month end)\b/.test(text)
  ) {
    return { type: "prediction" };
  }
  if (/\b(which|what)\s+categories?\b.*\b(increase|rise|grow)\b/.test(text)) {
    return { type: "prediction" };
  }
  if (/\b(upcoming|coming up|recurring|payments due)\b/.test(text)) {
    return { type: "recurring" };
  }
  if (/\b(goal|goals|laptop|saved for|saving for|target)\b/.test(text)) {
    return { type: "goals" };
  }
  if (/\b(budget|budgets|overspend|overspending|almost exhausted|remaining budget|budget limit)\b/.test(text)) {
    return { type: "budgets" };
  }
  if (/\b(compare|compared|versus|vs|last month|previous month|increased|decreased|trend|trends)\b/.test(text)) {
    return { type: "comparison" };
  }
  if (/\b(where did most|most of my money|biggest expense category|highest spending category|top category|spending by category)\b/.test(text)) {
    return { type: "category" };
  }
  if (/\b(top five merchants|top 5 merchants|merchants|spent at|merchant)\b/.test(text)) {
    return { type: "merchants" };
  }
  if (/\b(wallet|wallets|balance|balances)\b/.test(text)) {
    return { type: "wallets" };
  }
  if (/\b(recent transactions|latest transactions|what did i buy)\b/.test(text)) {
    return { type: "recent_transactions" };
  }
  if (/\b(monthly transaction history|transactions this month|this month transactions)\b/.test(text)) {
    return { type: "monthly_transactions" };
  }
  if (/\b(daily spending|spending pattern|spending patterns|monthly pattern|monthly patterns|daily pattern)\b/.test(text)) {
    return { type: "patterns" };
  }
  if (/\b(savings rate|net savings|how much did i save|how much have i saved|saved this month)\b/.test(text)) {
    return { type: "savings" };
  }
  if (/\b(income|earned|earnings|salary)\b/.test(text)) {
    return { type: "income" };
  }
  if (/\b(food|groceries|transport|shopping|entertainment|health|education|bills|rent|travel)\b/.test(text)) {
    return { type: "category" };
  }
  if (/\b(spend|spent|spending|expense|expenses|money go|biggest expense|highest spending)\b/.test(text)) {
    return { type: "spending" };
  }
  if (/\b(summary|overview|how am i doing|financial picture)\b/.test(text)) {
    return { type: "overview" };
  }
  return { type: "unsupported" };
}

function timezoneFor(user) {
  return user.timezone || DEFAULT_TIME_ZONE;
}

function currentMonthQuery(user) {
  return { period: "month", timezone: timezoneFor(user) };
}

async function categoryIntentContext(user, message) {
  const breakdown = await getCategoryBreakdown(user, currentMonthQuery(user), "expense");
  const question = normalized(message);
  const selected = breakdown.categories.find((category) => {
    const name = normalized(category.name);
    return name && question.includes(name);
  });
  if (selected) {
    return {
      intent: "category",
      data: {
        period: breakdown.period,
        category: { name: selected.name, totalPaise: selected.total, transactionCount: selected.count },
        total: selected.total,
      },
    };
  }
  return {
    intent: "category",
    data: {
      period: breakdown.period,
      highest: publicCategory(breakdown.highest),
      categories: breakdown.categories.slice(0, 5).map(publicCategory),
      totalExpensesPaise: breakdown.total,
    },
  };
}

export async function executeFinancialQuery(user, message, intent = identifyFinancialIntent(message)) {
  const query = currentMonthQuery(user);
  if (intent.type === "financial_health") {
    const data = await getFinancialHealth(user);
    const question = normalized(message);
    let deterministicAnswer;
    if (data.score === null) {
      deterministicAnswer = "I don’t have enough recorded financial information to calculate a meaningful health score yet.";
    } else if (/\b(strongest|positive|good habits|doing well)\b/.test(question)) {
      deterministicAnswer = data.positiveHabits.length
        ? `Your strongest recorded financial habits are: ${data.positiveHabits.map((habit) => `${habit.name} (${habit.score}/100)`).join("; ")}. The overall score is ${data.score}/100 (${data.grade}).`
        : `The recorded data does not yet show a dimension scoring 80 or higher. Your current score is ${data.score}/100 (${data.grade}).`;
    } else if (/\b(why|improve|improvement|low|how can i)\b/.test(question)) {
      const areas = data.areasNeedingImprovement;
      deterministicAnswer = areas.length
        ? `Your score is ${data.score}/100 (${data.grade}). Areas needing attention: ${areas.map((area) => `${area.name}: ${area.explanation} ${area.suggestions.join(" ")}`).join(" ")}`
        : `Your score is ${data.score}/100 (${data.grade}). No measured dimension is currently below 60; continuing the recorded habits can help maintain progress.`;
    } else {
      deterministicAnswer = `Your financial health score is ${data.score}/100 (${data.grade}), based on ${data.dataConfidence.level} evidence across ${data.period.startDate} to ${data.period.endDate}. This reflects only information recorded in SmartSpend and is not a guarantee of financial security.`;
    }
    return {
      intent: intent.type,
      data,
      deterministicAnswer,
      recommendations: data.areasNeedingImprovement.flatMap((area) => area.suggestions).slice(0, 5),
    };
  }

  if (intent.type === "unsupported") {
    return {
      intent: intent.type,
      data: null,
      deterministicAnswer: "I can answer questions about your recorded spending, income, budgets, savings goals, wallets, and recurring transactions. I can’t provide investment, tax, or legal advice or make financial changes.",
      recommendations: [],
    };
  }

  if (intent.type === "subscriptions") {
    const data = await getUserSubscriptionSummary(user._id, { timeZone: timezoneFor(user) });
    const question = normalized(message);
    let deterministicAnswer;
    if (/\b(detected|not confirmed|unconfirmed)\b/.test(question)) {
      const items = data.detected.subscriptions;
      deterministicAnswer = items.length
        ? `Detected but not confirmed: ${items.map((item) => `${item.merchantName} (${item.frequency}, ${item.confidenceLevel} confidence)`).join("; ")}${data.detected.subscriptionsTruncated ? "; more results are available in the subscriptions list" : ""}.`
        : "There are no detected subscriptions waiting for your review.";
    } else if (/\b(upcoming|coming up|renewal|renewals)\b/.test(question)) {
      deterministicAnswer = data.upcomingPayments.length
        ? `Estimated upcoming subscription payments (not guaranteed): ${data.upcomingPayments.map((item) => `${item.merchantName}, ${formatPaise(item.estimatedAmountPaise)} around ${item.expectedPaymentDate}`).join("; ")}.`
        : "There are no estimated subscription payments in the next 30 days.";
    } else if (/\b(annual|yearly|per year|every year)\b/.test(question)) {
      deterministicAnswer = `Your confirmed subscriptions have an estimated annual cost of ${formatPaise(data.estimatedAnnualCostPaise)}. ${data.detectedSubscriptionCount} additional detected subscription(s) are not included until you confirm them.`;
    } else if (/\b(month|monthly|per month|every month|cost|spend)\b/.test(question)) {
      deterministicAnswer = `Your confirmed subscriptions have an estimated monthly cost of ${formatPaise(data.estimatedMonthlyCostPaise)}. Detected but unconfirmed subscriptions are reported separately and are not included in that total.`;
    } else if (/\b(merchants?|regularly)\b/.test(question)) {
      deterministicAnswer = data.confirmed.byMerchant.length
        ? `Your confirmed recurring merchants include: ${data.confirmed.byMerchant.map((item) => `${item.merchantName} (about ${formatPaise(item.monthlyCostPaise)} per month)`).join("; ")}. Detected but unconfirmed items are listed separately.`
        : "There are no confirmed merchants with detected subscription patterns yet.";
    } else {
      deterministicAnswer = `You have ${data.activeConfirmedSubscriptions} confirmed subscription(s) and ${data.detectedSubscriptionCount} detected subscription(s) awaiting review.`;
    }
    return { intent: intent.type, data, deterministicAnswer, recommendations: [] };
  }

  if (intent.type === "prediction") {
    const targetMonth = /\b(next month|coming month)\b/.test(normalized(message)) ? "nextMonth" : "currentMonth";
    const overview = await getExpensePredictionOverview(user);
    const forecast = overview[targetMonth];
    const question = normalized(message);
    const categories = await Category.find({
      type: "expense",
      $or: [{ userId: null }, { userId: user._id }],
    }).select("_id name").lean();
    const selectedCategory = categories.find((category) => {
      const name = normalized(category.name);
      return name && question.includes(name);
    });

    if (selectedCategory || /\b(categories?|food|shopping|transport|bills|entertainment|healthcare)\b/.test(question)) {
      const categoryForecast = await getCategoryExpensePredictions(user, {
        month: forecast.forecastPeriod,
        ...(selectedCategory ? { categoryId: String(selectedCategory._id) } : {}),
      });
      if (selectedCategory) {
        const item = categoryForecast.categories.find((category) =>
          String(category.categoryId) === String(selectedCategory._id)
        );
        const data = {
          forecastType: "prediction",
          currency: "INR",
          forecastPeriod: forecast.forecastPeriod,
          category: item || null,
          methodology: categoryForecast.methodology,
          limitations: categoryForecast.limitations,
        };
        return {
          intent: "prediction",
          data,
          deterministicAnswer: item?.status === "ok"
            ? `This is a forecast, not recorded spending: your ${selectedCategory.name} expenses for ${forecast.forecastPeriod} are projected at ${formatPaise(item.predictedAmountPaise)}.`
            : `I don’t have enough history to forecast ${selectedCategory.name} expenses reliably yet.`,
          recommendations: [],
        };
      }

      const increases = categoryForecast.categories
        .filter((category) => category.status === "ok" && category.changeVsPreviousMonthPaise > 0)
        .sort((left, right) => right.changeVsPreviousMonthPaise - left.changeVsPreviousMonthPaise)
        .slice(0, 5);
      return {
        intent: "prediction",
        data: {
          forecastType: "category_predictions",
          currency: "INR",
          forecastPeriod: categoryForecast.forecastPeriod,
          categories: categoryForecast.categories,
          categoriesAbovePreviousMonth: increases,
          methodology: categoryForecast.methodology,
          limitations: categoryForecast.limitations,
        },
        deterministicAnswer: increases.length
          ? `These are forecasts, not actuals. Categories projected above the previous month's recorded spending for ${categoryForecast.forecastPeriod}: ${increases.map((item) => `${item.name} (${formatPaise(item.predictedAmountPaise)} vs ${formatPaise(item.previousMonthActualPaise)})`).join("; ")}.`
          : "I don’t have enough evidence to identify a category likely to increase; category forecasts need sufficient history.",
        recommendations: [],
      };
    }

    const monthly = forecast;
    const data = {
      forecastType: "prediction",
      currency: "INR",
      forecastPeriod: monthly.forecastPeriod,
      predictedAmountPaise: monthly.predictedAmountPaise,
      expectedMonthEndPaise: monthly.expectedMonthEndPaise,
      actualMonthToDatePaise: monthly.actualMonthToDatePaise,
      remainingExpectedPaise: monthly.remainingExpectedPaise,
      dailyAveragePaise: monthly.dailyAveragePaise,
      confidence: monthly.confidence,
      historicalSampleSize: monthly.confidence.historicalSampleSize,
      methodology: monthly.methodology,
      limitations: monthly.limitations,
    };
    return {
      intent: "prediction",
      data,
      deterministicAnswer: monthly.status === "ok"
        ? `This is a forecast, not recorded spending. Expected spending for ${monthly.forecastPeriod} is ${formatPaise(monthly.expectedMonthEndPaise)}${targetMonth === "currentMonth" ? `, including ${formatPaise(monthly.actualMonthToDatePaise)} already recorded` : ""}. Confidence is ${monthly.confidence.level} based on ${monthly.confidence.historicalSampleSize} active historical months.`
        : `I don’t have enough recorded history to forecast spending for ${monthly.forecastPeriod} reliably yet.`,
      recommendations: [],
    };
  }

  if (intent.type === "spending" || intent.type === "income" || intent.type === "savings") {
    const summary = await getOverallSummary(user, query);
    const key = intent.type === "income"
      ? "totalIncomePaise"
      : intent.type === "savings"
        ? "netSavingsPaise"
        : "totalExpensesPaise";
    const amount = intent.type === "income"
      ? summary.income
      : intent.type === "savings"
        ? summary.netSavings
        : summary.expense;
    const data = {
      [key]: amount,
      totalIncomePaise: summary.income,
      totalExpensesPaise: summary.expense,
      netSavingsPaise: summary.netSavings,
      savingsRatePercent: summary.savingsRate,
      transactionCount: summary.transactionCount,
      currency: "INR",
      period: summary.period,
    };
    const title = intent.type === "income" ? "income" : intent.type === "savings" ? "net savings" : "expenses";
    return {
      intent: intent.type,
      data,
      deterministicAnswer: `Your ${title} this month is ${formatPaise(amount)}. Net savings are ${formatPaise(summary.netSavings)} and your savings rate is ${summary.savingsRate}%.`,
      recommendations: [],
    };
  }

  if (intent.type === "overview") {
    const report = await getOverallSummary(user, query);
    const categories = await getCategoryBreakdown(user, query, "expense");
    const data = {
      totalIncomePaise: report.income,
      totalExpensesPaise: report.expense,
      netSavingsPaise: report.netSavings,
      savingsRatePercent: report.savingsRate,
      highestCategory: publicCategory(categories.highest),
      period: report.period,
      currency: "INR",
    };
    return {
      intent: "overview",
      data,
      deterministicAnswer: `This month you earned ${formatPaise(report.income)}, spent ${formatPaise(report.expense)}, and saved ${formatPaise(report.netSavings)}. Your savings rate is ${report.savingsRate}%.${categories.highest ? ` Your highest spending category was ${categories.highest.name} at ${formatPaise(categories.highest.total)}.` : ""}`,
      recommendations: [],
    };
  }

  if (intent.type === "comparison") {
    const comparison = await getPeriodComparison(user, { period: "month", timezone: timezoneFor(user) });
    const expenses = comparison.metrics.expense;
    const data = {
      currentExpensesPaise: expenses.current,
      previousExpensesPaise: expenses.previous,
      changePaise: expenses.change,
      percentageChange: expenses.percentageChange,
      currentPeriod: comparison.currentPeriod,
      previousPeriod: comparison.previousPeriod,
      currency: "INR",
    };
    const movement = expenses.change > 0 ? "increased" : expenses.change < 0 ? "decreased" : "stayed the same";
    const percent = expenses.percentageChange == null ? "" : ` (${Math.abs(expenses.percentageChange)}%)`;
    return {
      intent: intent.type,
      data,
      deterministicAnswer: `This month's expenses ${movement} by ${formatPaise(Math.abs(expenses.change))}${percent} compared with last month. This month: ${formatPaise(expenses.current)}; last month: ${formatPaise(expenses.previous)}.`,
      recommendations: expenses.change > 0
        ? [{ type: "spending_increase", fact: "Recorded expenses are higher than the previous month.", suggestion: "Review the largest category and recent transactions to see what changed." }]
        : [],
    };
  }

  if (intent.type === "category") {
    const context = await categoryIntentContext(user, message);
    if (context.data.category) {
      return {
        ...context,
        deterministicAnswer: `You spent ${formatPaise(context.data.total)} in ${context.data.category.name} this month.`,
        recommendations: [],
      };
    }
    const highest = context.data.highest;
    return {
      ...context,
      deterministicAnswer: highest
        ? `Your highest spending category this month is ${highest.name} at ${formatPaise(highest.total)}.`
        : "There are no recorded expenses for this month.",
      recommendations: [],
    };
  }

  if (intent.type === "merchants") {
    const analysis = await getMerchantAnalysis(user, query, new Date(), 5);
    const data = {
      merchants: analysis.merchants.map((merchant) => ({
        merchant: merchant.merchant,
        totalPaise: merchant.total,
        transactionCount: merchant.count,
      })),
      currency: "INR",
      period: analysis.period,
    };
    const answer = data.merchants.length
      ? `Your top merchants this month are ${data.merchants.map((merchant, index) => `${index + 1}. ${merchant.merchant}: ${formatPaise(merchant.totalPaise)}`).join("; ")}.`
      : "There are no merchant expenses recorded this month.";
    return { intent: intent.type, data, deterministicAnswer: answer, recommendations: [] };
  }

  if (intent.type === "budgets") {
    const report = await getBudgetAnalytics(user, { limit: 20 });
    const categoryIds = report.budgets.map((budget) => budget.categoryId).filter(Boolean);
    const categories = await Category.find({
      _id: { $in: categoryIds },
      $or: [{ userId: null }, { userId: user._id }],
    }).select("_id name").lean();
    const categoryNames = new Map(categories.map((category) => [String(category._id), category.name]));
    const budgets = report.budgets.map((budget) => ({
      name: budget.name,
      categoryName: categoryNames.get(String(budget.categoryId)) || null,
      limitPaise: budget.amount,
      spentPaise: budget.progress.actualSpending,
      remainingPaise: budget.progress.remainingAmount,
      utilizationPercent: budget.progress.percentageUsed,
      isApproachingLimit: budget.progress.isApproachingLimit,
      isExceeded: budget.progress.isExceeded,
      periodStart: budget.startDate,
      periodEnd: budget.endDate,
    }));
    const relevant = budgets.filter((budget) => {
      const name = normalized(budget.name);
      const categoryName = normalized(budget.categoryName);
      const question = normalized(message);
      return (name && question.includes(name)) || (categoryName && question.includes(categoryName));
    });
    const selected = relevant.length ? relevant : budgets.filter((budget) => budget.isApproachingLimit || budget.isExceeded);
    const data = { budgets: selected.slice(0, 10), currency: "INR" };
    const recommendations = selected.filter((budget) => budget.isApproachingLimit || budget.isExceeded).map((budget) => ({
      type: budget.isExceeded ? "budget_exceeded" : "budget_approaching",
      fact: `${budget.name} is ${budget.utilizationPercent}% utilized.`,
      suggestion: "Review spending in this budget before making additional purchases.",
    }));
    const answer = selected.length
      ? selected.map((budget) =>
        `${budget.name}: spent ${formatPaise(budget.spentPaise)} of ${formatPaise(budget.limitPaise)}, ${formatPaise(budget.remainingPaise)} remaining (${budget.utilizationPercent}%).`
      ).join(" ")
      : "You have no active budgets approaching or exceeding their limits.";
    return { intent: intent.type, data, deterministicAnswer: answer, recommendations };
  }

  if (intent.type === "goals") {
    const report = await getSavingsAnalytics(user, { limit: 20 });
    const question = normalized(message);
    const matched = report.goals.find((goal) => question.includes(normalized(goal.name)));
    const goals = (matched ? [matched] : report.goals)
      .sort((a, b) => b.progress.percentageComplete - a.progress.percentageComplete)
      .slice(0, 5)
      .map((goal) => ({
        name: goal.name,
        targetPaise: goal.targetAmount,
        savedPaise: goal.savedAmount,
        remainingPaise: goal.progress.remainingAmount,
        progressPercent: goal.progress.percentageComplete,
        status: goal.status,
        targetDate: goal.targetDate,
      }));
    const data = { goals, currency: "INR" };
    const answer = goals.length
      ? goals.map((goal) => `${goal.name}: saved ${formatPaise(goal.savedPaise)} of ${formatPaise(goal.targetPaise)}; ${formatPaise(goal.remainingPaise)} remaining (${goal.progressPercent}%).`).join(" ")
      : "You don’t have any savings goals recorded yet.";
    return {
      intent: intent.type,
      data,
      deterministicAnswer: answer,
      recommendations: goals.filter((goal) => goal.status === "active" && goal.progressPercent < 25).map((goal) => ({
        type: "goal_progress",
        fact: `${goal.name} is ${goal.progressPercent}% complete.`,
        suggestion: "Consider reviewing your planned contributions and target date.",
      })),
    };
  }

  if (intent.type === "recurring") {
    const schedules = await listUpcomingRecurringTransactions(user, { days: 30, limit: 20 });
    const recurring = schedules.map((schedule) => ({
      name: schedule.name,
      type: schedule.type,
      amountPaise: schedule.amount,
      nextDueDate: schedule.nextDueDate,
      frequency: schedule.frequency,
      wallet: schedule.walletId?.name || null,
    }));
    const data = { recurring, currency: "INR", horizonDays: 30 };
    return {
      intent: intent.type,
      data,
      deterministicAnswer: recurring.length
        ? `In the next 30 days: ${recurring.map((item) => `${item.name}, ${item.type}, ${formatPaise(item.amountPaise)} on ${new Date(item.nextDueDate).toISOString().slice(0, 10)}`).join("; ")}.`
        : "There are no active recurring payments due in the next 30 days.",
      recommendations: [],
    };
  }

  if (intent.type === "wallets") {
    const breakdown = await getWalletBreakdown(user, query, new Date(), 20);
    const wallets = await listWalletsWithBalance(user._id, { includeArchived: false, limit: 20 });
    const byId = new Map(breakdown.wallets.map((wallet) => [String(wallet._id), wallet]));
    const data = {
      wallets: wallets.map((wallet) => {
        const activity = byId.get(String(wallet._id));
        return {
          name: wallet.name,
          balancePaise: wallet.balance,
          incomePaise: activity?.income ?? 0,
          expensesPaise: activity?.expense ?? 0,
        };
      }),
      currency: "INR",
      period: breakdown.period,
    };
    const answer = data.wallets.length
      ? data.wallets.map((wallet) => `${wallet.name}: balance ${formatPaise(wallet.balancePaise)}, this month's income ${formatPaise(wallet.incomePaise)} and expenses ${formatPaise(wallet.expensesPaise)}.`).join(" ")
      : "You have no active wallets.";
    return { intent: intent.type, data, deterministicAnswer: answer, recommendations: [] };
  }

  if (intent.type === "recent_transactions") {
    const transactions = await Transaction.find({
      userId: user._id,
      status: "confirmed",
      deletedAt: null,
      type: { $in: ["income", "expense"] },
    })
      .sort({ txnDate: -1, _id: -1 })
      .limit(5)
      .select("type amount merchant note txnDate")
      .lean();
    const data = {
      transactions: transactions.map((item) => ({
        type: item.type,
        amountPaise: item.amount,
        merchant: item.merchant || null,
        description: item.note || null,
        date: item.txnDate,
      })),
      currency: "INR",
    };
    return {
      intent: intent.type,
      data,
      deterministicAnswer: transactions.length
        ? `Your five most recent transactions: ${transactions.map((item) => `${item.type} ${formatPaise(item.amount)}${item.merchant ? ` at ${item.merchant}` : ""} on ${item.txnDate.toISOString().slice(0, 10)}`).join("; ")}.`
        : "There are no confirmed transactions recorded.",
      recommendations: [],
    };
  }

  if (intent.type === "monthly_transactions") {
    const window = (await getOverallSummary(user, query)).period;
    const transactions = await Transaction.find({
      userId: user._id,
      status: "confirmed",
      deletedAt: null,
      type: { $in: ["income", "expense"] },
      txnDate: { $gte: window.start, $lt: window.end },
    })
      .sort({ txnDate: -1, _id: -1 })
      .limit(20)
      .select("type amount merchant note txnDate")
      .lean();
    const data = {
      period: { startDate: window.startDate, endDate: window.endDate, timeZone: window.timeZone },
      transactions: transactions.map((item) => ({
        type: item.type,
        amountPaise: item.amount,
        merchant: item.merchant || null,
        description: item.note || null,
        date: item.txnDate,
      })),
      currency: "INR",
    };
    return {
      intent: intent.type,
      data,
      deterministicAnswer: transactions.length
        ? `Here are your ${transactions.length} most recent recorded transactions this month${transactions.length === 20 ? " (showing the latest 20)" : ""}: ${transactions.map((item) => `${item.type} ${formatPaise(item.amount)}${item.merchant ? ` at ${item.merchant}` : ""} on ${item.txnDate.toISOString().slice(0, 10)}`).join("; ")}.`
        : "There are no confirmed transactions recorded this month.",
      recommendations: [],
    };
  }

  if (intent.type === "patterns") {
    const [daily, monthly] = await Promise.all([
      getDailySpending(user, query),
      getIncomeExpenseTrend(user, { period: "year", timezone: timezoneFor(user) }, "month"),
    ]);
    const data = {
      currentMonthDailyExpenses: daily.data.slice(-14),
      monthlyTrend: monthly.data.slice(-6),
      currency: "INR",
    };
    return {
      intent: intent.type,
      data,
      deterministicAnswer: `Your recorded expenses this month total ${formatPaise(daily.total)}, averaging ${formatPaise(daily.averageDailyExpenditure)} per calendar day. The daily and recent monthly values are included in the verified data.`,
      recommendations: [],
    };
  }

  return {
    intent: "unsupported",
    data: null,
    deterministicAnswer: "I can answer questions about your recorded finances, but I couldn’t match that question to a supported query.",
    recommendations: [],
  };
}

export function formatPaise(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value / 100);
}
