import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/smartspend_dashboard_test_never_connect";
process.env.JWT_SECRET = "dashboard_test_secret_value_123456";
process.env.JWT_REFRESH_SECRET = "dashboard_test_refresh_secret_value_123456";

const [
  { MongoMemoryServer },
  mongooseModule,
  appModule,
  userModule,
  walletModule,
  categoryModule,
  transactionModule,
  tokenModule,
  datesModule,
] = await Promise.all([
  import("mongodb-memory-server"),
  import("mongoose"),
  import("../app.js"),
  import("../models/User.js"),
  import("../models/Wallet.js"),
  import("../models/Category.js"),
  import("../models/Transaction.js"),
  import("../utils/tokens.js"),
  import("../utils/dates.js"),
]);

const mongoose = mongooseModule.default;
const app = appModule.default;
const { User } = userModule;
const { Wallet } = walletModule;
const { Category } = categoryModule;
const { Transaction } = transactionModule;
const { signAccessToken } = tokenModule;
const { startOfLocalDate, startOfMonth } = datesModule;

let mongo;
let server;
let base;
let user;
let wallet;
let token;
let categories;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Wallet.init(), Category.init(), Transaction.init()]);
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await Promise.all([
    Transaction.deleteMany({}),
    Category.deleteMany({}),
    Wallet.deleteMany({}),
    User.deleteMany({}),
  ]);
  user = await User.create({
    name: "Dashboard Tester",
    email: "dashboard@example.com",
    passwordHash: "not-used",
    timezone: "Asia/Kolkata",
  });
  wallet = await Wallet.create({ userId: user._id, name: "Cash", type: "cash" });
  categories = await Category.create(
    ["Education", "Food", "Travel", "Utilities", "Health", "Shopping", "Salary"].map((name) => ({
      name,
      type: name === "Salary" ? "income" : "expense",
    })),
  );
  token = signAccessToken(user._id);
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

