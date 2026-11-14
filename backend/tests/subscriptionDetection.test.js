import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/smartspend_subscription_test_never_connect";
process.env.JWT_SECRET = "subscription_test_secret_value_123456";
process.env.JWT_REFRESH_SECRET = "subscription_test_refresh_secret_123456";

const [
  { MongoMemoryServer },
  mongooseModule,
  appModule,
  userModule,
  walletModule,
  categoryModule,
  transactionModule,
  subscriptionModule,
  tokenModule,
  patternModule,
] = await Promise.all([
  import("mongodb-memory-server"),
  import("mongoose"),
  import("../app.js"),
  import("../models/User.js"),
  import("../models/Wallet.js"),
  import("../models/Category.js"),
  import("../models/Transaction.js"),
  import("../models/Subscription.js"),
  import("../utils/tokens.js"),
  import("../services/subscriptionPatternService.js"),
]);

const mongoose = mongooseModule.default;
const app = appModule.default;
const { User } = userModule;
const { Wallet } = walletModule;
const { Category } = categoryModule;
const { Transaction } = transactionModule;
const { Subscription } = subscriptionModule;
const { signAccessToken } = tokenModule;
const { detectSubscriptionPatterns } = patternModule;

const DAY_MS = 86_400_000;
let mongo;
let server;
let base;
let userA;
let userB;
let walletA;
let walletB;
let categoryA;
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
    Subscription.init(),
  ]);
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await Promise.all([
    Subscription.deleteMany({}),
    Transaction.deleteMany({}),
    Category.deleteMany({}),
    Wallet.deleteMany({}),
    User.deleteMany({}),
  ]);
  [userA, userB] = await User.create([
    { name: "Subscription A", email: "subscription-a@example.com", passwordHash: "unused", timezone: "Asia/Kolkata" },
    { name: "Subscription B", email: "subscription-b@example.com", passwordHash: "unused", timezone: "Asia/Kolkata" },
  ]);
  [walletA, walletB] = await Wallet.create([
    { userId: userA._id, name: "Main", type: "bank" },
    { userId: userB._id, name: "Other", type: "cash" },
  ]);
  categoryA = await Category.create({ userId: userA._id, name: "Entertainment", type: "expense" });
  tokenA = signAccessToken(userA._id);
  tokenB = signAccessToken(userB._id);
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

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

function pattern(merchant, frequencyDays, { count = 4, amounts = [], start = new Date("2025-01-01T12:00:00.000Z") } = {}) {
  return Array.from({ length: count }, (_value, index) => ({
    _id: `${merchant}-${start.toISOString()}-${index}`,
    merchant,
    amount: amounts[index] ?? 2_500,
    categoryId: null,
    txnDate: new Date(start.getTime() + index * frequencyDays * DAY_MS),
  }));
}

async function addPayment({
  user = userA,
  wallet = walletA,
  merchant = "StreamBox",
  amount = 5_000,
  txnDate = new Date(Date.now() - DAY_MS),
  categoryId = categoryA._id,
  source = "manual",
  deletedAt = null,
  status = "confirmed",
}) {
  return Transaction.create({
    userId: user._id,
    walletId: wallet._id,
    type: "expense",
    amount,
    merchant,
    merchantKey: merchant.toLowerCase(),
    categoryId,
    txnDate,
    source,
    status,
    deletedAt,
  });
}

function subscriptionDocument(overrides = {}) {
  const now = new Date();
  return {
    userId: userA._id,
    merchantName: "StreamBox",
    normalizedMerchant: "streambox",
    categoryId: categoryA._id,
    averageAmountPaise: 5_000,
    lastPaymentDate: new Date(now.getTime() - 30 * DAY_MS),
    estimatedNextPaymentDate: new Date(now.getTime() + 5 * DAY_MS),
    frequency: "monthly",
    confidenceScore: 82,
    confidenceLevel: "medium",
    detectionEvidence: {
      transactionCount: 3,
      intervalsDays: [30, 30],
      matchedIntervals: 2,
      intervalConsistencyPercent: 98,
      amountVariationPercent: 0,
      merchantIdentityConsistencyPercent: 100,
      averageIntervalDays: 30,
      payments: [],
      detectedAt: now,
    },
    status: "confirmed",
    ...overrides,
  };
}

