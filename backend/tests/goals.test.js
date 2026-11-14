import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/smartspend_goals_test_never_connect";
process.env.JWT_SECRET = "goal_test_secret_value_123456";
process.env.JWT_REFRESH_SECRET = "goal_test_refresh_secret_123456";

const [
  { MongoMemoryReplSet },
  mongooseModule,
  appModule,
  userModule,
  walletModule,
  goalModule,
  contributionModule,
  tokenModule,
  balanceModule,
  goalServiceModule,
] = await Promise.all([
  import("mongodb-memory-server"),
  import("mongoose"),
  import("../app.js"),
  import("../models/User.js"),
  import("../models/Wallet.js"),
  import("../models/Goal.js"),
  import("../models/GoalContribution.js"),
  import("../utils/tokens.js"),
  import("../services/balanceService.js"),
  import("../services/goalService.js"),
]);

const mongoose = mongooseModule.default;
const app = appModule.default;
const { User } = userModule;
const { Wallet } = walletModule;
const { Goal } = goalModule;
const { GoalContribution } = contributionModule;
const { signAccessToken } = tokenModule;
const { listWalletsWithBalance } = balanceModule;
const { getGoalProgress } = goalServiceModule;

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
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Wallet.init(), Goal.init(), GoalContribution.init()]);
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await Promise.all([
    GoalContribution.deleteMany({}),
    Goal.deleteMany({}),
    Wallet.deleteMany({}),
    User.deleteMany({}),
  ]);
  [userA, userB] = await User.create([
    { name: "Goal A", email: "goal-a@example.com", passwordHash: "not-used", timezone: "Asia/Kolkata" },
    { name: "Goal B", email: "goal-b@example.com", passwordHash: "not-used", timezone: "Asia/Kolkata" },
  ]);
  [walletA, walletB] = await Wallet.create([
    { userId: userA._id, name: "Goal wallet A", type: "cash", openingBalance: 500_000 },
    { userId: userB._id, name: "Goal wallet B", type: "cash" },
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

function goalBody(overrides = {}) {
  return {
    name: "Emergency fund",
    description: "Save consistently",
    targetAmount: 100_000,
    targetDate: "2027-12-31",
    walletId: String(walletA._id),
    ...overrides,
  };
}

async function createGoal(overrides) {
  const response = await call("POST", "/api/goals", goalBody(overrides));
  assert.equal(response.status, 201, JSON.stringify(response.json));
  return response.json.data;
}

test("goal routes require authentication", async () => {
  const response = await call("GET", "/api/goals", undefined, null);
  assert.equal(response.status, 401);
  assert.equal(response.json.error.code, "UNAUTHORIZED");
});

test("creates a goal with integer-paise amounts and persists it", async () => {
  const created = await createGoal();
  assert.equal(created.targetAmount, 100_000);
  assert.equal(created.savedAmount, 0);
  assert.equal(created.status, "active");
  assert.equal(created.progress.remainingAmount, 100_000);
  assert.equal(created.progress.percentageComplete, 0);
  const stored = await Goal.findById(created._id).lean();
  assert.equal(stored.userId.toString(), userA._id.toString());
});

test("rejects invalid target amounts and calendar dates", async () => {
  let response = await call("POST", "/api/goals", goalBody({ targetAmount: 0 }));
  assert.equal(response.status, 400);
  response = await call("POST", "/api/goals", goalBody({ targetAmount: 50.5 }));
  assert.equal(response.status, 400);
  response = await call("POST", "/api/goals", goalBody({ targetDate: "2027-02-30" }));
  assert.equal(response.status, 400);
});

test("rejects unknown fields and wallet references owned by another user", async () => {
  let response = await call("POST", "/api/goals", goalBody({ unknownField: true }));
  assert.equal(response.status, 201);
  assert.equal("unknownField" in response.json.data, false);
  response = await call("POST", "/api/goals", goalBody({ walletId: String(walletB._id) }));
  assert.equal(response.status, 400);
});

test("does not allow access to another user's goals or contribution history", async () => {
  const goal = await createGoal();
  assert.equal((await call("GET", `/api/goals/${goal._id}`, undefined, tokenB)).status, 404);
  assert.equal((await call("PATCH", `/api/goals/${goal._id}`, { name: "stolen" }, tokenB)).status, 404);
  assert.equal((await call("POST", `/api/goals/${goal._id}/contributions`, { amount: 1 }, tokenB)).status, 404);
  assert.equal((await call("GET", `/api/goals/${goal._id}/contributions`, undefined, tokenB)).status, 404);
  assert.equal((await call("GET", "/api/goals", undefined, tokenB)).json.data.length, 0);
});

test("updates goal fields without allowing saved amount or status changes", async () => {
  const goal = await createGoal();
  const response = await call("PATCH", `/api/goals/${goal._id}`, {
    name: "Home deposit",
    description: "Updated plan",
    targetAmount: 150_000,
    savedAmount: 149_000,
    status: "completed",
  });
  assert.equal(response.status, 200);
  assert.equal(response.json.data.name, "Home deposit");
  assert.equal(response.json.data.targetAmount, 150_000);
  assert.equal(response.json.data.savedAmount, 0);
  assert.equal(response.json.data.status, "active");
});

test("records contribution amount, date, and note in goal history", async () => {
  const goal = await createGoal();
  const response = await call("POST", `/api/goals/${goal._id}/contributions`, {
    amount: 25_000,
    contributionDate: "2026-11-03",
    note: "Monthly savings",
  });
  assert.equal(response.status, 201);
  assert.equal(response.json.data.contribution.amount, 25_000);
  assert.equal(response.json.data.contribution.type, "contribution");
  assert.equal(response.json.data.contribution.note, "Monthly savings");
  assert.equal(response.json.data.goal.savedAmount, 25_000);

  const history = await call("GET", `/api/goals/${goal._id}/contributions`);
  assert.equal(history.json.data.length, 1);
  assert.equal(history.json.data[0].contributionDate, "2026-11-03T00:00:00.000Z");
  assert.equal((await GoalContribution.countDocuments({ userId: userA._id, goalId: goal._id })).toString(), "1");
});

test("rejects invalid contribution amounts and overfunding", async () => {
  const goal = await createGoal();
  let response = await call("POST", `/api/goals/${goal._id}/contributions`, { amount: -1 });
  assert.equal(response.status, 400);
  response = await call("POST", `/api/goals/${goal._id}/contributions`, { amount: 1, contributionDate: "2026-02-30" });
  assert.equal(response.status, 400);
  response = await call("POST", `/api/goals/${goal._id}/contributions`, { amount: 1, note: "x".repeat(301) });
  assert.equal(response.status, 400);
  response = await call("POST", `/api/goals/${goal._id}/contributions`, { amount: 100_001 });
  assert.equal(response.status, 400);
  assert.equal((await Goal.findById(goal._id)).savedAmount, 0);
  assert.equal(await GoalContribution.countDocuments({ goalId: goal._id }), 0);
});

test("marks a goal complete at target and prevents additional contributions", async () => {
  const goal = await createGoal();
  const response = await call("POST", `/api/goals/${goal._id}/contributions`, { amount: 100_000 });
  assert.equal(response.json.data.goal.status, "completed");
  assert.equal(response.json.data.goal.progress.percentageComplete, 100);
  assert.equal(response.json.data.goal.progress.isCompleted, true);
  const extra = await call("POST", `/api/goals/${goal._id}/contributions`, { amount: 1 });
  assert.equal(extra.status, 400);
});

test("withdrawals are ledger entries, can reopen a completed goal, and cannot go below zero", async () => {
  const goal = await createGoal();
  await call("POST", `/api/goals/${goal._id}/contributions`, { amount: 100_000 });
  const result = await call("POST", `/api/goals/${goal._id}/withdrawals`, { amount: 30_000, note: "Emergency" });
  assert.equal(result.status, 201);
  assert.equal(result.json.data.contribution.type, "withdrawal");
  assert.equal(result.json.data.goal.savedAmount, 70_000);
  assert.equal(result.json.data.goal.status, "active");

  const invalid = await call("POST", `/api/goals/${goal._id}/withdrawals`, { amount: 70_001 });
  assert.equal(invalid.status, 400);
  assert.equal((await Goal.findById(goal._id)).savedAmount, 70_000);
  const history = await call("GET", `/api/goals/${goal._id}/contributions`);
  assert.equal(history.json.data.length, 2);

  const wallets = await listWalletsWithBalance(userA._id);
  assert.equal(wallets[0].balance, 500_000, "goal ledger must not change wallet balance");
});

test("pauses and resumes goals, blocking changes while paused", async () => {
  const goal = await createGoal();
  assert.equal((await call("PATCH", `/api/goals/${goal._id}/pause`)).json.data.status, "paused");
  assert.equal((await call("POST", `/api/goals/${goal._id}/contributions`, { amount: 1 })).status, 400);
  assert.equal((await call("POST", `/api/goals/${goal._id}/withdrawals`, { amount: 1 })).status, 400);
  assert.equal((await call("PATCH", `/api/goals/${goal._id}/resume`)).json.data.status, "active");
});

test("archives goals and filters list results by status", async () => {
  const goal = await createGoal();
  const archived = await call("DELETE", `/api/goals/${goal._id}`);
  assert.equal(archived.json.data.status, "archived");
  assert.equal((await call("GET", "/api/goals")).json.data.length, 0);
  assert.equal((await call("GET", "/api/goals?includeArchived=true")).json.data.length, 1);
  assert.equal((await call("GET", "/api/goals?status=archived")).json.data.length, 1);
});

test("returns a savings summary for non-archived goals", async () => {
  await createGoal({ targetAmount: 100_000 });
  const second = await createGoal({ name: "Travel", targetAmount: 200_000, walletId: null });
  await call("POST", `/api/goals/${second._id}/contributions`, { amount: 50_000 });
  const summary = await call("GET", "/api/goals/summary");
  assert.equal(summary.json.data.summary.goalCount, 2);
  assert.equal(summary.json.data.summary.activeCount, 2);
  assert.equal(summary.json.data.summary.totalTargetAmount, 300_000);
  assert.equal(summary.json.data.summary.totalSavedAmount, 50_000);
  assert.equal(summary.json.data.summary.totalRemainingAmount, 250_000);
});

test("calculates progress, required monthly savings, and timezone calendar days", async () => {
  const now = new Date();
  const todayParts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  const target = new Date(
    Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day + 60)
  );
  const targetDate = target.toISOString().slice(0, 10);
  const targetParts = {
    year: target.getUTCFullYear(),
    month: target.getUTCMonth() + 1,
    day: target.getUTCDate(),
  };
  const monthsRemaining =
    (targetParts.year - todayParts.year) * 12 +
    targetParts.month -
    todayParts.month +
    (targetParts.day >= todayParts.day ? 1 : 0);

  const goal = await createGoal({
    targetAmount: 100_000,
    targetDate,
    walletId: null,
  });
  await call("POST", `/api/goals/${goal._id}/contributions`, { amount: 25_000 });
  const progress = (await call("GET", `/api/goals/${goal._id}/progress`)).json.data.progress;
  assert.equal(progress.remainingAmount, 75_000);
  assert.equal(progress.percentageComplete, 25);
  assert.equal(progress.isCompleted, false);
  assert.ok(progress.daysRemaining >= 55);
  assert.equal(progress.requiredMonthlySavings, Math.ceil(75_000 / monthsRemaining));
});

test("interprets target dates as calendar dates in timezones west of UTC", () => {
  const progress = getGoalProgress(
    { targetAmount: 100, savedAmount: 0, targetDate: new Date("2026-11-05T00:00:00.000Z") },
    new Date("2026-11-04T17:00:00.000Z"),
    "America/New_York"
  );
  assert.equal(progress.daysRemaining, 1);
});

test("serializes concurrent contributions without losing ledger entries", async () => {
  const goal = await createGoal({ targetAmount: 100_000 });
  const results = await Promise.all([
    call("POST", `/api/goals/${goal._id}/contributions`, { amount: 40_000 }),
    call("POST", `/api/goals/${goal._id}/contributions`, { amount: 60_000 }),
  ]);
  assert.deepEqual(results.map((result) => result.status), [201, 201]);
  const stored = await Goal.findById(goal._id).lean();
  assert.equal(stored.savedAmount, 100_000);
  assert.equal(stored.status, "completed");
  assert.equal(await GoalContribution.countDocuments({ userId: userA._id, goalId: goal._id }), 2);
});

test("creates goal and contribution indexes", async () => {
  const goalIndexes = await Goal.collection.indexes();
  const contributionIndexes = await GoalContribution.collection.indexes();
  assert.ok(goalIndexes.some((index) => index.key.userId === 1 && index.key.status === 1));
  assert.ok(goalIndexes.some((index) => index.key.userId === 1 && index.key.walletId === 1));
  assert.ok(contributionIndexes.some((index) => index.key.userId === 1 && index.key.goalId === 1));
});
