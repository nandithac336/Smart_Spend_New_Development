import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { MongoBinary, MongoMemoryServer } from "mongodb-memory-server";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/smartspend_analytics_test_never_connect";
process.env.JWT_SECRET = "analytics_test_secret_value_123456";
process.env.JWT_REFRESH_SECRET = "analytics_test_refresh_secret_123456";

await MongoBinary.getPath();

const [
  mongooseModule,
  appModule,
  userModule,
  walletModule,
  categoryModule,
  transactionModule,
  budgetModule,
  goalModule,
  tokenModule,
  analyticsModule,
] = await Promise.all([
  import("mongoose"),
  import("../app.js"),
  import("../models/User.js"),
  import("../models/Wallet.js"),
  import("../models/Category.js"),
  import("../models/Transaction.js"),
  import("../models/Budget.js"),
  import("../models/Goal.js"),
  import("../utils/tokens.js"),
  import("../services/analyticsService.js"),
]);

const mongoose = mongooseModule.default;
const app = appModule.default;
const { User } = userModule;
const { Wallet } = walletModule;
const { Category } = categoryModule;
const { Transaction } = transactionModule;
const { Budget } = budgetModule;
const { Goal } = goalModule;
const { signAccessToken } = tokenModule;
const { resolveAnalyticsWindow } = analyticsModule;

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
  await Promise.all([User.init(), Wallet.init(), Category.init(), Transaction.init(), Budget.init(), Goal.init()]);
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await Promise.all([
    Transaction.deleteMany({}),
    Budget.deleteMany({}),
    Goal.deleteMany({}),
    Category.deleteMany({}),
    Wallet.deleteMany({}),
    User.deleteMany({}),
  ]);
  [userA, userB] = await User.create([
    { name: "Analytics A", email: "analytics-a@example.com", passwordHash: "unused", timezone: "Asia/Kolkata" },
    { name: "Analytics B", email: "analytics-b@example.com", passwordHash: "unused", timezone: "America/New_York" },
  ]);
  [walletA, walletB] = await Wallet.create([
    { userId: userA._id, name: "Cash", type: "cash", openingBalance: 10_000 },
    { userId: userA._id, name: "Bank", type: "bank" },
  ]);
  [categoryA, categoryB] = await Category.create([
    { userId: userA._id, name: "Food", type: "expense" },
    { userId: userA._id, name: "Salary", type: "income" },
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
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    text: await response.text(),
  };
}

async function jsonCall(method, path, token = tokenA) {
  const response = await call(method, path, undefined, token);
  return { ...response, json: JSON.parse(response.text) };
}

async function txn({
  userId = userA._id,
  walletId = walletA._id,
  categoryId = categoryA._id,
  type = "expense",
  amount,
  txnDate = "2026-11-04T12:00:00.000Z",
  status = "confirmed",
  deletedAt = null,
  merchant = "Cafe",
  note,
  transferDirection,
} = {}) {
  return Transaction.create({ userId, walletId, categoryId, type, amount, txnDate: new Date(txnDate), status, deletedAt, merchant, merchantKey: merchant.toLowerCase(), note, transferDirection });
}

test("analytics routes require authentication and reject malformed filters", async () => {
  assert.equal((await jsonCall("GET", "/api/analytics/summary", null)).status, 401);
  assert.equal((await jsonCall("GET", "/api/analytics/summary?startDate=2026-02-30")).status, 400);
  assert.equal((await jsonCall("GET", "/api/analytics/summary?startDate=2026-11-02")).status, 400);
  assert.equal((await jsonCall("GET", "/api/analytics/summary?timezone=Not_A_Timezone")).status, 400);
  assert.equal((await jsonCall("GET", "/api/analytics/summary?walletId=0123456789abcdef01234567", tokenA)).json.error.code, "VALIDATION_ERROR");
});

