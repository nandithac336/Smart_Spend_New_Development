import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/smartspend_categorization_test_never_connect";
process.env.JWT_SECRET = "categorization_test_secret_value_123";
process.env.JWT_REFRESH_SECRET = "categorization_test_refresh_secret_123";

const [
  { MongoMemoryReplSet },
  mongooseModule,
  appModule,
  userModule,
  walletModule,
  categoryModule,
  transactionModule,
  suggestionModule,
  ruleModule,
  scanModule,
  importModule,
  draftModule,
  tokenModule,
  categorizationServiceModule,
  providerModule,
  scanServiceModule,
  importServiceModule,
  merchantModule,
  balanceModule,
] = await Promise.all([
  import("mongodb-memory-server"),
  import("mongoose"),
  import("../app.js"),
  import("../models/User.js"),
  import("../models/Wallet.js"),
  import("../models/Category.js"),
  import("../models/Transaction.js"),
  import("../models/CategorySuggestion.js"),
  import("../models/MerchantCategoryRule.js"),
  import("../models/Scan.js"),
  import("../models/BankStatementImport.js"),
  import("../models/StatementTransactionDraft.js"),
  import("../utils/tokens.js"),
  import("../services/categorizationService.js"),
  import("../services/categorizationAiProvider.js"),
  import("../services/scanService.js"),
  import("../services/statementImportService.js"),
  import("../utils/merchant.js"),
  import("../services/balanceService.js"),
]);

const mongoose = mongooseModule.default;
const app = appModule.default;
const { User } = userModule;
const { Wallet } = walletModule;
const { Category } = categoryModule;
const { Transaction } = transactionModule;
const { CategorySuggestion } = suggestionModule;
const { MerchantCategoryRule } = ruleModule;
const { Scan } = scanModule;
const { BankStatementImport } = importModule;
const { StatementTransactionDraft } = draftModule;
const { signAccessToken } = tokenModule;
const {
  acceptCategorySuggestion,
  bulkSuggestTransactionCategories,
  createOrUpdateMerchantRule,
  deleteMerchantRule,
  listMerchantRules,
  rejectCategorySuggestion,
  suggestTransactionCategory,
} = categorizationServiceModule;
const { configureCategorizationAiProvider, resetCategorizationAiProvider } = providerModule;
const { confirmScan } = scanServiceModule;
const { confirmStatementImport } = importServiceModule;
const { toMerchantKey } = merchantModule;
const { listWalletsWithBalance } = balanceModule;

let mongo;
let server;
let base;
let userA;
let userB;
let walletA;
let walletB;
let food;
let shopping;
let transport;
let salary;
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
    CategorySuggestion.init(),
    MerchantCategoryRule.init(),
    Scan.init(),
    BankStatementImport.init(),
    StatementTransactionDraft.init(),
  ]);
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  resetCategorizationAiProvider();
  await Promise.all([
    Transaction.deleteMany({}),
    CategorySuggestion.deleteMany({}),
    MerchantCategoryRule.deleteMany({}),
    Scan.deleteMany({}),
    StatementTransactionDraft.deleteMany({}),
    BankStatementImport.deleteMany({}),
    Category.deleteMany({}),
    Wallet.deleteMany({}),
    User.deleteMany({}),
  ]);
  [userA, userB] = await User.create([
    { name: "Categorization A", email: "categorization-a@example.com", passwordHash: "unused" },
    { name: "Categorization B", email: "categorization-b@example.com", passwordHash: "unused" },
  ]);
  [walletA, walletB] = await Wallet.create([
    { userId: userA._id, name: "A wallet", type: "cash", openingBalance: 100_000 },
    { userId: userB._id, name: "B wallet", type: "cash", openingBalance: 100_000 },
  ]);
  [food, shopping, transport, salary] = await Category.create([
    { userId: null, name: "Food", type: "expense" },
    { userId: null, name: "Shopping", type: "expense" },
    { userId: null, name: "Transport", type: "expense" },
    { userId: null, name: "Salary", type: "income" },
  ]);
  tokenA = signAccessToken(userA._id);
  tokenB = signAccessToken(userB._id);
});

after(async () => {
  resetCategorizationAiProvider();
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongo.stop();
});