test("detects weekly, monthly, quarterly, annual, and moderately variable payment patterns", () => {
  for (const [days, frequency] of [[7, "weekly"], [30, "monthly"], [91, "quarterly"], [365, "annual"]]) {
    const result = detectSubscriptionPatterns(pattern("Stream Box", days));
    assert.equal(result.patterns[0].frequency, frequency);
    assert.ok(result.patterns[0].confidenceScore >= 0 && result.patterns[0].confidenceScore <= 100);
    assert.equal(result.patterns[0].detectionEvidence.merchantIdentityConsistencyPercent, 100);
    if (frequency === "monthly") assert.equal(result.patterns[0].confidenceScore, 91);
  }
  const variable = detectSubscriptionPatterns(pattern("StreamBox", 30, {
    amounts: [5_000, 5_500, 6_000, 6_500],
  })).patterns[0];
  assert.equal(variable.frequency, "monthly");
  assert.ok(variable.detectionEvidence.amountVariationPercent < 25);
  assert.ok(variable.averageAmountPaise > 5_000);
  const normalized = detectSubscriptionPatterns(pattern("Raju Tea Stall!", 30)).patterns[0];
  assert.equal(normalized.normalizedMerchant, "raju tea stall");
  assert.equal(normalized.confidenceLevel, "high");
  const lowConfidence = detectSubscriptionPatterns(pattern("Variable Merchant", 30, {
    count: 2,
    amounts: [1_000, 10_000],
  })).patterns[0];
  assert.equal(lowConfidence.confidenceLevel, "low");
});

test("rejects one-time and inconsistent payments and keeps similar merchant names distinct", () => {
  const oneTime = detectSubscriptionPatterns(pattern("Single Merchant", 30, { count: 1 }));
  assert.equal(oneTime.patterns.length, 0);
  assert.equal(oneTime.insufficientEvidenceCount, 1);

  const inconsistent = detectSubscriptionPatterns([
    ...pattern("Irregular Merchant", 7, { count: 2 }),
    ...pattern("Irregular Merchant", 30, { count: 1, start: new Date("2025-02-01T12:00:00.000Z") }),
  ]);
  assert.equal(inconsistent.patterns.length, 0);
  assert.equal(inconsistent.inconsistentPatternCount, 1);

  const separate = detectSubscriptionPatterns([
    ...pattern("Music Plus", 30, { count: 2 }),
    ...pattern("Music Plus Family", 30, { count: 2, start: new Date("2025-01-02T12:00:00.000Z") }),
  ]);
  assert.equal(separate.patterns.length, 2);
  assert.deepEqual(separate.patterns.map((item) => item.normalizedMerchant).sort(), [
    "music plus",
    "music plus family",
  ]);
});

test("detection is authenticated, bounded, idempotent and only uses confirmed non-recurring expenses", async () => {
  assert.equal((await api("/api/subscriptions/detect", { method: "POST", token: null, body: {} })).status, 401);
  assert.equal((await api("/api/subscriptions/detect", { method: "POST", body: { limit: 5_001 } })).status, 400);
  assert.equal((await api("/api/subscriptions/detect", {
    method: "POST",
    body: { startDate: "2020-01-01", endDate: "2026-01-01" },
  })).status, 400);

  const now = new Date();
  for (const daysAgo of [61, 31, 1]) {
    await addPayment({ txnDate: new Date(now.getTime() - daysAgo * DAY_MS) });
  }
  await addPayment({ merchant: "One-time Shop", txnDate: new Date(now.getTime() - DAY_MS) });
  await addPayment({ merchant: "StreamBox", status: "pending_review", txnDate: new Date(now.getTime() - DAY_MS) });
  await addPayment({ merchant: "StreamBox", deletedAt: now, txnDate: new Date(now.getTime() - DAY_MS) });
  await addPayment({ merchant: "StreamBox", source: "recurring", txnDate: new Date(now.getTime() - DAY_MS) });
  await addPayment({ user: userB, wallet: walletB, merchant: "StreamBox", txnDate: new Date(now.getTime() - DAY_MS) });

  const first = await api("/api/subscriptions/detect", { method: "POST", body: {} });
  assert.equal(first.status, 200, JSON.stringify(first.json));
  assert.equal(first.json.data.subscriptions.length, 1);
  assert.equal(first.json.data.detectedCount, 1);
  assert.equal(first.json.data.subscriptions[0].frequency, "monthly");
  assert.equal(first.json.data.subscriptions[0].detectionEvidence.transactionCount, 3);

  const partial = await api("/api/subscriptions/detect", {
    method: "POST",
    body: {
      startDate: new Date(now.getTime() - 40 * DAY_MS).toISOString().slice(0, 10),
      endDate: now.toISOString().slice(0, 10),
    },
  });
  assert.equal(partial.status, 200);
  assert.equal(partial.json.data.subscriptions[0].detectionEvidence.transactionCount, 3);
  const repeated = await api("/api/subscriptions/detect", { method: "POST", body: {} });
  assert.equal(repeated.json.data.subscriptions.length, 1);
  assert.equal(await Subscription.countDocuments({ userId: userA._id }), 1);
  assert.equal(await Subscription.countDocuments({ userId: userB._id }), 0);
});

test("subscription detection is rate limited per authenticated user", async () => {
  for (let request = 0; request < 10; request += 1) {
    const response = await api("/api/subscriptions/detect", { method: "POST", body: {} });
    assert.equal(response.status, 200);
  }
  const limited = await api("/api/subscriptions/detect", { method: "POST", body: {} });
  assert.equal(limited.status, 429);
});