test("summarizes income, expense, net savings, savings rate and excludes transfers, trash and other users", async () => {
  await txn({ amount: 10_000, type: "expense", merchant: "Cafe" });
  await txn({ amount: 20_000, type: "income", categoryId: categoryB._id, merchant: "Salary" });
  await txn({ amount: 30_000, type: "expense", type: "transfer", merchant: "Transfer" });
  await txn({ amount: 500_000, status: "pending_review", merchant: "Pending" });
  await txn({ amount: 700_000, deletedAt: new Date(), merchant: "Trash" });
  await txn({ amount: 900_000, userId: userB._id, walletId: userB._id, merchant: "Foreign" });
  const response = await jsonCall("GET", "/api/analytics/summary?startDate=2026-11-01&endDate=2026-11-30");
  assert.equal(response.status, 200);
  assert.equal(response.json.data.income, 20_000);
  assert.equal(response.json.data.expense, 10_000);
  assert.equal(response.json.data.netSavings, 10_000);
  assert.equal(response.json.data.savingsRate, 50);
  assert.equal(response.json.data.transactionCount, 2);
});

test("returns category and wallet breakdowns, category comparison, and spending patterns", async () => {
  await txn({ amount: 2_000, merchant: "Alpha" });
  await txn({ amount: 3_000, merchant: "Alpha" });
  await txn({ amount: 5_000, merchant: "Beta", txnDate: "2026-11-03T19:00:00.000Z" });
  await txn({ amount: 4_000, type: "income", categoryId: categoryB._id, merchant: "Salary" });
  const categories = await jsonCall("GET", "/api/analytics/categories?startDate=2026-11-01&endDate=2026-11-30");
  assert.equal(categories.json.data.total, 10_000);
  assert.equal(categories.json.data.categories[0].name, "Food");
  assert.equal(categories.json.data.highest.total, 10_000);
  assert.equal(categories.json.data.lowest.percentage, 100);

  const wallets = await jsonCall("GET", "/api/analytics/wallets?startDate=2026-11-01&endDate=2026-11-30");
  assert.equal(wallets.json.data.wallets.length, 1);
  assert.equal(wallets.json.data.wallets[0].expense, 10_000);
  assert.equal(wallets.json.data.wallets[0].income, 4_000);
  assert.equal(wallets.json.data.wallets[0].balance, 4_000);

  const daily = await jsonCall("GET", "/api/analytics/daily?startDate=2026-11-01&endDate=2026-11-04");
  assert.equal(daily.json.data.data.length, 4);
  assert.equal(daily.json.data.total, 10_000);
  assert.equal(daily.json.data.transactionCount, 3);
  assert.equal(daily.json.data.highestSpendingDay.amount, 10_000);
  assert.equal(daily.json.data.lowestSpendingDay.amount, 10_000);

  const merchants = await jsonCall("GET", "/api/analytics/merchants?startDate=2026-11-01&endDate=2026-11-30");
  assert.equal(merchants.json.data.merchants[0].merchant, "Alpha");
  assert.equal(merchants.json.data.merchants[0].total, 5_000);

  const comparison = await jsonCall("GET", "/api/analytics/categories/comparison?period=month");
  assert.equal(comparison.status, 200);
  assert.equal(comparison.json.data.categories.length, 1);
});

test("compares calendar periods and handles a zero previous period without division", async () => {
  await txn({ amount: 7_000, txnDate: "2026-11-04T12:00:00.000Z" });
  const comparison = await jsonCall("GET", "/api/analytics/comparison?period=month");
  assert.equal(comparison.status, 200);
  const expense = comparison.json.data.metrics.expense;
  assert.equal(expense.current, 7_000);
  assert.equal(expense.previous, 0);
  assert.equal(expense.percentageChange, null);
  assert.equal(comparison.json.data.previousPeriod.startDate, "2026-10-01");
  assert.equal(comparison.json.data.currentPeriod.startDate, "2026-11-01");
});

