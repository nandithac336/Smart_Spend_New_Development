// Tests that need no database: validation, auth guards, error format, date helpers.
// Run with: npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

process.env.MONGODB_URI = "mongodb://localhost:27017/test";
process.env.JWT_SECRET = "test_secret_value_123456";
process.env.JWT_REFRESH_SECRET = "test_refresh_secret_123456";

const { default: app } = await import("../app.js");
const { startOfDay, startOfMonth } = await import("../utils/dates.js");
const { toMerchantKey } = await import("../utils/merchant.js");

let server;
let base;
before(() => {
  server = app.listen(0);
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const call = async (method, path, body, headers = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
};

test("health check", async () => {
  const r = await call("GET", "/api/health");
  assert.equal(r.status, 200);
  assert.equal(r.json.status, "ok");
});

test("register rejects invalid input with field details", async () => {
  const r = await call("POST", "/api/auth/register", { name: "A", email: "bad", password: "123" });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, "VALIDATION_ERROR");
  assert.ok(r.json.error.details.length >= 3);
});

test("register rejects weak password and bad phone", async () => {
  let r = await call("POST", "/api/auth/register", { name: "Asha", email: "a@b.com", password: "password" });
  assert.equal(r.status, 400);
  r = await call("POST", "/api/auth/register", { name: "Asha", email: "a@b.com", password: "pass1234", phone: "12345" });
  assert.equal(r.status, 400);
});

test("malformed JSON returns 400", async () => {
  const r = await call("POST", "/api/auth/register", "{bad json");
  assert.equal(r.status, 400);
});

test("protected routes return 401 without a token", async () => {
  for (const p of ["/api/transactions", "/api/wallets", "/api/categories", "/api/dashboard", "/api/auth/me", "/api/transactions/trash"]) {
    const r = await call("GET", p);
    assert.equal(r.status, 401, p);
    assert.equal(r.json.error.code, "UNAUTHORIZED");
  }
});

test("garbage tokens are rejected", async () => {
  const r = await call("GET", "/api/transactions", undefined, { Authorization: "Bearer not.a.token" });
  assert.equal(r.status, 401);
  const r2 = await call("POST", "/api/auth/refresh", { refreshToken: "x".repeat(40) });
  assert.equal(r2.status, 401);
});

test("unknown route returns JSON 404", async () => {
  const r = await call("GET", "/api/nope");
  assert.equal(r.status, 404);
  assert.equal(r.json.error.code, "NOT_FOUND");
});

test("date helpers follow the Indian calendar day", () => {
  assert.equal(startOfDay("Asia/Kolkata", new Date("2026-10-18T10:00:00Z")).toISOString(), "2026-10-17T18:30:00.000Z");
  assert.equal(startOfDay("Asia/Kolkata", new Date("2026-10-18T20:00:00Z")).toISOString(), "2026-10-18T18:30:00.000Z");
  assert.equal(startOfMonth("Asia/Kolkata", new Date("2026-10-18T10:00:00Z")).toISOString(), "2026-09-30T18:30:00.000Z");
  assert.equal(startOfMonth("Asia/Kolkata", new Date("2026-10-18T10:00:00Z"), 1).toISOString(), "2026-10-31T18:30:00.000Z");
});

test("merchant key normalizes names", () => {
  assert.equal(toMerchantKey("  Raju  Tea Stall! "), "raju tea stall");
});