async function transaction({ user = userA, wallet = walletA, merchant = "Unknown Shop", note, type = "expense", categoryId }) {
  return Transaction.create({
    userId: user._id,
    walletId: wallet._id,
    type,
    amount: 1250,
    merchant,
    merchantKey: toMerchantKey(merchant),
    note,
    categoryId: categoryId ?? null,
    txnDate: new Date("2026-11-04T10:00:00.000Z"),
    status: "confirmed",
  });
}

async function waitForSuggestion(transactionId, userId = userA._id) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const suggestion = await CategorySuggestion.findOne({ userId, transactionId });
    if (suggestion) return suggestion;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("Timed out waiting for background categorization");
}

async function api(path, { method = "GET", token = tokenA, body } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test("known merchant rules produce a high-confidence suggestion without changing transaction category", async () => {
  const txn = await transaction({ merchant: "Swiggy" });
  const suggestion = await suggestTransactionCategory({ userId: userA._id, transactionId: txn._id });
  assert.equal(String(suggestion.suggestedCategoryId), String(food._id));
  assert.equal(suggestion.confidenceLevel, "high");
  assert.equal(suggestion.source, "keyword_rule");
  assert.equal((await Transaction.findById(txn._id)).categoryId, null);
});

test("unknown merchants remain uncategorized and low confidence asks for manual selection", async () => {
  const txn = await transaction({ merchant: "Unlisted Local Store" });
  const suggestion = await suggestTransactionCategory({ userId: userA._id, transactionId: txn._id });
  assert.equal(suggestion.suggestedCategoryId, null);
  assert.equal(suggestion.confidenceLevel, "low");
  assert.match(suggestion.explanation, /manually/i);
  assert.equal((await Transaction.findById(txn._id)).categoryId, null);
});

test("user merchant rules outrank built-in rules and remain owner-scoped", async () => {
  const rule = await createOrUpdateMerchantRule(userA._id, {
    merchant: "Swiggy",
    transactionType: "expense",
    categoryId: shopping._id,
  });
  await createOrUpdateMerchantRule(userA._id, {
    merchant: "SWIGGY!",
    transactionType: "expense",
    categoryId: food._id,
  });
  assert.equal(await MerchantCategoryRule.countDocuments({ userId: userA._id }), 1);
  const txn = await transaction({ merchant: "Swiggy" });
  const suggestion = await suggestTransactionCategory({ userId: userA._id, transactionId: txn._id });
  assert.equal(suggestion.source, "user_rule");
  assert.equal(String(suggestion.suggestedCategoryId), String(food._id));

  const ownRules = await listMerchantRules(userA._id, { page: 1, limit: 50 });
  const otherRules = await listMerchantRules(userB._id, { page: 1, limit: 50 });
  assert.equal(ownRules.pagination.total, 1);
  assert.equal(otherRules.pagination.total, 0);
  await assert.rejects(
    deleteMerchantRule(userB._id, rule._id),
    (error) => error.status === 404
  );
});

test("historical confirmed choices provide medium-confidence suggestions only from the same user", async () => {
  await transaction({ merchant: "Local Bakery", categoryId: food._id });
  const otherUsersTxn = await transaction({
    user: userB,
    wallet: walletB,
    merchant: "Local Bakery",
    categoryId: shopping._id,
  });
  const txn = await transaction({ merchant: "Local Bakery" });
  const suggestion = await suggestTransactionCategory({ userId: userA._id, transactionId: txn._id });
  assert.equal(String(suggestion.suggestedCategoryId), String(food._id));
  assert.equal(suggestion.source, "history");
  assert.equal(suggestion.confidenceLevel, "medium");
  await assert.rejects(
    suggestTransactionCategory({ userId: userA._id, transactionId: otherUsersTxn._id }),
    (error) => error.status === 404
  );
});

test("AI provider receives minimized input, valid output is checked, and provider failures fall back safely", async () => {
  const txn = await transaction({ merchant: "Mystery Cafe", note: "coffee purchase" });
  let received;
  configureCategorizationAiProvider({
    async categorize(input) {
      received = input;
      return {
        suggestedCategoryId: String(food._id),
        confidenceScore: 0.9,
        explanation: "Cafe purchase",
        detectedMerchant: "Mystery Cafe",
        alternatives: [{ categoryId: String(shopping._id), confidenceScore: 0.2, explanation: "Other" }],
      };
    },
  });
  const result = await suggestTransactionCategory({ userId: userA._id, transactionId: txn._id });
  assert.equal(result.source, "ai");
  assert.equal(result.confidenceLevel, "high");
  assert.equal(received.amount, undefined);
  assert.equal(received.userId, undefined);
  assert.equal(received.walletId, undefined);
  assert.equal(result.alternatives.length, 1);

  resetCategorizationAiProvider();
  const invalidTxn = await transaction({ merchant: "Mystery Kiosk" });
  configureCategorizationAiProvider({
    async categorize() {
      return {
        suggestedCategoryId: String(userB._id),
        confidenceScore: 0.99,
        explanation: "Invalid category",
        detectedMerchant: null,
        alternatives: [],
      };
    },
  });
  const invalid = await suggestTransactionCategory({ userId: userA._id, transactionId: invalidTxn._id });
  assert.equal(invalid.source, "none");

  resetCategorizationAiProvider();
  const failedTxn = await transaction({ merchant: "Mystery Cart" });
  configureCategorizationAiProvider({ async categorize() { throw new Error("provider unavailable"); } });
  const fallback = await suggestTransactionCategory({ userId: userA._id, transactionId: failedTxn._id });
  assert.equal(fallback.source, "none");
  assert.equal(fallback.suggestedCategoryId, null);
});

test("accept/reject preserve confirmed categories and corrections become merchant preferences", async () => {
  const txn = await transaction({ merchant: "Corner Books" });
  const suggestion = await suggestTransactionCategory({ userId: userA._id, transactionId: txn._id });
  const accepted = await acceptCategorySuggestion(userA._id, suggestion._id, shopping._id);
  assert.equal(accepted.transaction.categoryId.toString(), shopping._id.toString());
  assert.equal(accepted.suggestion.status, "accepted");
  assert.equal((await acceptCategorySuggestion(userA._id, suggestion._id, shopping._id)).duplicate, true);

  const correctedTxn = await transaction({ merchant: "Custom Grocer" });
  const correctedSuggestion = await suggestTransactionCategory({
    userId: userA._id,
    transactionId: correctedTxn._id,
  });
  const rejected = await rejectCategorySuggestion(userA._id, correctedSuggestion._id, food._id);
  assert.equal(rejected.suggestion.status, "rejected");
  const future = await transaction({ merchant: "Custom Grocer" });
  const learned = await suggestTransactionCategory({ userId: userA._id, transactionId: future._id });
  assert.equal(learned.source, "user_rule");
  assert.equal(String(learned.suggestedCategoryId), String(food._id));

  const selected = await transaction({ merchant: "Already Chosen", categoryId: shopping._id });
  const preserved = await suggestTransactionCategory({ userId: userA._id, transactionId: selected._id });
  assert.equal(preserved.status, "existing_category");
  assert.equal(String((await Transaction.findById(selected._id)).categoryId), String(shopping._id));
});

test("bulk suggestions return per-transaction results and never expose another user's transactions", async () => {
  const own = await transaction({ merchant: "Uber" });
  const foreign = await transaction({ user: userB, wallet: walletB, merchant: "Uber" });
  const results = await bulkSuggestTransactionCategories(userA._id, [String(own._id), String(foreign._id)]);
  assert.equal(results[0].success, true);
  assert.equal(String(results[0].data.suggestedCategoryId), String(transport._id));
  assert.equal(results[1].success, false);
  assert.equal(results[1].error.code, "NOT_FOUND");
});

test("bulk categorization reuses repeated merchant decisions and avoids duplicate AI calls", async () => {
  const first = await transaction({ merchant: "Mystery Cafe", note: "coffee purchase" });
  const second = await transaction({ merchant: "Mystery Cafe", note: "coffee purchase" });
  let calls = 0;
  configureCategorizationAiProvider({
    async categorize() {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        suggestedCategoryId: String(food._id),
        confidenceScore: 0.9,
        explanation: "Cafe purchase",
        detectedMerchant: "Mystery Cafe",
        alternatives: [],
      };
    },
  });
  const results = await bulkSuggestTransactionCategories(userA._id, [
    String(first._id),
    String(second._id),
  ]);
  assert.ok(results.every((result) => result.success));
  assert.equal(calls, 1);
});

