import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/smartspend_transactions_test_never_connect";
process.env.JWT_SECRET = "transactions_test_secret_value_123456";
process.env.JWT_REFRESH_SECRET = "transactions_test_refresh_secret_value_123456";

const [
  { MongoMemoryServer },
  mongooseModule,
  appModule,
  userModule,
  walletModule,
  categoryModule,
  transactionModule,
  tokenModule,
] = await Promise.all([
  import("mongodb-memory-server"),
  import("mongoose"),
  import("../app.js"),
  import("../models/User.js"),
  import("../models/Wallet.js"),
  import("../models/Category.js"),
  import("../models/Transaction.js"),
  import("../utils/tokens.js"),
]);

const mongoose = mongooseModule.default;
const app = appModule.default;
const { User } = userModule;
const { Wallet } = walletModule;
const { Category } = categoryModule;
const { Transaction } = transactionModule;
const { signAccessToken } = tokenModule;

let mongo;
let server;
let base;
let userA;
let userB;
let walletA;
let categoryA;
let tokenA;
let tokenB;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Wallet.init(), Category.init(), Transaction.init()]);
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await Promise.all([Transaction.deleteMany({}), Category.deleteMany({}), Wallet.deleteMany({}), User.deleteMany({})]);
  [userA, userB] = await User.create([
    { name: "Transactions A", email: "transactions-a@example.com", passwordHash: "unused" },
    { name: "Transactions B", email: "transactions-b@example.com", passwordHash: "unused" },
  ]);
  [walletA] = await Wallet.create([
    { userId: userA._id, name: "Main Cash", type: "cash" },
    { userId: userB._id, name: "Private Wallet", type: "bank" },
  ]);
  [categoryA] = await Category.create([
    { name: "Groceries", type: "expense" },
    { userId: userB._id, name: "Private Category", type: "expense" },
  ]);
  tokenA = signAccessToken(userA._id);
  tokenB = signAccessToken(userB._id);
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

async function listTransactions(token, query) {
  const response = await fetch(`${base}/api/transactions?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: response.status, json: await response.json() };
}

test("search matches merchant, note, visible category and wallet without crossing users", async () => {
  await Transaction.create([
    {
      userId: userA._id,
      walletId: walletA._id,
      categoryId: categoryA._id,
      type: "expense",
      amount: 1_200,
      merchant: "Corner Shop",
      note: "weekly purchase",
      txnDate: new Date(),
      status: "confirmed",
    },
    {
      userId: userB._id,
      walletId: (await Wallet.findOne({ userId: userB._id }))._id,
      categoryId: (await Category.findOne({ userId: userB._id }))._id,
      type: "expense",
      amount: 9_900,
      merchant: "Secret Merchant",
      txnDate: new Date(),
      status: "confirmed",
    },
  ]);

  for (const query of ["q=Corner", "q=weekly", "q=Groceries", "q=Main%20Cash"]) {
    const response = await listTransactions(tokenA, query);
    assert.equal(response.status, 200, query);
    assert.equal(response.json.data.length, 1, query);
    assert.equal(response.json.data[0].merchant, "Corner Shop", query);
  }

  const foreign = await listTransactions(tokenA, "q=Secret");
  assert.equal(foreign.status, 200);
  assert.deepEqual(foreign.json.data, []);

  const privateCategory = await listTransactions(tokenA, "q=Private%20Category");
  assert.equal(privateCategory.status, 200);
  assert.deepEqual(privateCategory.json.data, []);
});
