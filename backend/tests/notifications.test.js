import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/smartspend_notifications_test_never_connect";
process.env.JWT_SECRET = "notification_test_secret_value_123456";
process.env.JWT_REFRESH_SECRET = "notification_refresh_secret_123456";

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
  anomalyModule,
  notificationModule,
  tokenModule,
  detectionModule,
  serviceModule,
  jobModule,
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
  import("../models/TransactionAnomaly.js"),
  import("../models/Notification.js"),
  import("../utils/tokens.js"),
  import("../services/notificationDetectionService.js"),
  import("../services/notificationService.js"),
  import("../jobs/notificationDetectionJob.js"),
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
const { TransactionAnomaly } = anomalyModule;
const { Notification } = notificationModule;
const { signAccessToken } = tokenModule;
const { detectUserNotifications, notifyRecurringJobFailures } = detectionModule;
const {
  createNotification,
  countUnreadNotifications,
  deleteAllNotifications,
} = serviceModule;
const { createNotificationDetectionJob } = jobModule;

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
    TransactionAnomaly.init(),
    Notification.init(),
  ]);
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await Promise.all([
    Notification.deleteMany({}),
    TransactionAnomaly.deleteMany({}),
    Subscription.deleteMany({}),
    RecurringTransaction.deleteMany({}),
    Goal.deleteMany({}),
    Budget.deleteMany({}),
    Transaction.deleteMany({}),
    Wallet.deleteMany({}),
    User.deleteMany({}),
  ]);
  [userA, userB] = await User.create([
    { name: "Notify A", email: "notify-a@example.com", passwordHash: "unused", timezone: "Asia/Kolkata" },
    { name: "Notify B", email: "notify-b@example.com", passwordHash: "unused", timezone: "Asia/Kolkata" },
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

async function api(path, { method = "GET", token = tokenA } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: response.status, json: await response.json() };
}

function dateOffset(now, days) {
  return new Date(now.getTime() + days * 86_400_000);
}

async function saveNotification({
  userId = userA._id,
  key = `test:${new mongoose.Types.ObjectId()}`,
  type = "budget_approaching",
  severity = "warning",
  createdAt,
  expiresAt,
} = {}) {
  return createNotification(userId, {
    type,
    title: "Budget update",
    message: "A test notification.",
    relatedEntityType: null,
    relatedEntityId: null,
    severity,
    deduplicationKey: key,
    metadata: {},
    ...(expiresAt ? { expiresAt } : {}),
  }, { now: createdAt });
}

test("notification creation is idempotent and expires after 90 days by default", async () => {
  const now = new Date("2026-11-05T00:00:00.000Z");
  const first = await saveNotification({ key: "budget:one:2026-11:80", createdAt: now });
  const duplicate = await saveNotification({ key: "budget:one:2026-11:80", createdAt: now });
  assert.ok(first);
  assert.equal(duplicate, null);
  assert.equal(await Notification.countDocuments({ userId: userA._id }), 1);
  assert.equal(first.expiresAt.toISOString(), "2027-02-03T00:00:00.000Z");
});

test("notification APIs enforce authentication, ownership, filters, pagination, read state and deletion", async () => {
  assert.equal((await api("/api/notifications", { token: null })).status, 401);
  const one = await saveNotification({ key: "budget:first" });
  const two = await saveNotification({ key: "anomaly:second", type: "anomaly_detected", severity: "critical" });
  await saveNotification({ userId: userB._id, key: "private:third" });

  const page = await api("/api/notifications?page=1&limit=1&isRead=false");
  assert.equal(page.status, 200);
  assert.equal(page.json.pagination.total, 2);
  assert.equal(page.json.data.length, 1);
  assert.equal((await api("/api/notifications?type=anomaly_detected&severity=critical")).json.pagination.total, 1);
  assert.equal((await api("/api/notifications?limit=101")).status, 400);
  assert.equal((await api("/api/notifications/not-an-id")).status, 400);
  assert.equal((await api(`/api/notifications/${one._id}`)).status, 200);
  assert.equal((await api(`/api/notifications/${one._id}`, { token: tokenB })).status, 404);
  assert.equal((await api("/api/notifications/unread-count")).json.data.count, 2);

  const marked = await api(`/api/notifications/${one._id}/read`, { method: "PATCH" });
  assert.equal(marked.status, 200);
  assert.equal(marked.json.data.isRead, true);
  assert.ok(marked.json.data.readAt);
  const readAll = await api("/api/notifications/read-all", { method: "PATCH" });
  assert.equal(readAll.json.data.modifiedCount, 1);
  assert.equal((await api("/api/notifications/unread-count")).json.data.count, 0);

  assert.equal((await api(`/api/notifications/${two._id}`, { method: "DELETE", token: tokenB })).status, 404);
  assert.equal((await api(`/api/notifications/${two._id}`, { method: "DELETE" })).json.data.deleted, true);
  assert.equal((await api("/api/notifications", { method: "DELETE" })).json.data.deletedCount, 1);
  assert.equal(await countUnreadNotifications(userA._id), 0);
  assert.equal((await deleteAllNotifications(userB._id)).deletedCount, 1);
});

test("expired notifications are omitted from reads and unread count", async () => {
  await saveNotification({
    key: "expired:one",
    expiresAt: new Date(Date.now() - 1_000),
  });
  assert.equal((await api("/api/notifications")).json.pagination.total, 0);
  assert.equal((await api("/api/notifications/unread-count")).json.data.count, 0);
});

test("detection creates budget, recurring, subscription, goal and anomaly alerts idempotently", async () => {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  await Transaction.create({
    userId: userA._id,
    walletId: walletA._id,
    type: "expense",
    amount: 8_500,
    txnDate: now,
    status: "confirmed",
    deletedAt: null,
  });
  await Transaction.create([
    {
      userId: userA._id,
      walletId: walletA._id,
      type: "expense",
      amount: 1_000_000,
      txnDate: now,
      status: "pending_review",
      deletedAt: null,
    },
    {
      userId: userA._id,
      walletId: walletA._id,
      type: "expense",
      amount: 1_000_000,
      txnDate: now,
      status: "confirmed",
      deletedAt: now,
    },
    {
      userId: userA._id,
      walletId: walletA._id,
      type: "transfer",
      amount: 1_000_000,
      txnDate: now,
      status: "confirmed",
      deletedAt: null,
    },
  ]);
  await Budget.create({
    userId: userA._id,
    name: "Dining",
    amount: 10_000,
    period: "custom",
    startDate: monthStart,
    endDate: dateOffset(today, 15),
    status: "active",
  });
  await RecurringTransaction.create({
    userId: userA._id,
    name: "Internet",
    type: "expense",
    amount: 3_000,
    walletId: walletA._id,
    frequency: "monthly",
    startDate: today,
    nextDueDate: dateOffset(today, 1),
    status: "active",
  });
  await Subscription.create({
    userId: userA._id,
    merchantName: "StreamBox",
    normalizedMerchant: "streambox",
    averageAmountPaise: 1_000,
    lastPaymentDate: dateOffset(today, -30),
    estimatedNextPaymentDate: dateOffset(today, 1),
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
      detectedAt: now,
    },
    status: "confirmed",
  });
  await Subscription.create({
    userId: userA._id,
    merchantName: "Newly Found",
    normalizedMerchant: "newly found",
    averageAmountPaise: 2_000,
    lastPaymentDate: dateOffset(today, -30),
    estimatedNextPaymentDate: dateOffset(today, 30),
    frequency: "monthly",
    confidenceScore: 80,
    confidenceLevel: "medium",
    detectionEvidence: {
      transactionCount: 3,
      intervalsDays: [30, 30],
      matchedIntervals: 2,
      intervalConsistencyPercent: 90,
      amountVariationPercent: 1,
      averageIntervalDays: 30,
      payments: [],
      detectedAt: now,
    },
    status: "detected",
    createdAt: dateOffset(now, -1),
  });
  await Goal.create([
    {
      userId: userA._id,
      name: "Travel",
      targetAmount: 10_000,
      savedAmount: 5_000,
      targetDate: dateOffset(today, 180),
      status: "active",
    },
    {
      userId: userA._id,
      name: "Laptop",
      targetAmount: 20_000,
      savedAmount: 20_000,
      targetDate: dateOffset(today, 180),
      status: "completed",
    },
  ]);
  const anomaly = await TransactionAnomaly.create({
    userId: userA._id,
    transactionId: new mongoose.Types.ObjectId(),
    anomalyType: "large_transaction",
    severity: "critical",
    score: 90,
    explanation: "Unusually large transaction.",
    suggestedAction: "Review this transaction.",
    evidence: {},
    detectionKey: "large:one",
    status: "new",
    detectedAt: now,
  });

  const first = await detectUserNotifications(userA, { now });
  const second = await detectUserNotifications(userA, { now });
  const rows = await Notification.find({ userId: userA._id }).lean();
  const types = new Set(rows.map((item) => item.type));
  assert.ok(types.has("budget_approaching"));
  assert.ok(!types.has("budget_exceeded"));
  assert.ok(types.has("recurring_upcoming"));
  assert.ok(types.has("subscription_upcoming"));
  assert.ok(types.has("subscription_detected"));
  assert.ok(types.has("goal_milestone"));
  assert.ok(types.has("goal_reached"));
  assert.ok(types.has("anomaly_detected"));
  assert.equal(rows.filter((item) => item.type === "anomaly_detected" && String(item.relatedEntityId) === String(anomaly._id)).length, 1);
  assert.equal(first.createdCount, rows.length);
  assert.equal(second.createdCount, 0);
  assert.equal(second.duplicateCount, second.evaluatedEvents);
});