test("manual transaction creation queues a suggestion while leaving the category unset", async () => {
  const response = await api("/api/transactions", {
    method: "POST",
    body: {
      type: "expense",
      amount: 900,
      walletId: String(walletA._id),
      merchant: "Zomato",
      paymentMethod: "upi",
    },
  });
  assert.equal(response.status, 201);
  const payload = await response.json();
  const txn = await Transaction.findById(payload.data._id);
  const suggestion = await waitForSuggestion(txn._id);
  assert.equal(suggestion.source, "keyword_rule");
  assert.equal(txn.categoryId, null);
});

test("scan and statement confirmation queue categorization after transaction commit without changing balances", async () => {
  const scan = await Scan.create({
    userId: userA._id,
    type: "receipt",
    image: { storageKey: "private/receipt.jpg", mimeType: "image/jpeg", size: 20 },
    extractionStatus: "ready",
    draftFields: {
      merchant: "Swiggy",
      transactionDate: new Date("2026-11-04T10:00:00.000Z"),
      amountPaise: 1200,
    },
    confirmationClientId: "e5182b13-1b87-46d4-b5a3-9424ef777301",
  });
  const scanResult = await confirmScan({
    user: userA,
    scanId: scan._id,
    input: { walletId: walletA._id, type: "expense", paymentMethod: "upi" },
  });
  const scanSuggestion = await waitForSuggestion(scanResult.transaction._id);
  assert.equal(scanSuggestion.source, "keyword_rule");

  const statementImport = await BankStatementImport.create({
    userId: userA._id,
    walletId: walletA._id,
    file: { storageKey: "private/statement.csv", format: "csv", size: 100, originalName: "statement.csv" },
    status: "review",
  });
  const draft = await StatementTransactionDraft.create({
    importId: statementImport._id,
    userId: userA._id,
    rowNumber: 1,
    txnDate: new Date("2026-11-03T10:00:00.000Z"),
    description: "Swiggy order",
    amountPaise: 1500,
    direction: "debit",
    transactionType: "expense",
  });
  const importResult = await confirmStatementImport({
    userId: userA._id,
    importId: statementImport._id,
    draftIds: [String(draft._id)],
    allowDuplicateIds: [],
  });
  const importSuggestion = await waitForSuggestion(importResult.data[0]._id);
  assert.equal(importSuggestion.source, "keyword_rule");
  const balances = await listWalletsWithBalance(userA._id);
  assert.equal(balances[0].balance, 100_000 - 1200 - 1500);
});

