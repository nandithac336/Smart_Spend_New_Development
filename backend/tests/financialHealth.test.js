import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/smartspend_financial_health_test_never_connect";
process.env.JWT_SECRET = "financial_health_test_secret_value_123456";
process.env.JWT_REFRESH_SECRET = "financial_health_refresh_secret_123456";

const [
  { MongoMemoryServer },
  mongooseModule,
  appModule,
  userModule,
  walletModule,
  transactionModule,
  budgetModule,
  goalModule,
  recurringModule,
  subscriptionModule,
  tokenModule,
  serviceModule,
  scoringModule,
  queryModule,
  providerModule,
] = await Promise.all([
  import("mongodb-memory-server"),
  import("mongoose"),
  import("../app.js"),
  import("../models/User.js"),
  import("../models/Wallet.js"),
  import("../models/Transaction.js"),
  import("../models/Budget.js"),
  import("../models/Goal.js"),
  import("../models/RecurringTransaction.js"),
  import("../models/Subscription.js"),
  import("../utils/tokens.js"),
  import("../services/financialHealthService.js"),
  import("../services/financialHealthScoringService.js"),
  import("../services/financialQueryService.js"),
  import("../services/askSpartAiProvider.js"),
]);

const mongoose = mongooseModule.default;
const app = appModule.default;
const { User } = userModule;
const { Wallet } = walletModule;
const { Transaction } = transactionModule;
const { Budget } = budgetModule;
const { Goal } = goalModule;
const { RecurringTransaction } = recurringModule;
const { Subscription } = subscriptionModule;
const { signAccessToken } = tokenModule;
const { getFinancialHealth } = serviceModule;
const { scoreFinancialHealth } = scoringModule;
const { identifyFinancialIntent } = queryModule;
const { configureAskSpartAiProvider, resetAskSpartAiProvider } = providerModule;

let mongo;
let server;
let base;
let userA;
let userB;
let walletA;
let walletB;
let tokenA;
let tokenB;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Wallet.init(),
    Transaction.init(),
    Budget.init(),
    Goal.init(),
    RecurringTransaction.init(),
    Subscription.init(),
  ]);
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  resetAskSpartAiProvider();
  await Promise.all([
    Subscription.deleteMany({}),
    RecurringTransaction.deleteMany({}),
    Goal.deleteMany({}),
    Budget.deleteMany({}),
    Transaction.deleteMany({}),
    Wallet.deleteMany({}),
    User.deleteMany({}),
  ]);
  [userA, userB] = await User.create([
    { name: "Health A", email: "health-a@example.com", passwordHash: "unused", timezone: "Asia/Kolkata" },
    { name: "Health B", email: "health-b@example.com", passwordHash: "unused", timezone: "Asia/Kolkata" },
  ]);
  [walletA, walletB] = await Wallet.create([
    { userId: userA._id, name: "Main", type: "bank" },
    { userId: userB._id, name: "Private", type: "cash" },
  ]);
  tokenA = signAccessToken(userA._id);
  tokenB = signAccessToken(userB._id);
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

async function api(path, { token = tokenA, method = "GET", body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

function monthDate(offset, day = 15) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, day, 12));
}

async function addTransaction({
  user = userA,
  wallet = walletA,
  type = "expense",
  amount,
  txnDate = monthDate(1),
  status = "confirmed",
  deletedAt = null,
}) {
  return Transaction.create({
    userId: user._id,
    walletId: wallet._id,
    type,
    amount,
    txnDate,
    status,
    deletedAt,
  });
}

async function addThreeMonthHistory() {
  for (const [offset, income, expense] of [[3, 100_000, 30_000], [2, 100_000, 40_000], [1, 100_000, 50_000]]) {
    await addTransaction({ type: "income", amount: income, txnDate: monthDate(offset) });
    await addTransaction({ amount: expense, txnDate: monthDate(offset) });
  }
}

function scoringInput(overrides = {}) {
  return {
    totalIncomePaise: 300_000,
    totalExpensePaise: 120_000,
    monthlyIncomePaise: 100_000,
    monthlyExpensePaise: 40_000,
    budgets: [],
    budgetsTruncated: false,
    goals: [],
    goalsTruncated: false,
    recurringMonthlyCostPaise: 0,
    recurringScheduleCount: 0,
    recurringSchedulesTruncated: false,
    subscriptionMonthlyCostPaise: 0,
    overlappingSubscriptionMerchants: 0,
    expenseMonths: [],
    ...overrides,
  };
}

