import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/smartspend_test_never_connect";
process.env.JWT_SECRET = "budget_test_secret_value_123456";
process.env.JWT_REFRESH_SECRET = "budget_test_refresh_secret_123456";

const [{ MongoMemoryServer }, mongooseModule, appModule, userModule, walletModule, categoryModule, transactionModule, budgetModule, tokenModule, dateModule] =
  await Promise.all([
    import("mongodb-memory-server"),
    import("mongoose"),
    import("../app.js"),
    import("../models/User.js"),
    import("../models/Wallet.js"),
    import("../models/Category.js"),
    import("../models/Transaction.js"),
    import("../models/Budget.js"),
    import("../utils/tokens.js"),
    import("../utils/dates.js"),
  ]);
const mongoose = mongooseModule.default;
const app = appModule.default;
const { User } = userModule;
const { Wallet } = walletModule;
const { Category } = categoryModule;
const { Transaction } = transactionModule;
const { Budget } = budgetModule;
const { signAccessToken } = tokenModule;
const { startOfLocalDate } = dateModule;

let mongo;
let server;
let base;
let userA;
let userB;
let walletA;
let walletB;
let categoryA;
let categoryB;
let tokenA;
let tokenB;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Wallet.init(), Category.init(), Transaction.init(), Budget.init()]);
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await Promise.all([
    Budget.deleteMany({}),
    Transaction.deleteMany({}),
    Category.deleteMany({}),
    Wallet.deleteMany({}),
    User.deleteMany({}),
  ]);
  [userA, userB] = await User.create([
    { name: "Budget A", email: "budget-a@example.com", passwordHash: "not-used", timezone: "Asia/Kolkata" },
    { name: "Budget B", email: "budget-b@example.com", passwordHash: "not-used", timezone: "Asia/Kolkata" },
  ]);
  [walletA, walletB] = await Wallet.create([
    { userId: userA._id, name: "Cash A", type: "cash" },
    { userId: userB._id, name: "Cash B", type: "cash" },
  ]);
  [categoryA, categoryB] = await Category.create([
    { userId: userA._id, name: "Food A", type: "expense" },
    { userId: userB._id, name: "Food B", type: "expense" },
  ]);
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

function monthlyBudget(overrides = {}) {
  return {
    name: "October food",
    amount: 100_000,
    categoryId: String(categoryA._id),
    period: "monthly",
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    ...overrides,
  };
}

async function createExpense({ userId = userA._id, walletId = walletA._id, categoryId = categoryA._id, type = "expense", amount, txnDate, status = "confirmed", deletedAt = null }) {
  return Transaction.create({
    userId,
    walletId,
    categoryId,
    type,
    amount,
    txnDate: new Date(txnDate),
    status,
    deletedAt,
  });
}

test("budget routes require authentication", async () => {
  const response = await call("GET", "/api/budgets", undefined, null);
  assert.equal(response.status, 401);
  assert.equal(response.json.error.code, "UNAUTHORIZED");
});

test("creates a valid budget with progress in integer paise", async () => {
  const response = await call("POST", "/api/budgets", monthlyBudget());
  assert.equal(response.status, 201);
  assert.equal(response.json.data.amount, 100_000);
  assert.equal(response.json.data.progress.budgetAmount, 100_000);
  assert.equal(response.json.data.progress.actualSpending, 0);
  assert.equal(response.json.data.progress.remainingAmount, 100_000);
});

test("rejects invalid amount and calendar dates", async () => {
  let response = await call("POST", "/api/budgets", monthlyBudget({ amount: 0 }));
  assert.equal(response.status, 400);
  response = await call("POST", "/api/budgets", monthlyBudget({ period: "daily" }));
  assert.equal(response.status, 400);
  response = await call("POST", "/api/budgets", monthlyBudget({ startDate: "2026-02-30", endDate: "2026-03-31" }));
  assert.equal(response.status, 400);
  response = await call("POST", "/api/budgets", monthlyBudget({ startDate: "2026-11-01" }));
  assert.equal(response.status, 400);
  assert.equal(response.json.error.code, "VALIDATION_ERROR");
});

test("rejects wrong period boundaries and strips unknown request fields", async () => {
  let response = await call("POST", "/api/budgets", monthlyBudget({ startDate: "2026-10-02", extra: true }));
  assert.equal(response.status, 400);
  response = await call("POST", "/api/budgets", monthlyBudget({ extra: true }));
  assert.equal(response.status, 201);
  assert.equal("extra" in response.json.data, false);
});

test("does not expose another user's budget", async () => {
  const created = await call("POST", "/api/budgets", monthlyBudget());
  const id = created.json.data._id;
  assert.equal((await call("GET", `/api/budgets/${id}`)).status, 200);
  assert.equal((await call("GET", `/api/budgets/${id}/progress`)).status, 200);
  const otherGet = await call("GET", `/api/budgets/${id}`, undefined, tokenB);
  const otherList = await call("GET", "/api/budgets", undefined, tokenB);
  assert.equal(otherGet.status, 404);
  assert.equal(otherList.json.data.length, 0);
  assert.equal((await call("GET", "/api/budgets/not-an-id")).status, 400);
});