test("compares weekly and yearly calendar periods and returns monthly trends", async (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: new Date("2026-11-04T12:00:00.000Z"),
  });
  await txn({ amount: 8_000, txnDate: "2026-11-04T12:00:00.000Z" });
  const weekly = await jsonCall("GET", "/api/analytics/comparison?period=week");
  assert.equal(weekly.json.data.currentPeriod.startDate, "2026-11-02");
  assert.equal(weekly.json.data.previousPeriod.startDate, "2026-10-26");
  const yearly = await jsonCall("GET", "/api/analytics/comparison?period=year");
  assert.equal(yearly.json.data.currentPeriod.startDate, "2026-01-01");
  assert.equal(yearly.json.data.previousPeriod.startDate, "2025-01-01");
  const monthly = await jsonCall("GET", "/api/analytics/monthly?startDate=2026-10-01&endDate=2026-11-30");
  assert.deepEqual(monthly.json.data.data.map((item) => item.date), ["2026-11-01"]);
});

test("compares arbitrary custom date ranges and rejects incomplete ranges", async () => {
  await txn({ amount: 7_000, txnDate: "2026-11-04T12:00:00.000Z" });
  await txn({ amount: 3_000, txnDate: "2026-10-04T12:00:00.000Z" });
  const response = await jsonCall(
    "GET",
    "/api/analytics/comparison?period=custom&startDate=2026-11-01&endDate=2026-11-04&compareStartDate=2026-10-01&compareEndDate=2026-10-04"
  );
  assert.equal(response.status, 200);
  assert.equal(response.json.data.metrics.expense.current, 7_000);
  assert.equal(response.json.data.metrics.expense.previous, 3_000);
  assert.equal(response.json.data.metrics.expense.percentageChange, 133.33);
  assert.equal((await jsonCall("GET", "/api/analytics/comparison?period=custom")).status, 400);
});

test("uses timezone-correct local period boundaries", () => {
  const window = resolveAnalyticsWindow(
    { startDate: new Date("2026-11-05T00:00:00.000Z"), endDate: new Date("2026-11-05T00:00:00.000Z"), timezone: "Asia/Kolkata" },
    userA
  );
  assert.equal(window.start.toISOString(), "2026-11-04T18:30:00.000Z");
  assert.equal(window.end.toISOString(), "2026-11-05T18:30:00.000Z");
});

test("validates category and wallet filters against the authenticated user", async () => {
  const foreignCategory = await Category.create({ userId: userB._id, name: "Private category", type: "expense" });
  const foreignWallet = await Wallet.create({ userId: userB._id, name: "Private wallet", type: "cash" });
  assert.equal((await jsonCall("GET", `/api/analytics/summary?categoryId=${foreignCategory._id}`)).status, 400);
  assert.equal((await jsonCall("GET", `/api/analytics/wallets?walletId=${foreignWallet._id}`)).status, 400);

  await txn({ amount: 1_000, categoryId: foreignCategory._id, walletId: foreignWallet._id });
  const categories = await jsonCall("GET", "/api/analytics/categories?startDate=2026-11-01&endDate=2026-11-30");
  assert.equal(categories.json.data.categories[0].name, "Uncategorized");
  const wallets = await jsonCall("GET", "/api/analytics/wallets?startDate=2026-11-01&endDate=2026-11-30");
  assert.equal(wallets.json.data.wallets[0].name, "Wallet");
  const exportResult = await call("GET", "/api/export/transactions/csv?startDate=2026-11-01&endDate=2026-11-30");
  assert.equal(exportResult.text.includes("Private category"), false);
  assert.equal(exportResult.text.includes("Private wallet"), false);
  const injectedUserId = await jsonCall(
    "GET",
    `/api/analytics/summary?startDate=2026-11-01&endDate=2026-11-30&userId=${userB._id}`
  );
  assert.equal(injectedUserId.json.data.expense, 1_000);
});

