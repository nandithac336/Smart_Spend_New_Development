import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/smartspend_prediction_test_never_connect";
process.env.JWT_SECRET = "prediction_test_secret_value_123456";
process.env.JWT_REFRESH_SECRET = "prediction_test_refresh_secret_123456";

const [
  { MongoMemoryServer },
  mongooseModule,
  appModule,
  userModule,
  walletModule,
  categoryModule,
  transactionModule,
  recurringModule,
  subscriptionModule,
  tokenModule,
  predictionModule,
  modelModule,
  featureModule,
  askModule,
  queryModule,
  analyticsModule,
] = await Promise.all([
  import("mongodb-memory-server"),
  import("mongoose"),
  import("../app.js"),
  import("../models/User.js"),
  import("../models/Wallet.js"),
  import("../models/Category.js"),
  import("../models/Transaction.js"),
  import("../models/RecurringTransaction.js"),
  import("../models/Subscription.js"),
  import("../utils/tokens.js"),
  import("../services/expensePredictionService.js"),
  import("../services/predictionModelService.js"),
  import("../services/predictionFeatureService.js"),
  import("../services/askSpartService.js"),
  import("../services/financialQueryService.js"),
  import("../services/analyticsService.js"),
]);

const mongoose = mongooseModule.default;
const app = appModule.default;
const { User } = userModule;
const { Wallet } = walletModule;
const { Category } = categoryModule;
const { Transaction } = transactionModule;
const { RecurringTransaction } = recurringModule;
const { Subscription } = subscriptionModule;
const { signAccessToken } = tokenModule;
const {
  getCategoryExpensePredictions,
  getDailyExpensePrediction,
  getExpensePredictionAccuracy,
  getExpensePredictionOverview,
  getMonthlyExpensePrediction,
} = predictionModule;
const { calculateForecastAccuracy, forecastMonthlyAmount } = modelModule;
const { calendarDate } = featureModule;
const { sendAskSpartMessage } = askModule;
const { identifyFinancialIntent } = queryModule;
const { resolveAnalyticsWindow } = analyticsModule;

const NOW = new Date("2026-11-15T12:00:00.000Z");
const MONTHS = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
let mongo;
let server;
let base;
let userA;
let userB;
let walletA;
let walletB;
let food;
let transport;
let tokenA;
let tokenB;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Wallet.init(),
    Category.init(),
    Transaction.init(),
    RecurringTransaction.init(),
    Subscription.init(),
  ]);
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await Promise.all([
    Transaction.deleteMany({}),
    RecurringTransaction.deleteMany({}),
    Subscription.deleteMany({}),
    Category.deleteMany({}),
    Wallet.deleteMany({}),
    User.deleteMany({}),
  ]);
  [userA, userB] = await User.create([
    { name: "Prediction A", email: "prediction-a@example.com", passwordHash: "unused", timezone: "Asia/Kolkata" },
    { name: "Prediction B", email: "prediction-b@example.com", passwordHash: "unused", timezone: "Asia/Kolkata" },
  ]);
  [walletA, walletB] = await Wallet.create([
    { userId: userA._id, name: "Main", type: "bank" },
    { userId: userB._id, name: "Other", type: "cash" },
  ]);
  [food, transport] = await Category.create([
    { userId: null, name: "Food", type: "expense", icon: "food" },
    { userId: userA._id, name: "Transport", type: "expense", icon: "bus" },
  ]);
  tokenA = signAccessToken(userA._id);
  tokenB = signAccessToken(userB._id);
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

function txnDate(monthKey, day = 5, user = userA) {
  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = calendarDate(year, month);
  const window = resolveWindow(monthStart, user);
  return new Date(window.getTime() + (day - 1) * 86_400_000 + 12 * 60 * 60 * 1000);
}

function resolveWindow(date, user) {
  const timeZone = user.timezone || "Asia/Kolkata";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.filter((item) => item.type !== "literal").map((item) => [item.type, item.value]));
  const localStartMarker = new Date(`${value.year}-${value.month}-${value.day}T00:00:00.000Z`);
  const analyticsWindow = resolveAnalyticsWindow({
    startDate: localStartMarker,
    endDate: localStartMarker,
    timezone: timeZone,
  }, user);
  return analyticsWindow.start;
}