test("budget overages generate an exceeded alert and significant monthly increases are thresholded", async () => {
  const now = new Date("2026-11-25T10:00:00.000Z");
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  await Transaction.create([
    {
      userId: userA._id,
      walletId: walletA._id,
      type: "expense",
      amount: 100_000,
      txnDate: new Date("2026-10-15T12:00:00.000Z"),
      status: "confirmed",
      deletedAt: null,
    },
    {
      userId: userA._id,
      walletId: walletA._id,
      type: "expense",
      amount: 250_000,
      txnDate: new Date("2026-11-15T12:00:00.000Z"),
      status: "confirmed",
      deletedAt: null,
    },
  ]);
  await Budget.create({
    userId: userA._id,
    name: "Travel",
    amount: 100_000,
    period: "custom",
    startDate: monthStart,
    endDate: dateOffset(today, 5),
    status: "active",
  });
  await detectUserNotifications(userA, { now });
  assert.equal(await Notification.countDocuments({ userId: userA._id, type: "budget_exceeded" }), 1);
  assert.equal(await Notification.countDocuments({ userId: userA._id, type: "spending_increase" }), 1);
});

test("matching recurring schedules take precedence over subscription renewal alerts", async () => {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  await RecurringTransaction.create({
    userId: userA._id,
    name: "StreamBox",
    type: "expense",
    amount: 1_000,
    walletId: walletA._id,
    frequency: "monthly",
    startDate: today,
    nextDueDate: dateOffset(today, 1),
    status: "active",
  });
  await Subscription.create({
    userId: userA._id,
    merchantName: "StreamBox",
    normalizedMerchant: "streambox",
    averageAmountPaise: 1_000,
    lastPaymentDate: dateOffset(today, -30),
    estimatedNextPaymentDate: dateOffset(today, 1),
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
      detectedAt: now,
    },
    status: "confirmed",
  });
  await detectUserNotifications(userA, { now });
  assert.equal(await Notification.countDocuments({ userId: userA._id, type: "recurring_upcoming" }), 0);
  assert.equal(await Notification.countDocuments({ userId: userA._id, type: "subscription_upcoming" }), 0);
});