test("scoring is deterministic, transparent, bounded, and normalizes only available dimension weights", () => {
  const first = scoreFinancialHealth(scoringInput());
  const second = scoreFinancialHealth(scoringInput());
  assert.deepEqual(first, second);
  assert.equal(first.score, 100);
  assert.equal(first.normalizedWeightTotal, 100);
  assert.equal(first.dimensions.reduce((sum, item) => sum + item.weight, 0), 100);
  assert.deepEqual(first.dimensions.map((item) => item.name), ["Income versus expenses", "Savings rate"]);

  const partial = scoreFinancialHealth(scoringInput({
    monthlyIncomePaise: 0,
    monthlyExpensePaise: 0,
    budgets: [{ percentageUsed: 130 }],
  }));
  assert.equal(partial.dimensions.length, 1);
  assert.equal(partial.dimensions[0].weight, 100);
  assert.equal(partial.dimensions[0].score, 10);
  assert.ok(partial.score >= 0 && partial.score <= 100);
});

test("new users receive insufficient data without a fabricated score", async () => {
  const result = await getFinancialHealth(userA);
  assert.equal(result.score, null);
  assert.equal(result.grade, "insufficient_data");
  assert.equal(result.dimensions.length, 0);
  assert.equal(result.dataConfidence.level, "limited");
  assert.equal(result.period.completedMonths, 3);
});

test("one active month is insufficient to score income and expense patterns", async () => {
  await addTransaction({ type: "income", amount: 100_000, txnDate: monthDate(1) });
  const result = await getFinancialHealth(userA);
  assert.equal(result.score, null);
  assert.equal(result.dimensions.length, 0);
  assert.equal(result.dataConfidence.level, "low");
});

test("uses paise-accurate confirmed income and expenses, excluding transfers, trash, pending review and other users", async () => {
  await addThreeMonthHistory();
  await addTransaction({ user: userB, wallet: walletB, type: "income", amount: 10_000_000 });
  await addTransaction({ type: "transfer", amount: 90_000_000 });
  await addTransaction({ amount: 90_000_000, deletedAt: new Date() });
  await addTransaction({ amount: 90_000_000, status: "pending_review" });

  const result = await getFinancialHealth(userA);
  const incomeExpense = result.dimensions.find((item) => item.name === "Income versus expenses");
  const savings = result.dimensions.find((item) => item.name === "Savings rate");
  const consistency = result.dimensions.find((item) => item.name === "Spending consistency and trends");
  assert.equal(incomeExpense.figures.averageMonthlyIncomePaise, 100_000);
  assert.equal(incomeExpense.figures.averageMonthlyExpensesPaise, 40_000);
  assert.equal(savings.figures.netSavingsPaise, 180_000);
  assert.equal(savings.figures.savingsRatePercent, 60);
  assert.equal(consistency.figures.monthlyExpensesPaise.length, 3);
  assert.equal(consistency.figures.monthlyExpensesPaise[0].amountPaise, 30_000);
  assert.equal(result.dataConfidence.transactionCount, 6);
  assert.equal(result.period.endDate, new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 0)).toISOString().slice(0, 10));
});

test("zero expenses with recorded income is represented as positive savings rather than an error", async () => {
  for (const offset of [3, 2, 1]) {
    await addTransaction({ type: "income", amount: 25_001, txnDate: monthDate(offset) });
  }
  const result = await getFinancialHealth(userA);
  assert.equal(result.dimensions.find((item) => item.name === "Income versus expenses").score, 100);
  assert.equal(result.dimensions.find((item) => item.name === "Savings rate").figures.savingsRatePercent, 100);
});

test("completed budgets and active savings goals contribute supported dimensions", async () => {
  await addThreeMonthHistory();
  const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 2, 1));
  const end = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 0));
  await Budget.create({
    userId: userA._id,
    name: "Completed budget",
    amount: 200_000,
    period: "custom",
    startDate: start,
    endDate: end,
    status: "archived",
  });
  await Goal.create({
    userId: userA._id,
    name: "Savings goal",
    targetAmount: 100_000,
    savedAmount: 60_000,
    targetDate: new Date(Date.UTC(new Date().getUTCFullYear() + 1, 0, 1)),
    status: "active",
  });

  const result = await getFinancialHealth(userA);
  const budget = result.dimensions.find((item) => item.name === "Budget adherence");
  const goal = result.dimensions.find((item) => item.name === "Savings goal progress");
  assert.equal(budget.figures.budgetCount, 1);
  assert.equal(budget.figures.exceededBudgetCount, 0);
  assert.equal(goal.score, 60);
  assert.equal(goal.figures.totalSavedPaise, 60_000);
});

