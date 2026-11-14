import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/smartspend_scans_test_never_connect";
process.env.JWT_SECRET = "scans_test_secret_value_123456";
process.env.JWT_REFRESH_SECRET = "scans_test_refresh_secret_123456";
process.env.SCAN_RETENTION_DAYS = "30";

const [
  { MongoMemoryReplSet },
  mongooseModule,
  appModule,
  userModule,
  walletModule,
  categoryModule,
  transactionModule,
  scanModule,
  tokenModule,
  scanServiceModule,
  storageModule,
  balanceModule,
  extractionModule,
] = await Promise.all([
  import("mongodb-memory-server"),
  import("mongoose"),
  import("../app.js"),
  import("../models/User.js"),
  import("../models/Wallet.js"),
  import("../models/Category.js"),
  import("../models/Transaction.js"),
  import("../models/Scan.js"),
  import("../utils/tokens.js"),
  import("../services/scanService.js"),
  import("../services/scanStorageService.js"),
  import("../services/balanceService.js"),
  import("../services/scanExtractionService.js"),
]);

const mongoose = mongooseModule.default;
const app = appModule.default;
const { User } = userModule;
const { Wallet } = walletModule;
const { Category } = categoryModule;
const { Transaction } = transactionModule;
const { Scan } = scanModule;
const { signAccessToken } = tokenModule;
const { configureOcrProvider, resetOcrProvider, purgeExpiredScans } = scanServiceModule;
const { configureScanStorage, resetScanStorage } = storageModule;
const { listWalletsWithBalance } = balanceModule;
const { normalizeOcrText, moneyToPaise } = extractionModule;

const files = new Map();
const storage = {
  async put({ userId, fileId, mimeType, buffer }) {
    const key = `${userId}/${fileId}.${mimeType.split("/")[1]}`;
    files.set(key, Buffer.from(buffer));
    return key;
  },
  async get({ storageKey, userId }) {
    assert.ok(storageKey.startsWith(`${userId}/`));
    return files.get(storageKey);
  },
  async delete({ storageKey, userId }) {
    assert.ok(storageKey.startsWith(`${userId}/`));
    files.delete(storageKey);
  },
};

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
let recognizedText;

before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Wallet.init(),
    Category.init(),
    Transaction.init(),
    Scan.init(),
  ]);
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await Promise.all([
    Transaction.deleteMany({}),
    Scan.deleteMany({}),
    Category.deleteMany({}),
    Wallet.deleteMany({}),
    User.deleteMany({}),
  ]);
  files.clear();
  recognizedText = "Merchant: Corner Store\nTotal: INR 12.50\nDate: 05/11/2026";
  configureScanStorage(storage);
  configureOcrProvider({
    async recognize() {
      return { text: recognizedText, confidence: 0.9 };
    },
  });
  [userA, userB] = await User.create([
    { name: "Scans A", email: "scans-a@example.com", passwordHash: "unused", timezone: "Asia/Kolkata" },
    { name: "Scans B", email: "scans-b@example.com", passwordHash: "unused", timezone: "Asia/Kolkata" },
  ]);
  [walletA, walletB] = await Wallet.create([
    { userId: userA._id, name: "Scan cash", type: "cash", openingBalance: 10_000 },
    { userId: userB._id, name: "Other cash", type: "cash" },
  ]);
  categoryA = await Category.create({ userId: userA._id, name: "Food", type: "expense" });
  tokenA = signAccessToken(userA._id);
  tokenB = signAccessToken(userB._id);
});