test("updates a budget and archives it through DELETE", async () => {
  const created = await call("POST", "/api/budgets", monthlyBudget());
  const id = created.json.data._id;
  const updated = await call("PATCH", `/api/budgets/${id}`, { name: "Updated food", amount: 120_000 });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.data.name, "Updated food");
  assert.equal(updated.json.data.progress.budgetAmount, 120_000);

  const archived = await call("DELETE", `/api/budgets/${id}`);
  assert.equal(archived.status, 200);
  assert.equal(archived.json.data.status, "archived");
  assert.equal((await call("GET", "/api/budgets")).json.data.length, 0);
  assert.equal((await call("GET", "/api/budgets?includeArchived=true")).json.data.length, 1);
});

test("prevents overlapping active budgets for the same user, category, and period", async () => {
  const first = await call("POST", "/api/budgets", monthlyBudget());
  assert.equal(first.status, 201);
  const overlap = await call("POST", "/api/budgets", monthlyBudget({ name: "Duplicate", startDate: "2026-10-01", endDate: "2026-10-31" }));
  assert.equal(overlap.status, 409);
  const otherCategory = await call("POST", "/api/budgets", monthlyBudget({ categoryId: null }));
  assert.equal(otherCategory.status, 201);
});

test("creates the required budget indexes", async () => {
  const indexes = await Budget.collection.indexes();
  assert.ok(indexes.some((index) => index.unique && index.partialFilterExpression?.status === "active"));
  assert.ok(indexes.some((index) => index.key.userId === 1 && index.key.status === 1));
});

test("counts only this user's confirmed non-trashed expenses in the selected category", async () => {
  await call("POST", "/api/budgets", monthlyBudget());
  await createExpense({ amount: 80_000, txnDate: "2026-10-15T12:00:00Z" });
  await createExpense({ type: "income", amount: 20_000, txnDate: "2026-10-15T12:00:00Z" });
  await createExpense({ type: "transfer", amount: 30_000, txnDate: "2026-10-15T12:00:00Z" });
  await createExpense({ amount: 40_000, txnDate: "2026-10-15T12:00:00Z", deletedAt: new Date() });
  await createExpense({ amount: 50_000, txnDate: "2026-10-15T12:00:00Z", status: "pending_review" });
  await createExpense({ amount: 60_000, txnDate: "2026-10-15T12:00:00Z", categoryId: null });
  await createExpense({ amount: 70_000, txnDate: "2026-10-15T12:00:00Z", categoryId: categoryB._id, userId: userB._id, walletId: walletB._id });

  const response = await call("GET", "/api/budgets");
  const progress = response.json.data[0].progress;
  assert.equal(progress.actualSpending, 80_000);
  assert.equal(progress.transactionCount, 1);
  assert.equal(progress.remainingAmount, 20_000);
  assert.equal(progress.percentageUsed, 80);
  assert.equal(progress.percentageRemaining, 20);
  assert.equal(progress.isApproachingLimit, true);
  assert.equal(progress.isExceeded, false);
});

test("reports exceeded thresholds and budget summary", async () => {
  await call("POST", "/api/budgets", monthlyBudget());
  await createExpense({ amount: 110_000, txnDate: "2026-10-15T12:00:00Z" });
  const response = await call("GET", "/api/budgets/summary");
  const progress = response.json.data.budgets[0].progress;
  assert.equal(progress.remainingAmount, -10_000);
  assert.equal(progress.percentageUsed, 110);
  assert.equal(progress.percentageRemaining, 0);
  assert.equal(progress.isApproachingLimit, false);
  assert.equal(progress.isExceeded, true);
  assert.equal(response.json.data.summary.exceededCount, 1);
});

test("uses inclusive local calendar dates and an exclusive next-day boundary", async () => {
  await call("POST", "/api/budgets", monthlyBudget());
  await createExpense({ amount: 10, txnDate: "2026-09-30T18:29:59.999Z" });
  await createExpense({ amount: 20, txnDate: "2026-09-30T18:30:00.000Z" });
  await createExpense({ amount: 30, txnDate: "2026-10-31T18:29:59.999Z" });
  await createExpense({ amount: 40, txnDate: "2026-10-31T18:30:00.000Z" });
  const response = await call("GET", "/api/budgets");
  assert.equal(response.json.data[0].progress.actualSpending, 50);
  assert.equal(response.json.data[0].progress.periodStart, "2026-09-30T18:30:00.000Z");
  assert.equal(response.json.data[0].progress.periodEnd, "2026-10-31T18:30:00.000Z");
});

test("handles daylight-saving calendar days in the user's timezone", async () => {
  await User.updateOne({ _id: userA._id }, { timezone: "America/New_York" });
  await call("POST", "/api/budgets", {
    name: "DST day",
    amount: 100,
    categoryId: String(categoryA._id),
    period: "custom",
    startDate: "2026-03-08",
    endDate: "2026-03-08",
  });
  await createExpense({ amount: 25, txnDate: "2026-03-09T03:59:59.999Z" });
  await createExpense({ amount: 75, txnDate: "2026-03-09T04:00:00.000Z" });
  const progress = (await call("GET", "/api/budgets")).json.data[0].progress;
  assert.equal(progress.actualSpending, 25);
  assert.equal(progress.periodStart, "2026-03-08T05:00:00.000Z");
  assert.equal(progress.periodEnd, "2026-03-09T04:00:00.000Z");
  assert.equal(startOfLocalDate("Asia/Kolkata", new Date("2026-10-01T00:00:00Z")).toISOString(), "2026-09-30T18:30:00.000Z");
});
