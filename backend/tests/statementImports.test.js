import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/smartspend_statement_test_never_connect";
process.env.JWT_SECRET = "statement_test_secret_value_123456";
process.env.JWT_REFRESH_SECRET = "statement_test_refresh_secret_123456";
process.env.STATEMENT_RETENTION_DAYS = "90";

const [
  { MongoMemoryReplSet },
  mongooseModule,
  appModule,
  userModule,
  walletModule,
  categoryModule,
  transactionModule,
  importModule,
  draftModule,
  tokenModule,
  storageModule,
  importServiceModule,
  csvModule,
  xlsxModule,
  pdfModule,
  balanceModule,
  ExcelJSModule,
  PDFKitModule,
] = await Promise.all([
  import("mongodb-memory-server"),
  import("mongoose"),
  import("../app.js"),
  import("../models/User.js"),
  import("../models/Wallet.js"),
  import("../models/Category.js"),
  import("../models/Transaction.js"),
  import("../models/BankStatementImport.js"),
  import("../models/StatementTransactionDraft.js"),
  import("../utils/tokens.js"),
  import("../services/statementStorageService.js"),
  import("../services/statementImportService.js"),
  import("../services/statementCsvParser.js"),
  import("../services/statementXlsxParser.js"),
  import("../services/statementPdfParser.js"),
  import("../services/balanceService.js"),
  import("exceljs"),
  import("pdfkit"),
]);

const mongoose = mongooseModule.default;
const app = appModule.default;
const { User } = userModule;
const { Wallet } = walletModule;
const { Category } = categoryModule;
const { Transaction } = transactionModule;
const { BankStatementImport } = importModule;
const { StatementTransactionDraft } = draftModule;
const { signAccessToken } = tokenModule;
const { configureStatementStorage, resetStatementStorage } = storageModule;
const { createStatementImport, purgeExpiredStatementImports, detectStatementFormat } = importServiceModule;
const { parseStatementCsv } = csvModule;
const { parseStatementXlsx } = xlsxModule;
const { parseStatementPdf } = pdfModule;
const { listWalletsWithBalance } = balanceModule;
const ExcelJS = ExcelJSModule.default;
const PDFDocument = PDFKitModule.default;

const storedFiles = new Map();
const privateStorage = {
  async put({ userId, fileId, format, buffer }) {
    const key = `${userId}/${fileId}.${format}`;
    storedFiles.set(key, Buffer.from(buffer));
    return key;
  },
  async get({ storageKey, userId }) {
    assert.ok(storageKey.startsWith(`${userId}/`));
    return storedFiles.get(storageKey);
  },
  async delete({ storageKey, userId }) {
    assert.ok(storageKey.startsWith(`${userId}/`));
    storedFiles.delete(storageKey);
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

before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Wallet.init(),
    Category.init(),
    Transaction.init(),
    BankStatementImport.init(),
    StatementTransactionDraft.init(),
  ]);
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await Promise.all([
    Transaction.deleteMany({}),
    StatementTransactionDraft.deleteMany({}),
    BankStatementImport.deleteMany({}),
    Category.deleteMany({}),
    Wallet.deleteMany({}),
    User.deleteMany({}),
  ]);
  storedFiles.clear();
  configureStatementStorage(privateStorage);
  [userA, userB] = await User.create([
    { name: "Statement A", email: "statement-a@example.com", passwordHash: "unused", timezone: "Asia/Kolkata" },
    { name: "Statement B", email: "statement-b@example.com", passwordHash: "unused", timezone: "Asia/Kolkata" },
  ]);
  [walletA, walletB] = await Wallet.create([
    { userId: userA._id, name: "Statement account A", type: "bank", openingBalance: 500_000 },
    { userId: userB._id, name: "Statement account B", type: "bank" },
  ]);
  categoryA = await Category.create({ userId: userA._id, name: "Groceries", type: "expense" });
  tokenA = signAccessToken(userA._id);
  tokenB = signAccessToken(userB._id);
});

