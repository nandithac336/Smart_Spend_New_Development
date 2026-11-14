import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/smartspend_recurring_test_never_connect";
process.env.JWT_SECRET = "recurring_test_secret_value_123456";
process.env.JWT_REFRESH_SECRET = "recurring_test_refresh_secret_123456";

const [
  { MongoMemoryReplSet },
  mongooseModule,
  appModule,
  userModule,
  walletModule,
  categoryModule,
  transactionModule,
  recurringModule,
  tokenModule,
  serviceModule,
] = await Promise.all([
  import("mongodb-memory-server"),
  import("mongoose"),
  import("../app.js"),
  import("../models/User.js"),
  import("../models/Wallet.js"),
  import("../models/Category.js"),
  import("../models/Transaction.js"),
  import("../models/RecurringTransaction.js"),
  import("../utils/tokens.js"),
  import("../services/recurringTransactionService.js"),
]);

const mongoose = mongooseModule.default;
const app = appModule.default;
const { User } = userModule;
const { Wallet } = walletModule;
const { Category } = categoryModule;
const { Transaction } = transactionModule;
const { RecurringTransaction } = recurringModule;
const { signAccessToken } = tokenModule;
const { calculateNextDueDate, getCalendarDateForTimeZone, processDueRecurringTransactions } = serviceModule;

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
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Wallet.init(),
    Category.init(),
    Transaction.init(),
    RecurringTransaction.init(),
  ]);
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await Promise.all([
    Transaction.deleteMany({}),
    RecurringTransaction.deleteMany({}),
    Category.deleteMany({}),
    Wallet.deleteMany({}),
    User.deleteMany({}),
  ]);
  [userA, userB] = await User.create([
    { name: "Recurring A", email: "recurring-a@example.com", passwordHash: "not-used", timezone: "Asia/Kolkata" },
    { name: "Recurring B", email: "recurring-b@example.com", passwordHash: "not-used", timezone: "America/New_York" },
  ]);
  [walletA, walletB] = await Wallet.create([
    { userId: userA._id, name: "Recurring wallet A", type: "cash" },
    { userId: userB._id, name: "Recurring wallet B", type: "bank" },
  ]);
  categoryA = await Category.create({ userId: userA._id, name: "Bills", type: "expense" });
  tokenA = signAccessToken(userA._id);
  tokenB = signAccessToken(userB._id);
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

async function call(method, path, body, token = tokenA) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

function scheduleBody(overrides = {}) {
  return {
    name: "Monthly rent",
    type: "expense",
    amount: 125_000,
    walletId: String(walletA._id),
    categoryId: String(categoryA._id),
    description: "Apartment rent",
    frequency: "monthly",
    startDate: "2026-11-05",
    ...overrides,
  };
}

async function createSchedule(overrides = {}) {
  const response = await call("POST", "/api/recurring", scheduleBody(overrides));
  assert.equal(response.status, 201, JSON.stringify(response.json));
  return response.json.data;
}

test("recurring routes require authentication and validate schedule input", async () => {
  assert.equal((await call("GET", "/api/recurring", undefined, null)).status, 401);
  assert.equal((await call("POST", "/api/recurring", scheduleBody({ amount: 0 }))).status, 400);
  assert.equal((await call("POST", "/api/recurring", scheduleBody({ amount: 1.5 }))).status, 400);
  assert.equal((await call("POST", "/api/recurring", scheduleBody({ frequency: "biweekly" }))).status, 400);
  assert.equal((await call("POST", "/api/recurring", scheduleBody({ startDate: "2026-02-30" }))).status, 400);
  assert.equal((await call("POST", "/api/recurring", scheduleBody({ startDate: "2026-12-01", endDate: "2026-11-30" }))).status, 400);
});