test("subscription review, edits, history, pagination and cross-user ownership are enforced", async () => {
  const now = new Date();
  for (const merchant of ["StreamBox", "Music Club", "News Daily"]) {
    for (const daysAgo of [61, 31, 1]) {
      await addPayment({ merchant, txnDate: new Date(now.getTime() - daysAgo * DAY_MS) });
    }
  }
  const detected = await api("/api/subscriptions/detect", { method: "POST", body: {} });
  assert.equal(detected.status, 200);
  const subscriptions = detected.json.data.subscriptions;
  assert.equal(subscriptions.length, 3);
  const stream = subscriptions.find((item) => item.merchantName === "StreamBox");
  const other = await api(`/api/subscriptions/${stream._id}`, { token: tokenB });
  assert.equal(other.status, 404);
  assert.equal((await api("/api/subscriptions/not-an-id")).status, 400);
  const detail = await api(`/api/subscriptions/${stream._id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.json.data.detectionEvidence.payments, undefined);

  const updated = await api(`/api/subscriptions/${stream._id}`, {
    method: "PATCH",
    body: { merchantName: "StreamBox Premium", averageAmountPaise: 7_000, categoryId: String(categoryA._id) },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.data.normalizedMerchant, "streambox premium");
  assert.equal(updated.json.data.averageAmountPaise, 7_000);
  assert.equal((await api(`/api/subscriptions/${stream._id}`, {
    method: "PATCH",
    body: { categoryId: String((await Category.create({
      userId: userB._id,
      name: "Private",
      type: "expense",
    }))._id) },
  })).status, 400);

  assert.equal((await api(`/api/subscriptions/${stream._id}/confirm`, { method: "PATCH" })).status, 200);
  assert.equal((await api(`/api/subscriptions/${stream._id}/dismiss`, { method: "PATCH" })).status, 409);
  assert.equal((await api(`/api/subscriptions/${stream._id}/confirm`, { method: "PATCH", token: tokenB })).status, 404);

  const history = await api(`/api/subscriptions/${stream._id}/history?limit=2`);
  assert.equal(history.status, 200);
  assert.equal(history.json.data.length, 2);
  assert.equal(history.json.pagination.total, 3);
  const listing = await api("/api/subscriptions?status=detected&page=1&limit=1");
  assert.equal(listing.json.pagination.total, 2);
  assert.equal(listing.json.data.length, 1);
  assert.equal(listing.json.data[0].detectionEvidence.payments, undefined);
  const merchantFilter = await api("/api/subscriptions?merchant=Music%20Club&frequency=monthly&confidenceLevel=high");
  assert.equal(merchantFilter.json.pagination.total, 1);
  assert.equal((await api(`/api/subscriptions/${subscriptions[1]._id}/dismiss`, { method: "PATCH" })).status, 200);
  assert.equal((await api(`/api/subscriptions/${subscriptions[2]._id}/cancel`, { method: "PATCH" })).status, 200);
});

test("summary converts frequencies to paise costs and separates detected from confirmed and upcoming payments", async () => {
  const now = new Date();
  await Subscription.create([
    subscriptionDocument({ merchantName: "Weekly", normalizedMerchant: "weekly", frequency: "weekly", averageAmountPaise: 1_000 }),
    subscriptionDocument({ merchantName: "Monthly", normalizedMerchant: "monthly", frequency: "monthly", averageAmountPaise: 2_000 }),
    subscriptionDocument({ merchantName: "Quarterly", normalizedMerchant: "quarterly", frequency: "quarterly", averageAmountPaise: 3_000 }),
    subscriptionDocument({ merchantName: "Annual", normalizedMerchant: "annual", frequency: "annual", averageAmountPaise: 12_000 }),
    subscriptionDocument({
      merchantName: "Review Me",
      normalizedMerchant: "review me",
      status: "detected",
      averageAmountPaise: 50_000,
    }),
    subscriptionDocument({
      merchantName: "Cancelled",
      normalizedMerchant: "cancelled",
      status: "cancelled",
      averageAmountPaise: 99_000,
    }),
  ]);

  const response = await api("/api/subscriptions/summary");
  assert.equal(response.status, 200);
  const summary = response.json.data;
  assert.equal(summary.activeConfirmedSubscriptions, 4);
  assert.equal(summary.detectedSubscriptionCount, 1);
  assert.equal(summary.estimatedMonthlyCostPaise, 8_333);
  assert.equal(summary.estimatedAnnualCostPaise, 100_000);
  assert.equal(summary.detected.monthlyCostPaise, 50_000);
  assert.equal(summary.confirmed.byMerchant.length, 4);
  assert.equal(summary.confirmed.byCategory[0].categoryName, "Entertainment");
  assert.equal(summary.upcomingPayments.length, 5);
  assert.match(summary.upcomingPayments[0].expectedPaymentDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal((await api("/api/analytics/subscriptions")).status, 200);
});