after(async () => {
  resetOcrProvider();
  resetScanStorage();
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

function validPng() {
  const crc32 = (buffer) => {
    let crc = 0xffffffff;
    for (const byte of buffer) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const typeBytes = Buffer.from(type, "ascii");
    const size = Buffer.alloc(4);
    size.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
    return Buffer.concat([size, typeBytes, data, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  const pixelData = Buffer.from([0x78, 0x9c, 0x63, 0x60, 0x60, 0x60, 0xf8, 0x0f, 0x00, 0x01, 0x04, 0x01, 0x00]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", pixelData),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

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

async function upload(type = "receipt", buffer = validPng(), token = tokenA, mimeType = "image/png") {
  const form = new FormData();
  form.append("image", new Blob([buffer], { type: mimeType }), "original-name.png");
  const response = await fetch(`${base}/api/scans/${type}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: response.status, json: await response.json() };
}

function confirmBody(overrides = {}) {
  return {
    type: "expense",
    walletId: String(walletA._id),
    categoryId: String(categoryA._id),
    paymentMethod: "cash",
    ...overrides,
  };
}

test("upload endpoints require auth and reject unsupported, corrupted, and oversized images", async () => {
  assert.equal((await upload("receipt", validPng(), null)).status, 401);
  assert.equal((await upload("receipt", Buffer.from("not an image"))).status, 400);
  const corrupted = validPng();
  corrupted[corrupted.length - 1] = 0;
  assert.equal((await upload("receipt", corrupted)).status, 400);
  assert.equal((await upload("receipt", Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
});

test("receipt upload stores a private image and returns normalized editable fields", async () => {
  const response = await upload();
  assert.equal(response.status, 201, JSON.stringify(response.json));
  const scan = response.json.data;
  assert.equal(scan.type, "receipt");
  assert.equal(scan.extractionStatus, "ready");
  assert.equal(scan.draftFields.amountPaise, 1250);
  assert.equal(scan.draftFields.currency, "INR");
  assert.equal(scan.image.storageKey, undefined);
  assert.equal(files.size, 1);
});

test("UPI upload keeps unknown status and direction as a reviewable draft", async () => {
  recognizedText = "Amount INR 45.00\nTransaction ID: ABCD12345678";
  const response = await upload("upi");
  assert.equal(response.status, 201);
  assert.equal(response.json.data.draftFields.paymentStatus, "unknown");
  assert.equal(response.json.data.draftFields.paymentDirection, null);
  assert.ok(response.json.data.warnings.some((warning) => warning.includes("success was not verified")));
  assert.equal((await call("POST", `/api/scans/${response.json.data._id}/confirm`, confirmBody())).status, 400);
});

test("OCR normalization handles paise and missing fields without inventing values", () => {
  assert.equal(moneyToPaise("1,200.5"), 120050);
  assert.equal(moneyToPaise("1.234"), null);
  const result = normalizeOcrText("upi", "Reference ID: ABCD12345678");
  assert.equal(result.fields.amountPaise, null);
  assert.equal(result.fields.transactionDate, null);
  assert.equal(result.fields.paymentStatus, "unknown");
});

test("OCR failures retain an editable failed scan without creating transactions", async () => {
  configureOcrProvider({ async recognize() { throw new Error("provider details must not escape"); } });
  const response = await upload();
  assert.equal(response.status, 502);
  assert.equal(response.json.error.code, "OCR_FAILED");
  assert.equal(response.json.error.message, "Image processing failed; try again");
  const scanId = response.json.error.details.scanId;
  assert.equal(await Transaction.countDocuments({}), 0);

  const patched = await call("PATCH", `/api/scans/${scanId}`, {
    amountPaise: 2500,
    transactionDate: "2026-11-05T00:00:00.000Z",
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.json.data.extractionStatus, "ready");
});

test("scan drafts are owner-scoped and only draft fields can be edited", async () => {
  const scan = (await upload()).json.data;
  assert.equal((await call("GET", `/api/scans/${scan._id}`, undefined, tokenB)).status, 404);
  assert.equal((await call("PATCH", `/api/scans/${scan._id}`, { amountPaise: 500 }, tokenB)).status, 404);
  assert.equal((await call("PATCH", `/api/scans/${scan._id}`, { userId: String(userB._id) })).status, 400);
  assert.equal((await call("PATCH", `/api/scans/${scan._id}`, { amountPaise: 0 })).status, 400);
  const patched = await call("PATCH", `/api/scans/${scan._id}`, { merchant: "Edited merchant" });
  assert.equal(patched.json.data.draftFields.merchant, "Edited merchant");
});

test("explicit confirmation creates one transaction and updates the derived wallet balance", async () => {
  const scan = (await upload()).json.data;
  const response = await call("POST", `/api/scans/${scan._id}/confirm`, confirmBody());
  assert.equal(response.status, 201, JSON.stringify(response.json));
  assert.equal(response.json.data.amount, 1250);
  assert.equal(response.json.data.source, "receipt");
  assert.equal((await Scan.findById(scan._id)).extractionStatus, "confirmed");
  assert.equal((await listWalletsWithBalance(userA._id))[0].balance, 8750);

  const retry = await call("POST", `/api/scans/${scan._id}/confirm`, confirmBody());
  assert.equal(retry.status, 200);
  assert.equal(retry.json.duplicate, true);
  assert.equal(await Transaction.countDocuments({ userId: userA._id }), 1);
});

test("confirmation validates wallet and category ownership and UPI success/direction", async () => {
  const scan = (await upload()).json.data;
  assert.equal((await call("POST", `/api/scans/${scan._id}/confirm`, confirmBody({ walletId: String(walletB._id) }))).status, 400);
  assert.equal((await call("POST", `/api/scans/${scan._id}/confirm`, confirmBody({ categoryId: String(new mongoose.Types.ObjectId()) }))).status, 400);

  recognizedText = "Paid to Shop\nAmount INR 12.50\nDate: 05/11/2026\nStatus: Success\nUPI Ref: ABCD12345678";
  const upiScan = (await upload("upi")).json.data;
  assert.equal(upiScan.draftFields.paymentStatus, "success");
  assert.equal(upiScan.draftFields.paymentDirection, "out");
  assert.equal((await call("POST", `/api/scans/${upiScan._id}/confirm`, confirmBody({ type: "income", paymentMethod: "upi" }))).status, 400);
  const confirmed = await call("POST", `/api/scans/${upiScan._id}/confirm`, confirmBody({ paymentMethod: "upi" }));
  assert.equal(confirmed.status, 201);
  assert.equal(confirmed.json.data.type, "expense");
  assert.equal(confirmed.json.data.upiRef, "ABCD12345678");
});

test("duplicate candidates are limited to the owner and can be explicitly overridden", async () => {
  const txnDate = new Date("2026-11-05T00:00:00.000Z");
  await Transaction.create({
    userId: userB._id,
    walletId: walletB._id,
    type: "expense",
    amount: 1250,
    txnDate,
    status: "confirmed",
    deletedAt: null,
    merchant: "Corner Store",
    merchantKey: "corner store",
  });
  const noCrossUserMatch = (await upload()).json.data;
  assert.equal(noCrossUserMatch.possibleDuplicates.length, 0);

  await Transaction.create({
    userId: userA._id,
    walletId: walletA._id,
    type: "expense",
    amount: 1250,
    txnDate,
    status: "confirmed",
    deletedAt: null,
    merchant: "Corner Store",
    merchantKey: "corner store",
  });
  const scan = (await upload()).json.data;
  assert.equal(scan.possibleDuplicates.length, 1);
  assert.ok(scan.warnings.some((warning) => warning.includes("Possible duplicate")));
  assert.equal((await call("POST", `/api/scans/${scan._id}/confirm`, confirmBody())).status, 409);
  assert.equal((await call("POST", `/api/scans/${scan._id}/confirm`, confirmBody({ allowPossibleDuplicate: true }))).status, 201);
});

test("concurrent confirmation creates exactly one transaction", async () => {
  const scan = (await upload()).json.data;
  const [first, second] = await Promise.all([
    call("POST", `/api/scans/${scan._id}/confirm`, confirmBody()),
    call("POST", `/api/scans/${scan._id}/confirm`, confirmBody()),
  ]);
  assert.ok([201, 200].includes(first.status), JSON.stringify(first.json));
  assert.ok([201, 200].includes(second.status), JSON.stringify(second.json));
  assert.equal(await Transaction.countDocuments({ userId: userA._id, scanId: scan._id }), 1);
});

test("scan history is paginated, private images are deleted, and retention cleanup removes expired files", async () => {
  const response = await upload();
  const scan = response.json.data;
  assert.equal((await call("GET", "/api/scans", undefined, tokenB)).json.data.length, 0);
  const deleted = await call("DELETE", `/api/scans/${scan._id}`);
  assert.equal(deleted.status, 200);
  assert.equal(files.size, 0);

  const expired = (await upload()).json.data;
  await Scan.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(expired._id) },
    { $set: { createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) } }
  );
  const result = await purgeExpiredScans({ retentionDays: 30 });
  assert.equal(result.deleted, 1);
  assert.equal(result.failures, 0);
  assert.equal(await Scan.exists({ _id: expired._id }), null);
  assert.equal(files.size, 0);
});
