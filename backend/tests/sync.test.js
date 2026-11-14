import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/smartspend_sync_test_never_connect";
process.env.JWT_SECRET = "sync_test_secret_value_123456";
process.env.JWT_REFRESH_SECRET = "sync_test_refresh_secret_123456";

const [
  { MongoMemoryReplSet },
  mongooseModule,
  appModule,
  userModule,
  walletModule,
  categoryModule,
  transactionModule,
  syncOperationModule,
  tokenModule,
  balanceModule,
] = await Promise.all([
  import("mongodb-memory-server"),
  import("mongoose"),
  import("../app.js"),
  import("../models/User.js"),
  import("../models/Wallet.js"),
  import("../models/Category.js"),
  import("../models/Transaction.js"),
  import("../models/SyncOperation.js"),
  import("../utils/tokens.js"),
  import("../services/balanceService.js"),
]);

const mongoose = mongooseModule.default;
const app = appModule.default;
const { User } = userModule;
const { Wallet } = walletModule;
const { Category } = categoryModule;
const { Transaction } = transactionModule;
const { SyncOperation } = syncOperationModule;
const { signAccessToken } = tokenModule;
const { listWalletsWithBalance } = balanceModule;

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
    SyncOperation.init(),
  ]);
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await Promise.all([
    SyncOperation.deleteMany({}),
    Transaction.deleteMany({}),
    Category.deleteMany({}),
    Wallet.deleteMany({}),
    User.deleteMany({}),
  ]);
  [userA, userB] = await User.create([
    { name: "Sync A", email: "sync-a@example.com", passwordHash: "unused" },
    { name: "Sync B", email: "sync-b@example.com", passwordHash: "unused" },
  ]);
  [walletA, walletB] = await Wallet.create([
    { userId: userA._id, name: "Cash", type: "cash", openingBalance: 25_000 },
    { userId: userB._id, name: "Cash", type: "cash" },
  ]);
  [categoryA] = await Category.create([
    { userId: userA._id, name: "Food", type: "expense" },
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

function createOperation(overrides = {}) {
  return {
    clientOperationId: randomUUID(),
    operationType: "create",
    entityType: "transaction",
    clientTimestamp: new Date().toISOString(),
    payload: {
      type: "expense",
      amount: 1_250,
      walletId: String(walletA._id),
      categoryId: String(categoryA._id),
      merchant: "Offline Cafe",
      txnDate: "2026-11-04T10:00:00.000Z",
    },
    ...overrides,
  };
}

async function push(operations, token = tokenA) {
  return call("POST", "/api/sync/push", { operations }, token);
}

test("sync APIs require authentication and validate bounded batches and filters", async () => {
  assert.equal((await call("GET", "/api/sync/status", undefined, null)).status, 401);
  assert.equal((await call("GET", "/api/sync/pull?limit=101")).status, 400);
  assert.equal((await call("GET", "/api/sync/pull?cursor=not-a-cursor")).status, 400);
  const response = await push([{
    ...createOperation(),
    userId: String(userB._id),
  }]);
  assert.equal(response.status, 200);
  assert.equal(response.json.data.results[0].status, "failed");
  assert.equal(response.json.data.results[0].error.code, "VALIDATION_ERROR");
});

test("offline creates are atomic, idempotent and preserve paise balance", async () => {
  const operation = createOperation();
  const response = await push([operation, operation]);
  assert.equal(response.status, 200);
  const [created, retry] = response.json.data.results;
  assert.equal(created.status, "processed");
  assert.equal(retry.status, "processed");
  assert.equal(retry.duplicate, true);
  assert.equal(String(created.data.userId), String(userA._id));
  assert.equal(created.data.amount, 1_250);
  assert.equal(await Transaction.countDocuments({ userId: userA._id }), 1);
  assert.equal((await listWalletsWithBalance(userA._id))[0].balance, 23_750);

  const changedPayloadRetry = createOperation({
    clientOperationId: operation.clientOperationId,
    payload: { ...operation.payload, amount: 9_000 },
  });
  const reused = await push([changedPayloadRetry]);
  assert.equal(reused.json.data.results[0].status, "conflict");
  assert.equal(reused.json.data.results[0].conflict.code, "operation_id_reused");
  assert.equal(await Transaction.countDocuments({ userId: userA._id }), 1);
});

test("offline updates use optimistic versions and deletes preserve trash semantics", async () => {
  const created = (await push([createOperation()])).json.data.results[0].data;
  const originalVersion = created.updatedAt;
  const updateId = randomUUID();
  const updated = await push([{
    clientOperationId: updateId,
    operationType: "update",
    entityType: "transaction",
    entityId: String(created._id),
    baseUpdatedAt: originalVersion,
    clientTimestamp: new Date().toISOString(),
    payload: { amount: 2_500, note: "offline edit" },
  }]);
  assert.equal(updated.json.data.results[0].status, "processed");
  assert.equal(updated.json.data.results[0].data.amount, 2_500);

  const stale = await push([{
    clientOperationId: randomUUID(),
    operationType: "update",
    entityType: "transaction",
    entityId: String(created._id),
    baseUpdatedAt: originalVersion,
    clientTimestamp: new Date().toISOString(),
    payload: { amount: 8_000 },
  }]);
  assert.equal(stale.json.data.results[0].status, "conflict");
  assert.equal(stale.json.data.results[0].conflict.code, "stale_update");
  assert.equal((await Transaction.findById(created._id)).amount, 2_500);

  const current = await Transaction.findById(created._id);
  const deleted = await push([{
    clientOperationId: randomUUID(),
    operationType: "delete",
    entityType: "transaction",
    entityId: String(created._id),
    baseUpdatedAt: current.updatedAt.toISOString(),
    clientTimestamp: new Date().toISOString(),
  }]);
  assert.equal(deleted.json.data.results[0].status, "processed");
  assert.ok((await Transaction.findById(created._id)).deletedAt);
  assert.equal((await listWalletsWithBalance(userA._id))[0].balance, 25_000);

  const editedAfterDelete = await push([{
    clientOperationId: randomUUID(),
    operationType: "update",
    entityType: "transaction",
    entityId: String(created._id),
    baseUpdatedAt: updated.json.data.results[0].data.updatedAt,
    clientTimestamp: new Date().toISOString(),
    payload: { amount: 4_000 },
  }]);
  assert.equal(editedAfterDelete.json.data.results[0].conflict.code, "deleted_entity");
});

test("batches report independent failures and reject unavailable references", async () => {
  const archived = await Wallet.create({ userId: userA._id, name: "Archived", type: "bank", archived: true });
  const foreignCategory = await Category.create({ userId: userB._id, name: "Private", type: "expense" });
  const results = await push([
    createOperation({
      clientOperationId: randomUUID(),
      payload: { ...createOperation().payload, walletId: String(archived._id) },
    }),
    { operationType: "execute", entityType: "transaction" },
    createOperation({
      clientOperationId: randomUUID(),
      payload: { ...createOperation().payload, categoryId: String(foreignCategory._id) },
    }),
    createOperation(),
  ]);
  assert.equal(results.json.data.results[0].status, "conflict");
  assert.equal(results.json.data.results[0].conflict.code, "wallet_unavailable");
  assert.equal(results.json.data.results[1].status, "failed");
  assert.equal(results.json.data.results[2].conflict.code, "category_unavailable");
  assert.equal(results.json.data.results[3].status, "processed");
  assert.equal(await Transaction.countDocuments({ userId: userA._id }), 1);
});

test("deleting an offline transfer removes both legs atomically", async () => {
  const pairId = new mongoose.Types.ObjectId();
  const [outgoing, incoming] = await Transaction.create([
    {
      userId: userA._id,
      walletId: walletA._id,
      type: "transfer",
      transferDirection: "out",
      transferPairId: pairId,
      amount: 3_000,
      txnDate: new Date("2026-11-04T10:00:00Z"),
      source: "transfer",
    },
    {
      userId: userA._id,
      walletId: await Wallet.create({ userId: userA._id, name: "Bank", type: "bank" }).then((wallet) => wallet._id),
      type: "transfer",
      transferDirection: "in",
      transferPairId: pairId,
      amount: 3_000,
      txnDate: new Date("2026-11-04T10:00:00Z"),
      source: "transfer",
    },
  ]);
  const result = await push([{
    clientOperationId: randomUUID(),
    operationType: "delete",
    entityType: "transaction",
    entityId: String(outgoing._id),
    baseUpdatedAt: outgoing.updatedAt.toISOString(),
    clientTimestamp: new Date().toISOString(),
  }]);
  assert.equal(result.json.data.results[0].status, "processed");
  assert.ok((await Transaction.findById(outgoing._id)).deletedAt);
  assert.ok((await Transaction.findById(incoming._id)).deletedAt);
});

test("pull pagination uses stable cursors, includes tombstones and isolates users", async () => {
  const owned = await Transaction.create([
    { userId: userA._id, walletId: walletA._id, type: "expense", amount: 100, txnDate: new Date("2026-11-01T10:00:00Z") },
    { userId: userA._id, walletId: walletA._id, type: "income", amount: 200, txnDate: new Date("2026-11-02T10:00:00Z") },
    { userId: userA._id, walletId: walletA._id, type: "expense", amount: 300, txnDate: new Date("2026-11-03T10:00:00Z"), deletedAt: new Date() },
  ]);
  await Transaction.create({
    userId: userB._id,
    walletId: walletB._id,
    type: "expense",
    amount: 900,
    txnDate: new Date("2026-11-01T10:00:00Z"),
  });

  const first = await call("GET", "/api/sync/pull?limit=1");
  assert.equal(first.status, 200);
  assert.equal(first.json.data.changes.length, 1);
  assert.equal(first.json.data.pagination.hasMore, true);
  const ids = first.json.data.changes.map((change) => change.entityId);
  const changes = [...first.json.data.changes];
  let page = first.json.data;
  while (page.pagination.hasMore) {
    const next = await call("GET", `/api/sync/pull?limit=1&cursor=${encodeURIComponent(cursorFor(page))}`);
    assert.equal(next.status, 200);
    page = next.json.data;
    ids.push(...page.changes.map((change) => change.entityId));
    changes.push(...page.changes);
  }
  assert.deepEqual(new Set(ids), new Set(owned.map((transaction) => String(transaction._id))));
  const deleted = changes.find((change) => change.entityId === String(owned[2]._id));
  assert.equal(deleted.operationType, "delete");

  const completedCursor = page.pagination.nextCursor;
  const incremental = await Transaction.create({
    userId: userA._id,
    walletId: walletA._id,
    type: "expense",
    amount: 450,
    txnDate: new Date("2026-11-05T10:00:00Z"),
  });
  const nextWindow = await call("GET", `/api/sync/pull?limit=10&cursor=${encodeURIComponent(completedCursor)}`);
  assert.ok(nextWindow.json.data.changes.some((change) => change.entityId === String(incremental._id)));

  const forbidden = await push([{
    clientOperationId: randomUUID(),
    operationType: "update",
    entityType: "transaction",
    entityId: String((await Transaction.findOne({ userId: userB._id }))._id),
    baseUpdatedAt: new Date().toISOString(),
    clientTimestamp: new Date().toISOString(),
    payload: { amount: 5_000 },
  }]);
  assert.equal(forbidden.json.data.results[0].conflict.code, "entity_not_found");
});

function cursorFor(page) { return page.pagination.nextCursor; }

test("sync status is scoped and reports persisted operation outcomes", async () => {
  await push([createOperation()]);
  const ownStatus = await call("GET", "/api/sync/status");
  const foreignStatus = await call("GET", "/api/sync/status", undefined, tokenB);
  assert.equal(ownStatus.json.data.processedOperations, 1);
  assert.equal(foreignStatus.json.data.processedOperations, 0);
});

test("failed MongoDB transaction leaves no transaction or idempotency receipt", async () => {
  const originalCreate = SyncOperation.create;
  SyncOperation.create = async () => {
    throw new Error("simulated receipt persistence failure");
  };
  let response;
  try {
    response = await push([createOperation()]);
  } finally {
    SyncOperation.create = originalCreate;
  }
  assert.equal(response.json.data.results[0].status, "failed");
  assert.equal(response.json.data.results[0].error.code, "SYNC_PROCESSING_FAILED");
  assert.equal(await Transaction.countDocuments({ userId: userA._id }), 0);
  assert.equal(await SyncOperation.countDocuments({ userId: userA._id }), 0);
});
