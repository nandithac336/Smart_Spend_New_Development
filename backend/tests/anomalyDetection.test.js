import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/smartspend_anomaly_test_never_connect";
process.env.JWT_SECRET = "anomaly_test_secret_value_123456";
process.env.JWT_REFRESH_SECRET = "anomaly_test_refresh_secret_123456";

const [
  { MongoMemoryServer },
  mongooseModule,
  appModule,
  userModule,
  walletModule,
  transactionModule,
  anomalyModule,
  tokenModule,
  rulesModule,
  balanceModule,
] = await Promise.all([
  import("mongodb-memory-server"),
  import("mongoose"),
  import("../app.js"),
  import("../models/User.js"),
  import("../models/Wallet.js"),
  import("../models/Transaction.js"),
  import("../models/TransactionAnomaly.js"),
  import("../utils/tokens.js"),
  import("../services/anomalyRulesService.js"),
  import("../services/balanceService.js"),
]);

const mongoose = mongooseModule.default;
const app = appModule.default;
const { User } = userModule;
const { Wallet } = walletModule;
const { Transaction } = transactionModule;
const { TransactionAnomaly } = anomalyModule;
const { signAccessToken } = tokenModule;
const { detectTransactionAnomalies } = rulesModule;
const { getWalletDeltas } = balanceModule;

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
  await Promise.all([User.init(), Wallet.init(), Transaction.init(), TransactionAnomaly.init()]);
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await Promise.all([
    TransactionAnomaly.deleteMany({}),
    Transaction.deleteMany({}),
    Wallet.deleteMany({}),
    User.deleteMany({}),
  ]);
  [userA, userB] = await User.create([
    { name: "Anomaly A", email: "anomaly-a@example.com", passwordHash: "unused" },
    { name: "Anomaly B", email: "anomaly-b@example.com", passwordHash: "unused" },
  ]);
  [walletA, walletB] = await Wallet.create([
    { userId: userA._id, name: "Bank", type: "bank" },
    { userId: userB._id, name: "Bank", type: "bank" },
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

async function addTransaction({
  userId = userA._id,
  walletId = walletA._id,
  amount = 1_000,
  type = "expense",
  merchant = "Known Store",
  merchantKey = merchant.toLowerCase(),
  categoryId,
  txnDate = "2026-11-04T12:00:00.000Z",
  status = "confirmed",
  deletedAt = null,
} = {}) {
  return Transaction.create({
    userId,
    walletId,
    amount,
    type,
    merchant,
    merchantKey,
    categoryId: categoryId || undefined,
    txnDate: new Date(txnDate),
    status,
    deletedAt,
  });
}

function ruleTransaction(id, date, options = {}) {
  return {
    _id: new mongoose.Types.ObjectId(id),
    userId: userA._id,
    walletId: walletA._id,
    type: "expense",
    amount: 1_000,
    categoryId: null,
    merchant: "Known Store",
    merchantKey: "known store",
    txnDate: new Date(date),
    status: "confirmed",
    deletedAt: null,
    ...options,
  };
}

test("rule engine flags personal outliers, duplicate candidates, first-time merchants, category spikes and frequency", () => {
  const history = Array.from({ length: 10 }, (_, index) =>
    ruleTransaction(String(index + 1).padStart(24, "0"), `2026-10-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`)
  );
  const large = ruleTransaction("000000000000000000000020", "2026-11-04T12:00:00.000Z", { amount: 6_000 });
  const largeTypes = detectTransactionAnomalies(large, [...history, large]).map((event) => event.type);
  assert.ok(largeTypes.includes("large_transaction"));
  assert.ok(largeTypes.includes("wallet_anomaly"));
  assert.ok(largeTypes.includes("unusual_merchant_amount"));

  const ordinary = ruleTransaction("000000000000000000000021", "2026-11-04T12:00:00.000Z", { amount: 1_500 });
  assert.ok(!detectTransactionAnomalies(ordinary, [...history, ordinary]).some(
    (event) => ["large_transaction", "wallet_anomaly"].includes(event.type)
  ));

  const original = ruleTransaction("000000000000000000000022", "2026-11-04T12:00:00.000Z");
  const duplicate = ruleTransaction("000000000000000000000023", "2026-11-04T12:02:00.000Z");
  assert.ok(detectTransactionAnomalies(duplicate, [original, duplicate]).some(
    (event) => event.type === "duplicate_possible"
  ));
  const exactCopy = ruleTransaction("000000000000000000000025", "2026-11-04T12:00:30.000Z");
  assert.ok(detectTransactionAnomalies(exactCopy, [original, exactCopy]).some(
    (event) => event.type === "duplicate_exact"
  ));

  const firstMerchant = ruleTransaction("000000000000000000000024", "2026-11-04T12:00:00.000Z", {
    merchant: "New Shop",
    merchantKey: "new shop",
  });
  const firstMerchantEvent = detectTransactionAnomalies(firstMerchant, [firstMerchant])
    .find((event) => event.type === "new_merchant");
  assert.ok(firstMerchantEvent);

  const merchantHistory = Array.from({ length: 3 }, (_, index) =>
    ruleTransaction(
      String(index + 71).padStart(24, "0"),
      `2026-09-${String(20 + index).padStart(2, "0")}T12:00:00.000Z`
    )
  );
  const merchantSpendIncrease = ruleTransaction("000000000000000000000074", "2026-11-04T12:00:00.000Z", {
    amount: 10_000,
  });
  assert.ok(detectTransactionAnomalies(merchantSpendIncrease, [...merchantHistory, merchantSpendIncrease]).some(
    (event) => event.type === "merchant_spending_increase"
  ));

  const categoryId = new mongoose.Types.ObjectId();
  const categoryHistory = Array.from({ length: 6 }, (_, index) => {
    const day = index < 3 ? 5 + index : 12 + index;
    return ruleTransaction(
      String(index + 31).padStart(24, "0"),
      `2026-09-${String(day).padStart(2, "0")}T12:00:00.000Z`,
      { amount: 1_000, categoryId }
    );
  });
  const categorySpike = ruleTransaction("000000000000000000000040", "2026-11-04T12:00:00.000Z", {
    amount: 20_000,
    categoryId,
  });
  assert.ok(detectTransactionAnomalies(categorySpike, [...categoryHistory, categorySpike]).some(
    (event) => event.type === "category_spending_increase"
  ));
  const categoryBaseline = Array.from({ length: 8 }, (_, index) =>
    ruleTransaction(
      String(index + 61).padStart(24, "0"),
      `2026-10-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
      { amount: 1_000, categoryId }
    )
  );
  const categoryAmountOutlier = ruleTransaction("000000000000000000000070", "2026-11-04T12:00:00.000Z", {
    amount: 6_000,
    categoryId,
  });
  assert.ok(detectTransactionAnomalies(categoryAmountOutlier, [...categoryBaseline, categoryAmountOutlier]).some(
    (event) => event.type === "category_amount_anomaly"
  ));

  const frequent = Array.from({ length: 4 }, (_, index) =>
    ruleTransaction(
      String(index + 51).padStart(24, "0"),
      new Date(Date.parse("2026-11-04T12:00:00.000Z") + index * 10_000).toISOString()
    )
  );
  assert.ok(detectTransactionAnomalies(frequent[3], frequent).some(
    (event) => event.type === "high_frequency"
  ));
  const priorMonthActivity = Array.from({ length: 8 }, (_, index) =>
    ruleTransaction(
      String(index + 81).padStart(24, "0"),
      `2026-10-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`
    )
  );
  const recentActivity = Array.from({ length: 6 }, (_, index) =>
    ruleTransaction(
      String(index + 91).padStart(24, "0"),
      new Date(Date.parse("2026-10-30T12:00:00.000Z") + index * 86_400_000).toISOString()
    )
  );
  const frequencyIncrease = detectTransactionAnomalies(
    recentActivity[5],
    [...priorMonthActivity, ...recentActivity]
  ).find((event) => event.type === "high_frequency");
  assert.ok(frequencyIncrease?.evidence.suddenIncrease);
});

test("detection persists explainable results once, reports insufficient history, and keeps records user-scoped", async () => {
  await addTransaction({ amount: 1_000, txnDate: "2026-11-02T12:00:00.000Z" });
  const target = await addTransaction({
    amount: 2_000,
    merchant: "First Visit",
    txnDate: "2026-11-04T12:00:00.000Z",
  });
  const otherUserTransaction = await addTransaction({
    userId: userB._id,
    walletId: walletB._id,
    amount: 3_000,
    merchant: "Other User",
  });
  const balanceBeforeDetection = await getWalletDeltas(userA._id);

  const detected = await call("POST", "/api/anomalies/detect", {
    startDate: "2026-11-04",
    endDate: "2026-11-04",
    limit: 10,
  });
  assert.equal(detected.status, 200);
  assert.equal(detected.json.data.scannedCount, 1);
  assert.equal(detected.json.data.insufficientBaselineCount, 1);
  assert.ok(detected.json.data.anomalies.some((item) => item.anomalyType === "new_merchant"));
  assert.ok(!JSON.stringify(detected.json).includes("detectionKey"));

  const initialCount = await TransactionAnomaly.countDocuments({ userId: userA._id });
  await Promise.all([1, 2].map(() => call("POST", "/api/anomalies/detect", {
    startDate: "2026-11-04",
    endDate: "2026-11-04",
    limit: 10,
  })));
  assert.equal(await TransactionAnomaly.countDocuments({ userId: userA._id }), initialCount);
  const unchangedTarget = await Transaction.findById(target._id).lean();
  assert.equal(unchangedTarget.amount, 2_000);
  assert.equal(unchangedTarget.status, "confirmed");
  assert.deepEqual(await getWalletDeltas(userA._id), balanceBeforeDetection);

  assert.equal((await call("POST", `/api/anomalies/transactions/${otherUserTransaction._id}/check`, {})).status, 404);
  assert.equal((await call("POST", `/api/anomalies/transactions/${target._id}/check`, {}, null)).status, 401);

  const list = await call("GET", "/api/anomalies?severity=low&page=1&limit=1");
  assert.equal(list.status, 200);
  assert.equal(list.json.pagination.page, 1);
  assert.ok(list.json.data.every((item) => item.userId === String(userA._id)));
});

test("anomaly detail, status transitions, summary, filters, and validation are authenticated and isolated", async () => {
  const transaction = await addTransaction({ merchant: "Unique Merchant" });
  const detection = await call("POST", "/api/anomalies/transactions/not-an-id/check", {});
  assert.equal(detection.status, 400);
  await call("POST", `/api/anomalies/transactions/${transaction._id}/check`, {});
  const record = await TransactionAnomaly.findOne({ userId: userA._id });
  assert.ok(record);

  assert.equal((await call("GET", `/api/anomalies/${record._id}`, undefined, tokenB)).status, 404);
  assert.equal((await call("GET", `/api/anomalies/${record._id}`)).status, 200);
  assert.equal((await call("PATCH", `/api/anomalies/${record._id}/status`, { status: "dismissed" })).status, 200);
  assert.equal((await call("PATCH", `/api/anomalies/${record._id}/status`, { status: "new" })).status, 400);
  assert.equal((await call("PATCH", `/api/anomalies/${record._id}/status`, { status: "resolved" })).status, 200);
  assert.equal((await call("PATCH", `/api/anomalies/${record._id}/status`, { status: "dismissed" })).status, 409);
  const summary = await call("GET", "/api/anomalies/summary");
  assert.equal(summary.status, 200);
  assert.equal(summary.json.data.resolved, 1);
  assert.equal((await call("GET", "/api/anomalies?severity=unknown")).status, 400);
  assert.equal((await call("POST", "/api/anomalies/detect", { startDate: "2026-11-02" })).status, 400);
  assert.equal((await call("GET", "/api/anomalies", undefined, null)).status, 401);
});