test("subscription reminder dates use the configured local timezone", async () => {
  userA.timezone = "America/Los_Angeles";
  await userA.save();
  const now = new Date("2026-11-05T07:30:00.000Z");
  await Subscription.create({
    userId: userA._id,
    merchantName: "West Coast Service",
    normalizedMerchant: "west coast service",
    averageAmountPaise: 1_000,
    lastPaymentDate: new Date("2026-10-06T07:30:00.000Z"),
    estimatedNextPaymentDate: new Date("2026-11-06T00:00:00.000Z"),
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
      detectedAt: now,
    },
    status: "confirmed",
  });
  await detectUserNotifications(userA, { now });
  assert.equal(await Notification.countDocuments({
    userId: userA._id,
    type: "subscription_upcoming",
  }), 1);
});

test("failed recurring notification creation is contained and the background job is idempotent", async () => {
  await notifyRecurringJobFailures([{
    userId: userA._id,
    scheduleId: new mongoose.Types.ObjectId(),
    scheduleName: "Rent",
    dueDate: new Date("2026-11-05T00:00:00.000Z"),
    success: false,
    errorCode: "WALLET_UNAVAILABLE",
  }]);
  assert.equal(await Notification.countDocuments({ userId: userA._id, type: "recurring_failed" }), 1);

  let failures = 0;
  const result = await notifyRecurringJobFailures([{
    userId: userA._id,
    scheduleId: new mongoose.Types.ObjectId(),
    scheduleName: "Rent",
    dueDate: new Date(),
    success: false,
    errorCode: "WALLET_UNAVAILABLE",
  }], {
    notify: async () => { throw new Error("storage unavailable"); },
    onFailure: () => { failures += 1; },
  });
  assert.equal(result.failures, 1);
  assert.equal(failures, 1);

  let calls = 0;
  let release;
  const job = createNotificationDetectionJob({
    detectBatch: async ({ afterUserId }) => {
      calls += 1;
      await new Promise((resolve) => { release = resolve; });
      return { nextAfterUserId: "507f1f77bcf86cd799439011", afterUserId };
    },
  });
  const running = job.run();
  assert.equal(await job.run(), null);
  release();
  await running;
  job.stop();
  assert.equal(calls, 1);
});