test("categorization API enforces authentication, validation, and user-scoped suggestion access", async () => {
  const txn = await transaction({ merchant: "Uber" });
  const suggested = await api("/api/categorization/suggest", {
    method: "POST",
    body: { transactionId: String(txn._id) },
  });
  assert.equal(suggested.status, 200);
  const suggestion = (await suggested.json()).data;
  assert.equal((await api("/api/categorization/suggestions")).status, 200);
  const foreignRead = await api(`/api/categorization/${suggestion._id}/accept`, {
    method: "POST",
    token: tokenB,
    body: {},
  });
  assert.equal(foreignRead.status, 404);
  const accepted = await api(`/api/categorization/${suggestion._id}/accept`, {
    method: "POST",
    body: {},
  });
  assert.equal(accepted.status, 200);
  const createdRule = await api("/api/categorization/rules", {
    method: "POST",
    body: {
      merchant: "Coffee House",
      transactionType: "expense",
      categoryId: String(food._id),
    },
  });
  assert.equal(createdRule.status, 200);
  const rule = (await createdRule.json()).data;
  const patchedRule = await api(`/api/categorization/rules/${rule._id}`, {
    method: "PATCH",
    body: { categoryId: String(shopping._id) },
  });
  assert.equal(patchedRule.status, 200);
  assert.equal(String((await patchedRule.json()).data.categoryId), String(shopping._id));
  assert.equal((await api(`/api/categorization/rules/${rule._id}`, { method: "DELETE" })).status, 200);
  const invalid = await api("/api/categorization/bulk-suggest", {
    method: "POST",
    body: { transactionIds: ["not-an-id"] },
  });
  assert.equal(invalid.status, 400);
});