test("subscription burden excludes merchants already represented by recurring schedules", async () => {
  await addThreeMonthHistory();
  await RecurringTransaction.create([
    {
      userId: userA._id,
      name: "StreamBox",
      type: "expense",
      amount: 2_000,
      walletId: walletA._id,
      frequency: "monthly",
      startDate: monthDate(3),
      nextDueDate: monthDate(0),
      status: "active",
    },
    {
      userId: userA._id,
      name: "Weekly service",
      type: "expense",
      amount: 1_000,
      walletId: walletA._id,
      frequency: "weekly",
      startDate: monthDate(3),
      nextDueDate: monthDate(0),
      status: "active",
    },
    {
      userId: userA._id,
      name: "Annual service",
      type: "expense",
      amount: 12_000,
      walletId: walletA._id,
      frequency: "yearly",
      startDate: monthDate(3),
      nextDueDate: monthDate(0),
      status: "active",
    },
  ]);
  await Subscription.create([{
    userId: userA._id,
    merchantName: "StreamBox",
    normalizedMerchant: "streambox",
    averageAmountPaise: 2_000,
    lastPaymentDate: monthDate(1),
    estimatedNextPaymentDate: monthDate(0),
    frequency: "monthly",
    confidenceScore: 90,
    confidenceLevel: "high",
    detectionEvidence: {
      transactionCount: 3,
      intervalsDays: [30, 30],
      matchedIntervals: 2,
      intervalConsistencyPercent: 100,
      amountVariationPercent: 0,
      averageIntervalDays: 30,
      payments: [],
      detectedAt: new Date(),
    },
    status: "confirmed",
  }, {
    userId: userA._id,
    merchantName: "Other Service",
    normalizedMerchant: "other service",
    averageAmountPaise: 1_000,
    lastPaymentDate: monthDate(1),
    estimatedNextPaymentDate: monthDate(0),
    frequency: "monthly",
    confidenceScore: 90,
    confidenceLevel: "high",
    detectionEvidence: {
      transactionCount: 3,
      intervalsDays: [30, 30],
      matchedIntervals: 2,
      intervalConsistencyPercent: 100,
      amountVariationPercent: 0,
      averageIntervalDays: 30,
      payments: [],
      detectedAt: new Date(),
    },
    status: "confirmed",
  }]);

  const result = await getFinancialHealth(userA);
  const recurring = result.dimensions.find((item) => item.name === "Recurring payment obligations");
  const subscription = result.dimensions.find((item) => item.name === "Subscription burden");
  assert.equal(recurring.figures.monthlyRecurringExpensePaise, 7_333);
  assert.equal(recurring.figures.scheduleCount, 3);
  assert.equal(subscription.figures.monthlyConfirmedSubscriptionCostPaise, 1_000);
  assert.equal(subscription.figures.excludedOverlappingMerchants, 1);
});

test("score and breakdown APIs are authenticated and user-scoped", async () => {
  await addThreeMonthHistory();
  assert.equal((await api("/api/financial-health/score", { token: null })).status, 401);
  const own = await api("/api/financial-health/score");
  const other = await api("/api/financial-health/score", { token: tokenB });
  const breakdown = await api("/api/financial-health/breakdown");
  assert.equal(own.status, 200);
  assert.equal(own.json.data.score >= 0 && own.json.data.score <= 100, true);
  assert.equal(own.json.data.dimensions.reduce((sum, item) => sum + item.weight, 0), 100);
  assert.equal(other.json.data.score, null);
  assert.equal(other.json.data.dataConfidence.transactionCount, 0);
  assert.equal(breakdown.json.data.score, own.json.data.score);
});

test("Ask Spart recognizes health questions and uses deterministic verified answers", async () => {
  assert.equal(identifyFinancialIntent("What is my financial health score?").type, "financial_health");
  assert.equal(identifyFinancialIntent("Why is my score low?").type, "financial_health");
  assert.equal(identifyFinancialIntent("What are my strongest financial habits?").type, "financial_health");
  assert.equal(identifyFinancialIntent("How can I improve my financial health?").type, "financial_health");
  await addThreeMonthHistory();
  let providerCalls = 0;
  configureAskSpartAiProvider({
    async respond() {
      providerCalls += 1;
      return { message: "Invented score: 100." };
    },
  });
  const response = await api("/api/ask-spart/chat", {
    token: tokenA,
    method: "POST",
    body: { message: "What is my financial health score?" },
  });
  assert.equal(response.status, 201);
  assert.equal(providerCalls, 0);
  assert.equal(response.json.data.answerSource, "verified_data");
  assert.match(response.json.data.message, /financial health score is \d+\/100/);
});
