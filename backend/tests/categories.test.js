import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/smartspend_categories_test_never_connect";
process.env.JWT_SECRET = "category_test_secret_value_123456";
process.env.JWT_REFRESH_SECRET = "category_test_refresh_secret_123456";

const [
  { MongoMemoryServer },
  mongooseModule,
  appModule,
  userModule,
  categoryModule,
  walletModule,
  tokenModule,
] = await Promise.all([
  import("mongodb-memory-server"),
  import("mongoose"),
  import("../app.js"),
  import("../models/User.js"),
  import("../models/Category.js"),
  import("../models/Wallet.js"),
  import("../utils/tokens.js"),
]);

const mongoose = mongooseModule.default;
const app = appModule.default;
const { User } = userModule;
const { Category } = categoryModule;
const { Wallet } = walletModule;
const { signAccessToken } = tokenModule;

let mongo;
let server;
let base;
let userA;
let userB;
let tokenA;
let tokenB;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Category.init(), Wallet.init()]);
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await Promise.all([Category.deleteMany({}), Wallet.deleteMany({}), User.deleteMany({})]);
  [userA, userB] = await User.create([
    { name: "Category A", email: "category-a@example.com", passwordHash: "unused" },
    { name: "Category B", email: "category-b@example.com", passwordHash: "unused" },
  ]);
  tokenA = signAccessToken(userA._id);
  tokenB = signAccessToken(userB._id);
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

async function call(method, body, token = tokenA) {
  const response = await fetch(`${base}/api/categories`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, json: await response.json() };
}

test("creates owner-scoped categories that can be referenced by transactions", async () => {
  const created = await call("POST", { name: "  Medical expenses  ", type: "expense", icon: "🏥" });
  assert.equal(created.status, 201);
  assert.equal(created.json.data.name, "Medical expenses");
  assert.equal(String(created.json.data.userId), String(userA._id));

  const [ownerList, otherList] = await Promise.all([
    call("GET"),
    call("GET", undefined, tokenB),
  ]);
  assert.ok(ownerList.json.data.some((item) => String(item._id) === String(created.json.data._id)));
  assert.equal(otherList.json.data.some((item) => String(item._id) === String(created.json.data._id)), false);

  const wallet = await Wallet.create({ userId: userA._id, name: "Cash", type: "cash" });
  const transactionResponse = await fetch(`${base}/api/transactions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "expense",
      amount: 1250,
      walletId: String(wallet._id),
      categoryId: String(created.json.data._id),
    }),
  });
  const transaction = await transactionResponse.json();
  assert.equal(transactionResponse.status, 201);
  assert.equal(String(transaction.data.categoryId), String(created.json.data._id));
});

test("rejects empty, overlong, and case-insensitive duplicate visible category names", async () => {
  assert.equal((await call("POST", { name: "   ", type: "expense" })).status, 400);
  assert.equal((await call("POST", { name: "x".repeat(41), type: "expense" })).status, 400);

  await Category.create({ userId: userA._id, name: "Fuel", type: "expense" });
  const duplicate = await call("POST", { name: "  fUeL ", type: "expense" });
  assert.equal(duplicate.status, 409);

  await Category.create({ userId: null, name: "Shopping", type: "expense" });
  const defaultDuplicate = await call("POST", { name: "shopping", type: "expense" });
  assert.equal(defaultDuplicate.status, 409);

  const otherOwner = await call("POST", { name: "Fuel", type: "expense" }, tokenB);
  assert.equal(otherOwner.status, 201);
});