after(async () => {
  resetStatementStorage();
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

function csvBuffer(rows = [
  ["Txn Date", "Narration", "Debit Amount", "Credit Amount", "Balance", "UTR"],
  ["05/11/2026", "UPI PAYMENT CORNER STORE", '"1,200.50"', "", '"8,799.50"', "REF-123456"],
  ["06-Nov-2026", "SALARY CREDIT", "", "50000.00", "58800.00", "SAL-12345"],
]) {
  return Buffer.from(rows.map((row) => row.join(",")).join("\r\n"), "utf8");
}

async function xlsxBuffer() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Statement");
  sheet.addRows([
    ["Date", "Description", "Debit", "Credit", "Balance", "Ref No"],
    [new Date("2026-11-05T00:00:00.000Z"), "Grocery POS", 245.75, null, 1000, "XLS-100"],
    ["06/11/2026", "Interest credit", null, 15.25, 1015.25, "INT-101"],
  ]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function pdfBuffer({ encrypted = false } = {}) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      userPassword: encrypted ? "secret" : undefined,
      ownerPassword: encrypted ? "owner-secret" : undefined,
    });
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.font("Courier").fontSize(9)
      .text("Date        Description                Debit       Credit      Balance")
      .text("05/11/2026  UPI PAYMENT SHOP DR       250.00                  9750.00")
      .text("06/11/2026  SALARY CREDIT CR                    5000.00     14750.00");
    document.end();
  });
}