async function getDashboard(date) {
  const query = date ? `?date=${date}` : "";
  const response = await fetch(`${base}/api/dashboard${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: response.status, json: await response.json() };
}

async function createTransaction({ type = "expense", categoryId, amount, merchant = "", note = "", txnDate = new Date() }) {
  return Transaction.create({
    userId: user._id,
    walletId: wallet._id,
    type,
    categoryId,
    amount,
    merchant,
    note,
    txnDate,
  });
}

test("dashboard returns every expense category and actual monthly expense rows", async () => {
  const now = Date.now();
  await createTransaction({
    categoryId: categories[0]._id,
    amount: 1_500,
    merchant: "Buying books",
    txnDate: new Date(now),
  });
  await createTransaction({
    categoryId: categories[0]._id,
    amount: 500,
    txnDate: new Date(now - 60_000),
  });
  for (let index = 1; index < 6; index += 1) {
    await createTransaction({
      categoryId: categories[index]._id,
      amount: (index + 1) * 100,
      txnDate: new Date(now - index * 120_000),
    });
  }
  await createTransaction({
    type: "income",
    categoryId: categories[6]._id,
    amount: 50_000,
    merchant: "Salary",
    txnDate: new Date(now),
  });

  const response = await getDashboard();
  assert.equal(response.status, 200);
  const data = response.json.data;
  assert.equal(data.monthSpent, 4_000);
  assert.equal(data.topCategories.reduce((sum, category) => sum + category.total, 0), data.monthSpent);
  assert.equal(data.monthIncome, 50_000);
  assert.equal(data.topCategories.length, 6);

  const education = data.topCategories.find(({ name }) => name === "Education");
  assert.equal(education.total, 2_000);
  assert.equal(education.count, 2);
  assert.equal(data.topCategories.some(({ name }) => name === "Salary"), false);
  assert.equal(data.monthExpenses.length, 5);
  assert.equal(data.monthExpenses[0].merchant, "Buying books");
  assert.equal(data.monthExpenses[0].categoryId.name, "Education");
  assert.equal(data.monthExpenses[0].walletId.name, "Cash");
  assert.equal(data.monthExpenses.every(({ type }) => type === "expense"), true);
});

test("dashboard monthly totals, categories and expense rows share timezone-correct boundaries", async () => {
  const now = new Date();
  const monthStart = startOfMonth(user.timezone, now);
  const monthEnd = startOfMonth(user.timezone, now, 1);
  await createTransaction({
    categoryId: categories[0]._id,
    amount: 100,
    merchant: "Previous month",
    txnDate: new Date(monthStart.getTime() - 1),
  });
  await createTransaction({
    categoryId: categories[0]._id,
    amount: 200,
    merchant: "Month start",
    txnDate: monthStart,
  });
  await createTransaction({
    categoryId: categories[1]._id,
    amount: 300,
    merchant: "Month end",
    txnDate: new Date(monthEnd.getTime() - 1),
  });
  await createTransaction({
    categoryId: categories[1]._id,
    amount: 400,
    merchant: "Next month",
    txnDate: monthEnd,
  });
  await createTransaction({
    type: "income",
    categoryId: categories[6]._id,
    amount: 50_000,
    txnDate: new Date(),
  });

  const response = await getDashboard();
  assert.equal(response.status, 200);
  const data = response.json.data;
  assert.equal(data.monthSpent, 500);
  assert.equal(data.topCategories.reduce((sum, category) => sum + category.total, 0), 500);
  assert.deepEqual(
    data.monthExpenses.map(({ merchant }) => merchant).sort(),
    ["Month end", "Month start"],
  );
  assert.equal(data.monthExpenses.reduce((sum, transaction) => sum + transaction.amount, 0), 500);
  assert.equal(data.monthExpenses.every(({ type }) => type === "expense"), true);
  assert.equal(data.monthIncome, 50_000);
});

test("dashboard returns empty monthly expense and category lists at zero spend", async () => {
  const response = await getDashboard();
  assert.equal(response.status, 200);
  assert.equal(response.json.data.monthSpent, 0);
  assert.deepEqual(response.json.data.topCategories, []);
  assert.deepEqual(response.json.data.monthExpenses, []);
});

test("dashboard filters selected dates and leap-month totals using the user's timezone", async () => {
  const monthStart = startOfLocalDate("Asia/Kolkata", new Date("2024-02-01T00:00:00.000Z"));
  const selectedStart = startOfLocalDate("Asia/Kolkata", new Date("2024-02-29T00:00:00.000Z"));
  const selectedEnd = startOfLocalDate("Asia/Kolkata", new Date("2024-03-01T00:00:00.000Z"));
  await createTransaction({
    categoryId: categories[0]._id,
    amount: 100,
    merchant: "Before selected day",
    txnDate: new Date(monthStart.getTime() - 1),
  });
  await createTransaction({
    categoryId: categories[0]._id,
    amount: 200,
    merchant: "Selected day",
    txnDate: selectedStart,
  });
  await createTransaction({
    categoryId: categories[1]._id,
    amount: 300,
    merchant: "End of selected day",
    txnDate: new Date(selectedEnd.getTime() - 1),
  });
  await createTransaction({
    categoryId: categories[1]._id,
    amount: 400,
    merchant: "March",
    txnDate: selectedEnd,
  });

  const response = await getDashboard("2024-02-29");
  assert.equal(response.status, 200);
  assert.equal(response.json.data.period.selectedDate, "2024-02-29");
  assert.equal(response.json.data.selectedDateSpent, 500);
  assert.equal(response.json.data.monthSpent, 500);
  assert.deepEqual(
    response.json.data.monthExpenses.map(({ merchant }) => merchant).sort(),
    ["End of selected day", "Selected day"],
  );
});

test("dashboard rejects invalid calendar dates", async () => {
  const response = await getDashboard("2024-02-30");
  assert.equal(response.status, 400);
});