test("returns budget utilization and goal savings analytics without treating goals as transactions", async () => {
  await Budget.create({
    userId: userA._id,
    name: "November food",
    amount: 20_000,
    categoryId: categoryA._id,
    period: "monthly",
    startDate: new Date("2026-11-01T00:00:00.000Z"),
    endDate: new Date("2026-11-30T00:00:00.000Z"),
  });
  await Goal.create({
    userId: userA._id,
    name: "Emergency",
    targetAmount: 50_000,
    savedAmount: 10_000,
    targetDate: new Date("2027-01-01T00:00:00.000Z"),
  });
  await txn({ amount: 10_000 });
  const budget = await jsonCall("GET", "/api/analytics/budgets");
  assert.equal(budget.json.data.budgets[0].progress.percentageUsed, 50);
  const savings = await jsonCall("GET", "/api/analytics/savings");
  assert.equal(savings.json.data.summary.totalSavedAmount, 10_000);
  const summary = await jsonCall("GET", "/api/analytics/summary?startDate=2026-11-01&endDate=2026-11-30");
  assert.equal(summary.json.data.income, 0);
  assert.equal(summary.json.data.expense, 10_000);
});

test("streams escaped CSV with formula injection protection and user-owned filters", async () => {
  await txn({ amount: 12_345, merchant: '=HYPERLINK("https://bad.example")', note: "+1+1" });
  await txn({ amount: 5_000, type: "income", categoryId: categoryB._id, merchant: "Salary" });
  await txn({ amount: 2_000, type: "transfer", transferDirection: "out", merchant: "To bank" });
  await txn({ amount: 1_000, status: "pending_review", merchant: "Pending review" });
  await txn({ amount: 50_000, deletedAt: new Date(), merchant: "Trashed" });
  await txn({ amount: 99_000, userId: userB._id, walletId: walletB._id, merchant: "Private user transaction" });
  const csv = await call("GET", "/api/export/transactions/csv?startDate=2026-11-01&endDate=2026-11-30");
  assert.equal(csv.status, 200);
  assert.match(csv.contentType, /text\/csv/);
  assert.match(csv.text, /"'=HYPERLINK\(""https:\/\/bad\.example""\)"/);
  assert.ok(csv.text.includes(`"'+1+1"`));
  assert.match(csv.text, /₹123\.45/);
  assert.match(csv.text, /"transfer","confirmed","out"/);
  assert.match(csv.text, /"expense","pending_review"/);
  assert.equal(csv.text.includes("Private user transaction"), false);
  assert.equal(csv.text.includes("Trashed"), false);
  const income = await call("GET", "/api/export/transactions/csv?type=income&startDate=2026-11-01&endDate=2026-11-30");
  assert.equal(income.text.split("\r\n").filter(Boolean).length, 2);
  const category = await call("GET", `/api/export/transactions/csv?categoryId=${categoryA._id}&startDate=2026-11-01&endDate=2026-11-30`);
  assert.equal(category.text.includes("Salary"), false);
  const unauthenticated = await call("GET", "/api/export/transactions/csv", undefined, null);
  assert.equal(unauthenticated.status, 401);
});

test("generates a downloadable PDF report and handles empty data", async () => {
  const response = await call("GET", "/api/export/transactions/pdf?startDate=2026-11-01&endDate=2026-11-30");
  assert.equal(response.status, 200);
  assert.match(response.contentType, /application\/pdf/);
  assert.equal(response.text.startsWith("%PDF"), true);
  assert.ok(response.text.length > 500);

  await txn({ amount: 24_500, merchant: "Actual database transaction" });
  const populated = await call("GET", "/api/export/transactions/pdf?startDate=2026-11-01&endDate=2026-11-30");
  assert.equal(populated.status, 200);
  assert.equal(populated.text.startsWith("%PDF"), true);
  assert.ok(populated.text.length > response.text.length);
});

test("streams exports larger than one database cursor batch", async () => {
  const rows = Array.from({ length: 520 }, (_, index) => ({
    userId: userA._id,
    walletId: walletA._id,
    categoryId: categoryA._id,
    type: "expense",
    amount: index + 1,
    merchant: `Merchant ${index}`,
    merchantKey: `merchant ${index}`,
    txnDate: new Date("2026-11-04T12:00:00.000Z"),
    status: "confirmed",
    deletedAt: null,
  }));
  await Transaction.insertMany(rows);
  const response = await call("GET", "/api/export/transactions/csv?startDate=2026-11-01&endDate=2026-11-30");
  assert.equal(response.status, 200);
  assert.equal(response.text.split("\r\n").filter(Boolean).length, 521);
});