test("creates a schedule with paise amounts and validates wallet and category ownership", async () => {
  const schedule = await createSchedule();
  assert.equal(schedule.amount, 125_000);
  assert.equal(schedule.status, "active");
  assert.equal(schedule.nextDueDate, "2026-11-05T00:00:00.000Z");
  assert.equal((await call("POST", "/api/recurring", scheduleBody({ walletId: String(walletB._id) }))).status, 400);
  const wrongTypeCategory = await Category.create({ userId: userA._id, name: "Salary", type: "income" });
  assert.equal(
    (await call("POST", "/api/recurring", scheduleBody({ categoryId: String(wrongTypeCategory._id) }))).status,
    400
  );
});

test("lists and reads only the authenticated user's schedules", async () => {
  const schedule = await createSchedule();
  assert.equal((await call("GET", `/api/recurring/${schedule._id}`, undefined, tokenB)).status, 404);
  assert.equal((await call("PATCH", `/api/recurring/${schedule._id}`, { name: "Other" }, tokenB)).status, 404);
  assert.equal((await call("GET", "/api/recurring", undefined, tokenB)).json.data.length, 0);
});

test("updates schedule fields and supports pause, resume, cancellation, and delete-as-cancel", async () => {
  const schedule = await createSchedule();
  const updated = await call("PATCH", `/api/recurring/${schedule._id}`, {
    name: "Updated rent",
    amount: 130_000,
    frequency: "yearly",
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.data.name, "Updated rent");
  assert.equal(updated.json.data.amount, 130_000);
  assert.equal(updated.json.data.frequency, "yearly");

  assert.equal((await call("PATCH", `/api/recurring/${schedule._id}/pause`)).json.data.status, "paused");
  assert.equal((await call("PATCH", `/api/recurring/${schedule._id}/resume`)).json.data.status, "active");
  assert.equal((await call("PATCH", `/api/recurring/${schedule._id}/cancel`)).json.data.status, "cancelled");
  assert.equal((await call("DELETE", `/api/recurring/${schedule._id}`)).json.data.status, "cancelled");
});

test("resuming skips missed dates but keeps an occurrence due today", async () => {
  const today = getCalendarDateForTimeZone(new Date(), userA.timezone);
  const start = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
  const schedule = await RecurringTransaction.create({
    ...scheduleBody({ categoryId: null, frequency: "daily" }),
    userId: userA._id,
    startDate: start,
    nextDueDate: start,
    status: "paused",
  });
  const resumed = await call("PATCH", `/api/recurring/${schedule._id}/resume`);
  assert.equal(resumed.json.data.status, "active");
  assert.equal(resumed.json.data.nextDueDate, today.toISOString());
  const result = await processDueRecurringTransactions({ now: new Date() });
  assert.equal(result.find((item) => item.scheduleId.toString() === schedule._id.toString()).generated, 1);
});

test("calculates daily, weekly, monthly, and yearly dates without month-end drift", () => {
  assert.equal(calculateNextDueDate("daily", new Date("2026-11-05Z")).toISOString(), "2026-11-06T00:00:00.000Z");
  assert.equal(calculateNextDueDate("weekly", new Date("2026-11-05Z")).toISOString(), "2026-11-12T00:00:00.000Z");
  const jan31 = new Date("2026-01-31T00:00:00.000Z");
  const feb = calculateNextDueDate("monthly", jan31, jan31);
  assert.equal(feb.toISOString(), "2026-02-28T00:00:00.000Z");
  assert.equal(calculateNextDueDate("monthly", feb, jan31).toISOString(), "2026-03-31T00:00:00.000Z");
  assert.equal(
    calculateNextDueDate("yearly", new Date("2024-02-29T00:00:00.000Z"), new Date("2024-02-29T00:00:00.000Z")).toISOString(),
    "2025-02-28T00:00:00.000Z"
  );
});

test("does not generate before a user's local calendar day starts", async () => {
  const schedule = await createSchedule({ frequency: "daily" });
  const beforeMidnight = await processDueRecurringTransactions({ now: new Date("2026-11-04T18:29:00.000Z") });
  assert.equal(beforeMidnight[0].generated, 0);
  const atMidnight = await processDueRecurringTransactions({ now: new Date("2026-11-04T18:30:00.000Z") });
  assert.equal(atMidnight[0].generated, 1);
  const transaction = await Transaction.findOne({ recurringScheduleId: schedule._id }).lean();
  assert.equal(transaction.txnDate.toISOString(), "2026-11-04T18:30:00.000Z");
  assert.equal(transaction.source, "recurring");
  assert.equal(transaction.status, "confirmed");
});

test("generates expense and income transactions, then advances and completes an end-dated schedule", async () => {
  const expense = await createSchedule({
    frequency: "daily",
    startDate: "2026-11-05",
    endDate: "2026-11-05",
  });
  const income = await createSchedule({
    name: "Salary",
    type: "income",
    categoryId: null,
    frequency: "weekly",
    startDate: "2026-11-05",
  });
  const result = await processDueRecurringTransactions({ now: new Date("2026-11-05T05:00:00.000Z") });
  assert.equal(result.every((item) => item.success), true);
  assert.equal(await Transaction.countDocuments({ recurringScheduleId: expense._id, type: "expense" }), 1);
  assert.equal(await Transaction.countDocuments({ recurringScheduleId: income._id, type: "income" }), 1);
  assert.equal((await RecurringTransaction.findById(expense._id)).status, "completed");
  assert.equal((await RecurringTransaction.findById(income._id)).status, "active");
});

test("retries failed schedules after their invalid wallet reference is corrected", async () => {
  const schedule = await RecurringTransaction.create({
    ...scheduleBody({ categoryId: null }),
    userId: userA._id,
    walletId: walletB._id,
    startDate: new Date("2026-11-05T00:00:00.000Z"),
    nextDueDate: new Date("2026-11-05T00:00:00.000Z"),
  });
  const failed = await processDueRecurringTransactions({ now: new Date("2026-11-05T05:00:00.000Z") });
  assert.equal(failed[0].success, false);
  await RecurringTransaction.updateOne({ _id: schedule._id }, { walletId: walletA._id });
  const retried = await processDueRecurringTransactions({ now: new Date("2026-11-05T05:01:00.000Z") });
  assert.equal(retried[0].success, true);
  assert.equal(retried[0].generated, 1);
});

test("processing twice and concurrently does not create duplicate transactions", async () => {
  const schedule = await createSchedule({ frequency: "daily" });
  const now = new Date("2026-11-05T05:00:00.000Z");
  await Promise.all([
    processDueRecurringTransactions({ now }),
    processDueRecurringTransactions({ now }),
  ]);
  await processDueRecurringTransactions({ now });
  assert.equal(await Transaction.countDocuments({ recurringScheduleId: schedule._id }), 1);
});

test("history is scoped to the owning schedule and upcoming results are user-specific", async () => {
  const schedule = await createSchedule({ frequency: "daily" });
  await processDueRecurringTransactions({ now: new Date("2026-11-05T05:00:00.000Z") });
  const history = await call("GET", `/api/recurring/${schedule._id}/history`);
  assert.equal(history.status, 200);
  assert.equal(history.json.data.length, 1);
  assert.equal((await call("GET", `/api/recurring/${schedule._id}/history`, undefined, tokenB)).status, 404);
  assert.equal((await call("GET", "/api/recurring/upcoming", undefined, tokenB)).json.data.length, 0);
});

test("creates due-date, ownership, and transaction history indexes", async () => {
  const scheduleIndexes = await RecurringTransaction.collection.indexes();
  const transactionIndexes = await Transaction.collection.indexes();
  assert.ok(scheduleIndexes.some((index) => index.key.status === 1 && index.key.nextDueDate === 1));
  assert.ok(scheduleIndexes.some((index) => index.key.userId === 1 && index.key.status === 1));
  assert.ok(transactionIndexes.some((index) => index.key.userId === 1 && index.key.recurringScheduleId === 1));
});