async function addExpense({
  user = userA,
  wallet = walletA,
  amount = 10_000,
  categoryId = food._id,
  month,
  day = 5,
  source = "manual",
  status = "confirmed",
  deletedAt = null,
  recurringScheduleId,
  merchant = "Cafe",
}) {
  return Transaction.create({
    userId: user._id,
    walletId: wallet._id,
    type: "expense",
    amount,
    categoryId,
    txnDate: txnDate(month, day, user),
    status,
    deletedAt,
    source,
    recurringScheduleId,
    merchant,
    merchantKey: merchant.toLowerCase(),
  });
}

async function seedMonthlyHistory() {
  const totals = [10_000, 20_000, 30_000, 40_000, 50_000, 60_000];
  for (let index = 0; index < MONTHS.length; index += 1) {
    await addExpense({ amount: totals[index], month: MONTHS[index] });
    await addExpense({
      amount: 2_000 + index * 1_000,
      month: MONTHS[index],
      categoryId: transport._id,
      day: 8,
    });
  }
}

async function api(path, { method = "GET", token = tokenA, body } = {}) {
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

test("monthly model requires real history and returns explainable statistics and safe accuracy metrics", () => {
  assert.equal(forecastMonthlyAmount([]).status, "insufficient_data");
  assert.equal(forecastMonthlyAmount([
    { amountPaise: 100 }, { amountPaise: 200 }, { amountPaise: 300 },
  ]).predictedAmountPaise, 200);
  const accuracy = calculateForecastAccuracy([
    { predictedAmountPaise: 150, actualAmountPaise: 100 },
    { predictedAmountPaise: 0, actualAmountPaise: 0 },
  ]);
  assert.equal(accuracy.maePaise, 25);
  assert.equal(accuracy.mapePercent, 50);
  assert.equal(accuracy.zeroActualPeriods, 1);
  assert.equal(calculateForecastAccuracy([{ predictedAmountPaise: 100, actualAmountPaise: 0 }]).mapePercent, null);
});

test("overview and monthly forecasts use owner-only completed history and report current and next month", async () => {
  await seedMonthlyHistory();
  await addExpense({ user: userB, wallet: walletB, amount: 5_000_000, month: "2026-10" });
  await addExpense({ amount: 90_000, month: "2026-10", status: "pending_review" });
  await addExpense({ amount: 90_000, month: "2026-10", deletedAt: new Date() });
  await addExpense({ amount: 500_000, month: "2026-10", source: "recurring" });

  const overview = await getExpensePredictionOverview(userA, { now: NOW });
  assert.equal(overview.currentMonth.forecastPeriod, "2026-11");
  assert.equal(overview.nextMonth.forecastPeriod, "2026-12");
  assert.equal(overview.currentMonth.status, "ok");
  assert.equal(overview.currentMonth.actualMonthToDatePaise, 0);
  assert.equal(overview.currentMonth.confidence.historicalSampleSize, 6);
  assert.ok(overview.currentMonth.expectedMonthEndPaise > 0);

  const next = await getMonthlyExpensePrediction(userA, { month: "2026-12", now: NOW });
  assert.equal(next.status, "ok");
  assert.equal(next.currency, "INR");
  assert.equal(next.forecastPeriod, "2026-12");
  assert.ok(next.predictedAmountPaise > 0);
});

test("categories use actual visible categories, and daily forecast respects category, timezone, and calendar days", async () => {
  await seedMonthlyHistory();
  const categories = await getCategoryExpensePredictions(userA, { month: "2026-12", now: NOW });
  const foodForecast = categories.categories.find((item) => String(item.categoryId) === String(food._id));
  const transportForecast = categories.categories.find((item) => String(item.categoryId) === String(transport._id));
  assert.ok(foodForecast.predictedAmountPaise > transportForecast.predictedAmountPaise);
  assert.equal(foodForecast.status, "ok");
  assert.ok(categories.categories.every((item) => item.name !== "Other user's private category"));

  const daily = await getDailyExpensePrediction(userA, {
    month: "2026-11",
    categoryId: String(food._id),
    now: NOW,
  });
  assert.equal(daily.data.length, 30);
  assert.equal(daily.data[14].status, "actual");
  assert.equal(daily.data[15].status, "forecast");
  assert.equal(daily.data[15].predictedAmountPaise, daily.dailyAveragePaise);
});

test("active recurring forecasts are separate from history and generated schedules are not double-counted", async () => {
  await seedMonthlyHistory();
  const schedule = await RecurringTransaction.create({
    userId: userA._id,
    name: "Internet",
    type: "expense",
    amount: 7_500,
    walletId: walletA._id,
    categoryId: transport._id,
    frequency: "monthly",
    startDate: new Date("2026-11-20T00:00:00.000Z"),
    nextDueDate: new Date("2026-11-20T00:00:00.000Z"),
    status: "active",
  });
  const current = await getMonthlyExpensePrediction(userA, { month: "2026-11", now: NOW });
  const next = await getMonthlyExpensePrediction(userA, { month: "2026-12", now: NOW });
  assert.equal(current.knownRecurringPaise, 7_500);
  assert.equal(next.knownRecurringPaise, 7_500);

  await addExpense({
    amount: 7_500,
    month: "2026-11",
    day: 20,
    source: "recurring",
    categoryId: transport._id,
    recurringScheduleId: schedule._id,
  });
  const withGenerated = await getMonthlyExpensePrediction(userA, { month: "2026-11", now: NOW });
  assert.equal(withGenerated.knownRecurringPaise, 7_500);
  assert.equal(withGenerated.actualMonthToDatePaise, 0);
  assert.equal(withGenerated.expectedMonthEndPaise, current.expectedMonthEndPaise);
});

test("future generated recurring expenses remain forecast when their schedule is no longer active", async () => {
  await seedMonthlyHistory();
  const schedule = await RecurringTransaction.create({
    userId: userA._id,
    name: "Ended service",
    type: "expense",
    amount: 12_345,
    walletId: walletA._id,
    categoryId: transport._id,
    frequency: "monthly",
    startDate: new Date("2026-10-01T00:00:00.000Z"),
    nextDueDate: new Date("2026-11-10T00:00:00.000Z"),
    status: "completed",
  });
  await addExpense({
    amount: 12_345,
    month: "2026-11",
    day: 25,
    source: "recurring",
    categoryId: transport._id,
    recurringScheduleId: schedule._id,
  });

  const forecast = await getMonthlyExpensePrediction(userA, { month: "2026-11", now: NOW });
  assert.equal(forecast.knownRecurringPaise, 12_345);
});

test("confirmed subscription forecasts are separate and do not duplicate active recurring schedules", async () => {
  await seedMonthlyHistory();
  const baseline = await getMonthlyExpensePrediction(userA, { month: "2026-12", now: NOW });
  const payments = [];
  for (const month of MONTHS) {
    payments.push(await addExpense({
      amount: 5_000,
      month,
      day: 10,
      merchant: "StreamBox",
    }));
  }
  await Subscription.create({
    userId: userA._id,
    merchantName: "StreamBox",
    normalizedMerchant: "streambox",
    categoryId: food._id,
    averageAmountPaise: 5_000,
    lastPaymentDate: payments.at(-1).txnDate,
    estimatedNextPaymentDate: new Date("2026-12-10T00:00:00.000Z"),
    frequency: "monthly",
    confidenceScore: 90,
    confidenceLevel: "high",
    status: "confirmed",
    detectionEvidence: {
      transactionCount: payments.length,
      intervalsDays: [30, 31, 31, 30, 31],
      matchedIntervals: 5,
      intervalConsistencyPercent: 96,
      amountVariationPercent: 0,
      merchantIdentityConsistencyPercent: 100,
      averageIntervalDays: 31,
      payments: payments.map((payment) => ({
        transactionId: payment._id,
        paidAt: payment.txnDate,
        amountPaise: payment.amount,
      })),
      detectedAt: NOW,
    },
  });
  const subscriptionForecast = await getMonthlyExpensePrediction(userA, { month: "2026-12", now: NOW });
  assert.equal(subscriptionForecast.knownSubscriptionPaise, 5_000);
  assert.equal(subscriptionForecast.predictedAmountPaise, baseline.predictedAmountPaise + 5_000);

  await RecurringTransaction.create({
    userId: userA._id,
    name: "StreamBox",
    type: "expense",
    amount: 7_500,
    walletId: walletA._id,
    categoryId: food._id,
    frequency: "monthly",
    startDate: new Date("2026-10-10T00:00:00.000Z"),
    nextDueDate: new Date("2026-12-10T00:00:00.000Z"),
    status: "active",
  });
  const combined = await getMonthlyExpensePrediction(userA, { month: "2026-12", now: NOW });
  assert.equal(combined.knownSubscriptionPaise, 0);
  assert.equal(combined.knownRecurringPaise, 7_500);
  assert.equal(combined.predictedAmountPaise, baseline.predictedAmountPaise + 7_500);
});

test("insufficient data, zero spend, non-owner records, and unknown categories do not produce invented forecasts", async () => {
  const noHistory = await getExpensePredictionOverview(userA, { now: NOW });
  assert.equal(noHistory.currentMonth.status, "insufficient_data");
  assert.equal(noHistory.currentMonth.predictedAmountPaise, null);
  assert.equal(noHistory.nextMonth.expectedMonthEndPaise, null);

  const otherCategory = await Category.create({
    userId: userB._id,
    name: "Private category",
    type: "expense",
  });
  const invalid = await api(`/api/predictions/categories?month=2026-12&categoryId=${otherCategory._id}`);
  assert.equal(invalid.status, 400);
});

test("accuracy backtests only earlier periods, and APIs validate auth and query inputs", async () => {
  await seedMonthlyHistory();
  const accuracy = await getExpensePredictionAccuracy(userA, { months: 6, now: NOW });
  assert.equal(accuracy.status, "ok");
  assert.ok(accuracy.evaluatedPeriods > 0);
  assert.ok(Number.isInteger(accuracy.maePaise));
  assert.equal(accuracy.samples.some((item) => item.month === "2026-11"), false);
  assert.match(accuracy.methodology, /preceding its forecast month/);

  assert.equal((await api("/api/predictions/overview", { token: null })).status, 401);
  assert.equal((await api("/api/predictions/monthly?month=2026-13")).status, 400);
  assert.equal((await api("/api/predictions/monthly?month=2025-01")).status, 400);
  assert.equal((await api("/api/predictions/accuracy?months=2")).status, 400);
  assert.equal((await api("/api/predictions/overview")).status, 200);
  assert.equal((await api("/api/predictions/categories?month=2026-12")).status, 200);
  assert.equal((await api("/api/predictions/daily?month=2026-12")).status, 200);
  const otherUserOverview = await api("/api/predictions/overview", { token: tokenB });
  assert.equal(otherUserOverview.status, 200);
  assert.equal(otherUserOverview.json.data.status, "insufficient_data");
});

test("timezone-local month boundaries select the correct forecast period", async () => {
  const beforeKolkataMidnight = new Date("2026-11-30T18:29:59.000Z");
  const atKolkataMidnight = new Date("2026-11-30T18:30:00.000Z");
  const before = await getMonthlyExpensePrediction(userA, { now: beforeKolkataMidnight });
  const after = await getMonthlyExpensePrediction(userA, { now: atKolkataMidnight });
  assert.equal(before.forecastPeriod, "2026-11");
  assert.equal(after.forecastPeriod, "2026-12");
});

test("Ask Spart recognizes prediction questions and distinguishes forecast from actuals", async () => {
  await seedMonthlyHistory();
  assert.equal(identifyFinancialIntent("How much might I spend this month?").type, "prediction");
  assert.equal(identifyFinancialIntent("What will my food expenses be next month?").type, "prediction");
  const overall = await sendAskSpartMessage(userA, { message: "How much might I spend this month?" });
  assert.equal(overall.assistantMessage.metadata.intent, "prediction");
  assert.match(overall.message, /forecast, not recorded spending/i);
  assert.ok(overall.financialData.expectedMonthEndPaise > 0);

  const category = await sendAskSpartMessage(userA, { message: "What will my food expenses be next month?" });
  assert.equal(category.assistantMessage.metadata.intent, "prediction");
  assert.equal(category.financialData.category.name, "Food");
  assert.match(category.message, /forecast, not recorded spending/i);
});
