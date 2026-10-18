import { test } from "node:test";
import assert from "node:assert/strict";
import * as s from "../validators/schemas.js";

const id = "507f1f77bcf86cd799439011";
const ok = (schema, v) => schema.safeParse(v).success;

test("transaction create rules", () => {
  assert.ok(ok(s.createTransactionSchema, { type: "expense", amount: 12000, walletId: id, categoryId: id, paymentMethod: "upi" }));
  assert.ok(!ok(s.createTransactionSchema, { type: "expense", amount: -5, walletId: id }));
  assert.ok(!ok(s.createTransactionSchema, { type: "expense", amount: 120.5, walletId: id }), "decimals not allowed");
  assert.ok(!ok(s.createTransactionSchema, { type: "transfer", amount: 100, walletId: id }), "transfers use the wallet endpoint");
  assert.ok(!ok(s.createTransactionSchema, { type: "expense", amount: 100, walletId: "123" }));
  assert.ok(!ok(s.createTransactionSchema, { type: "expense", amount: 100, walletId: id, txnDate: "2099-01-01" }));
  assert.ok(!ok(s.createTransactionSchema, { type: "expense", amount: 100, walletId: id, clientId: "abc" }));
  assert.ok(ok(s.createTransactionSchema, { type: "expense", amount: 100, walletId: id, clientId: "3f2b8c1e-9d4a-4e7b-8a61-2c5d7e9f0a12" }));
});

test("unknown fields such as userId are stripped", () => {
  const out = s.createTransactionSchema.parse({ type: "expense", amount: 100, walletId: id, userId: "hacker" });
  assert.equal("userId" in out, false);
});

test("transaction update rules", () => {
  assert.ok(!ok(s.updateTransactionSchema, {}));
  assert.ok(ok(s.updateTransactionSchema, { amount: 15000 }));
  assert.equal("type" in s.updateTransactionSchema.parse({ amount: 1, type: "income" }), false);
});

test("list query defaults and limits", () => {
  const q = s.listTransactionsQuery.parse({});
  assert.equal(q.page, 1);
  assert.equal(q.limit, 20);
  assert.ok(!ok(s.listTransactionsQuery, { limit: "500" }));
});

test("auth, wallet and profile rules", () => {
  assert.equal(s.registerSchema.parse({ name: "Asha", email: "A@B.com", password: "pass1234" }).email, "a@b.com");
  assert.ok(!ok(s.createWalletSchema, { name: "UPI" }));
  assert.ok(ok(s.transferSchema, { fromWalletId: id, toWalletId: id, amount: 200000 }));
  assert.ok(!ok(s.updateMeSchema, { timezone: "Mars/Base" }));
  assert.ok(ok(s.updateMeSchema, { timezone: "Asia/Kolkata" }));
});