async function call(method, route, body, token = tokenA) {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

async function upload(fileBuffer = csvBuffer(), filename = "statement.csv", {
  token = tokenA,
  walletId = String(walletA._id),
  mapping,
} = {}) {
  const form = new FormData();
  form.append("walletId", walletId);
  if (mapping) form.append("mapping", JSON.stringify(mapping));
  form.append("file", new Blob([fileBuffer]), filename);
  const response = await fetch(`${base}/api/imports/statements`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  return { status: response.status, json: await response.json() };
}

test("CSV parser normalizes Indian dates, rupee grouping, debit and credit columns", () => {
  const drafts = parseStatementCsv(csvBuffer());
  assert.equal(drafts.length, 2);
  assert.equal(drafts[0].amountPaise, 120050);
  assert.equal(drafts[0].direction, "debit");
  assert.equal(drafts[0].transactionType, "expense");
  assert.equal(drafts[0].txnDate.toISOString(), "2026-11-05T00:00:00.000Z");
  assert.equal(drafts[1].amountPaise, 5_000_000);
  assert.equal(drafts[1].direction, "credit");
});

test("column mapping supports bank-specific CSV headings and useful missing-column errors", () => {
  const buffer = Buffer.from("Value date,Details,Withdrawal (INR),Deposit (INR)\n05/11/2026,UPI Tea,20.00,\n");
  const drafts = parseStatementCsv(buffer, {
    mapping: {
      headerRow: 1,
      date: "Value date",
      description: "Details",
      debit: "Withdrawal (INR)",
      credit: "Deposit (INR)",
    },
  });
  assert.equal(drafts[0].amountPaise, 2000);
  assert.equal(drafts[0].direction, "debit");
  assert.throws(() => parseStatementCsv(Buffer.from("Foo,Bar\nx,y\n")), /Could not identify transaction date/);
});

test("XLSX parser extracts date serials, numeric rupees, and direction", async () => {
  const drafts = await parseStatementXlsx(await xlsxBuffer());
  assert.equal(drafts.length, 2);
  assert.equal(drafts[0].amountPaise, 24575);
  assert.equal(drafts[0].direction, "debit");
  assert.equal(drafts[1].amountPaise, 1525);
  assert.equal(drafts[1].direction, "credit");
});

test("PDF parser extracts text-based statement rows and rejects encrypted, corrupt, and image-only PDFs", async () => {
  const drafts = await parseStatementPdf(await pdfBuffer());
  assert.equal(drafts.length, 2);
  assert.equal(drafts[0].amountPaise, 25000);
  assert.equal(drafts[0].direction, "debit");
  assert.equal(drafts[1].amountPaise, 500000);
  assert.equal(drafts[1].direction, "credit");

  await assert.rejects(() => parseStatementPdf(Buffer.from("%PDF-1.4\n%%EOF")), /incomplete|corrupted|could not be read/i);
  await assert.rejects(() => parseStatementPdf(Buffer.from("%PDF-1.4\n/Encrypt 4 0 R\n%%EOF")), /Encrypted PDFs/);

  const imageOnly = await new Promise((resolve, reject) => {
    const document = new PDFDocument();
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.rect(50, 50, 100, 40).stroke();
    document.end();
  });
  await assert.rejects(() => parseStatementPdf(imageOnly), /no selectable text/i);
});

test("upload requires authentication, validates extension and content, wallet ownership, and file limits", async () => {
  assert.equal((await upload(csvBuffer(), "statement.csv", { token: null })).status, 401);
  assert.equal((await upload(Buffer.from("not a sheet"), "fake.xlsx")).status, 400);
  assert.equal((await upload(csvBuffer(), "file.exe")).status, 400);
  assert.equal((await upload(csvBuffer(), "statement.csv", { walletId: String(walletB._id) })).status, 400);
  const tooLarge = await upload(Buffer.alloc(10 * 1024 * 1024 + 1), "statement.csv");
  assert.equal(tooLarge.status, 413);
  assert.equal(detectStatementFormat({ originalname: "TEST.CSV", buffer: csvBuffer() }), "csv");
});

test("upload creates private review drafts without creating financial transactions", async () => {
  const response = await upload();
  assert.equal(response.status, 201, JSON.stringify(response.json));
  const record = response.json.data;
  assert.equal(record.status, "review");
  assert.equal(record.parsedTransactionCount, 2);
  assert.equal(record.file.storageKey, undefined);
  assert.equal(record.file.originalName, "statement.csv");
  assert.equal(storedFiles.size, 1);
  assert.equal(await Transaction.countDocuments({ userId: userA._id }), 0);

  const drafts = await call("GET", `/api/imports/${record._id}/transactions`);
  assert.equal(drafts.status, 200);
  assert.equal(drafts.json.data.length, 2);
});

test("parser failures return safe validation details and preserve a failed import for review or deletion", async () => {
  const response = await upload(Buffer.from("name,notes\nfoo,bar"), "invalid.csv");
  assert.equal(response.status, 422);
  assert.equal(response.json.error.code, "STATEMENT_PARSE_ERROR");
  const importId = response.json.error.details.importId;
  const record = await call("GET", `/api/imports/${importId}`);
  assert.equal(record.json.data.status, "failed");
  assert.equal(record.json.data.file.storageKey, undefined);
  assert.equal((await call("DELETE", `/api/imports/${importId}`)).status, 200);
  assert.equal(storedFiles.size, 0);
});

test("all reads and edits are owner scoped; drafts can be corrected or skipped", async () => {
  const record = (await upload()).json.data;
  const drafts = (await call("GET", `/api/imports/${record._id}/transactions`)).json.data;
  const draft = drafts[0];
  assert.equal((await call("GET", `/api/imports/${record._id}`, undefined, tokenB)).status, 404);
  assert.equal((await call("GET", `/api/imports/${record._id}/transactions`, undefined, tokenB)).status, 404);
  assert.equal(
    (await call("PATCH", `/api/imports/${record._id}/transactions/${draft._id}`, { amountPaise: 100 }, tokenB)).status,
    404
  );
  const edited = await call("PATCH", `/api/imports/${record._id}/transactions/${draft._id}`, {
    amountPaise: 15000,
    description: "Corrected transaction",
    categoryId: String(categoryA._id),
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.json.data.amountPaise, 15000);
  const skipped = await call("PATCH", `/api/imports/${record._id}/transactions/${draft._id}`, { reviewStatus: "skipped" });
  assert.equal(skipped.json.data.reviewStatus, "skipped");
  assert.equal((await call("PATCH", `/api/imports/${record._id}/transactions/${draft._id}`, { userId: String(userB._id) })).status, 400);
});

test("duplicate candidates are owner-specific, shown for review, and need explicit override", async () => {
  const date = new Date("2026-11-05T00:00:00.000Z");
  await Transaction.create({
    userId: userB._id,
    walletId: walletB._id,
    type: "expense",
    amount: 120050,
    txnDate: date,
    status: "confirmed",
    deletedAt: null,
    statementReference: "REF-123456",
  });
  const noCrossUserDuplicate = (await upload()).json.data;
  assert.equal(noCrossUserDuplicate.duplicateCount, 0);
  await call("DELETE", `/api/imports/${noCrossUserDuplicate._id}`);
  await Transaction.create({
    userId: userA._id,
    walletId: walletA._id,
    type: "expense",
    amount: 120050,
    txnDate: date,
    status: "confirmed",
    deletedAt: null,
    statementReference: "REF-123456",
  });
  const record = (await upload()).json.data;
  const drafts = (await call("GET", `/api/imports/${record._id}/transactions`)).json.data;
  assert.equal(record.duplicateCount, 1);
  assert.equal(drafts[0].duplicateStatus, "possible");
  const blocked = await call("POST", `/api/imports/${record._id}/confirm`, { draftIds: [String(drafts[0]._id)] });
  assert.equal(blocked.status, 409);

  const confirmed = await call("POST", `/api/imports/${record._id}/confirm`, {
    draftIds: [String(drafts[0]._id)],
    allowDuplicateIds: [String(drafts[0]._id)],
  });
  assert.equal(confirmed.status, 201);
  assert.equal(confirmed.json.data[0].type, "expense");
});

test("import explicitly creates selected income/expense transactions and updates the derived wallet balance", async () => {
  const record = (await upload()).json.data;
  const drafts = (await call("GET", `/api/imports/${record._id}/transactions`)).json.data;
  const response = await call("POST", `/api/imports/${record._id}/confirm`, {
    draftIds: [String(drafts[0]._id), String(drafts[1]._id)],
  });
  assert.equal(response.status, 201, JSON.stringify(response.json));
  assert.equal(response.json.data.length, 2);
  assert.deepEqual(response.json.data.map((item) => item.type), ["expense", "income"]);
  assert.ok(response.json.data.every((item) => item.source === "statement"));
  const balance = (await listWalletsWithBalance(userA._id)).find((item) => String(item._id) === String(walletA._id));
  assert.equal(balance.balance, 5_379_950);
  assert.equal((await call("GET", `/api/imports/${record._id}`)).json.data.status, "completed");
});

test("category ownership is enforced and imported records cannot be deleted", async () => {
  const record = (await upload()).json.data;
  const draft = (await call("GET", `/api/imports/${record._id}/transactions`)).json.data[0];
  assert.equal((await call("PATCH", `/api/imports/${record._id}/transactions/${draft._id}`, {
    categoryId: String(new mongoose.Types.ObjectId()),
  })).status, 400);
  assert.equal((await call("POST", `/api/imports/${record._id}/confirm`, {
    draftIds: [String(draft._id)],
  })).status, 201);
  assert.equal((await call("DELETE", `/api/imports/${record._id}`)).status, 409);
});

test("repeated and concurrent confirmations are idempotent", async () => {
  const record = (await upload()).json.data;
  const drafts = (await call("GET", `/api/imports/${record._id}/transactions`)).json.data;
  const payload = { draftIds: [String(drafts[0]._id)] };
  const [first, second] = await Promise.all([
    call("POST", `/api/imports/${record._id}/confirm`, payload),
    call("POST", `/api/imports/${record._id}/confirm`, payload),
  ]);
  assert.ok([200, 201].includes(first.status), JSON.stringify(first.json));
  assert.ok([200, 201].includes(second.status), JSON.stringify(second.json));
  assert.equal(await Transaction.countDocuments({ userId: userA._id, statementDraftId: drafts[0]._id }), 1);
  assert.equal((await call("POST", `/api/imports/${record._id}/confirm`, payload)).status, 200);
});

test("CSV row limits and private statement retention cleanup are enforced", async () => {
  const oversizedRows = [["Date", "Description", "Debit", "Credit"]];
  for (let row = 0; row < 5_001; row += 1) {
    oversizedRows.push(["05/11/2026", `Row ${row}`, "1.00", ""]);
  }
  assert.throws(
    () => parseStatementCsv(Buffer.from(oversizedRows.map((row) => row.join(",")).join("\n"))),
    /5000-transaction limit/
  );

  const record = (await upload()).json.data;
  await BankStatementImport.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(record._id) },
    { $set: { createdAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000) } }
  );
  const result = await purgeExpiredStatementImports({ retentionDays: 90 });
  assert.equal(result.deleted, 1);
  assert.equal(result.failures, 0);
  assert.equal(await BankStatementImport.exists({ _id: record._id }), null);
  assert.equal(await StatementTransactionDraft.countDocuments({ importId: record._id }), 0);
  assert.equal(storedFiles.size, 0);
});
