import crypto from "node:crypto";
import path from "node:path";
import { Types } from "mongoose";
import { ApiError } from "../utils/apiError.js";
import { makeDedupeHash, toMerchantKey } from "../utils/merchant.js";
import { BankStatementImport } from "../models/BankStatementImport.js";
import { StatementTransactionDraft } from "../models/StatementTransactionDraft.js";
import { Transaction } from "../models/Transaction.js";
import { Wallet } from "../models/Wallet.js";
import { Category } from "../models/Category.js";
import { getStatementStorage } from "./statementStorageService.js";
import { parseStatementCsv } from "./statementCsvParser.js";
import { parseStatementXlsx } from "./statementXlsxParser.js";
import { parseStatementPdf } from "./statementPdfParser.js";
import { MAX_STATEMENT_ROWS } from "./statementParsing.js";
import { queueCategorizationForTransaction } from "./categorizationService.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const DAY_MS = 86_400_000;

export function detectStatementFormat(file) {
  if (!file?.buffer || file.buffer.length === 0) throw ApiError.badRequest("Statement file is required");
  if (file.buffer.length > MAX_FILE_BYTES) {
    throw new ApiError(413, "FILE_TOO_LARGE", "Statement file must be 10 MB or smaller");
  }
  const extension = path.extname(path.win32.basename(file.originalname || "")).slice(1).toLowerCase();
  if (!["csv", "xlsx", "pdf"].includes(extension)) {
    throw ApiError.badRequest("Unsupported statement format; upload CSV, XLSX, or text-based PDF");
  }

  if (extension === "pdf" && file.buffer.toString("ascii", 0, 5) !== "%PDF-") {
    throw ApiError.badRequest("File content does not match the PDF extension");
  }
  if (
    extension === "xlsx" &&
    (file.buffer.length < 4 || file.buffer.readUInt32LE(0) !== 0x04034b50)
  ) throw ApiError.badRequest("File content does not match the XLSX extension");
  if (extension === "csv") {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(file.buffer);
      if (text.includes("\0") || text.startsWith("%PDF-") || text.startsWith("PK\u0003\u0004")) {
        throw new Error("Binary content");
      }
    } catch {
      throw ApiError.badRequest("File content does not match a UTF-8 CSV statement");
    }
  }
  return extension;
}

async function parseFile(format, buffer, mapping) {
  if (format === "csv") return parseStatementCsv(buffer, { mapping });
  if (format === "xlsx") return parseStatementXlsx(buffer, { mapping });
  if (mapping) throw ApiError.badRequest("Column mapping is supported for CSV and XLSX statements, not PDF");
  return parseStatementPdf(buffer);
}

function normalizeDescription(value) {
  return toMerchantKey(value).replace(/\b(upi|imps|neft|rtgs|pos|txn|transaction|ref|utr)\b/g, " ").replace(/\s+/g, " ").trim();
}

async function findDuplicate(userId, draft) {
  if (!draft.txnDate || !draft.amountPaise || !draft.transactionType) return null;
  const baseFilter = {
    userId,
    type: draft.transactionType,
    amount: draft.amountPaise,
    status: "confirmed",
    deletedAt: null,
  };
  if (draft.referenceNumber) {
    const referenceMatch = await Transaction.findOne({
      userId,
      status: "confirmed",
      deletedAt: null,
      $or: [
        { statementReference: draft.referenceNumber },
        { upiRef: draft.referenceNumber },
      ],
    }).select("_id").lean();
    if (referenceMatch) return { transactionId: referenceMatch._id, matchType: "reference" };
  }

  const candidates = await Transaction.find({
    ...baseFilter,
    txnDate: { $gte: new Date(draft.txnDate.getTime() - DAY_MS), $lte: new Date(draft.txnDate.getTime() + DAY_MS) },
  }).sort({ txnDate: 1 }).limit(25).select("_id merchant merchantKey note").lean();
  if (!candidates.length) return null;
  if (!draft.description) return { transactionId: candidates[0]._id, matchType: "amount_date" };

  const description = normalizeDescription(draft.description);
  const matching = candidates.find((candidate) =>
    [candidate.merchantKey, candidate.merchant, candidate.note]
      .some((value) => normalizeDescription(value) && normalizeDescription(value) === description)
  );
  return matching ? { transactionId: matching._id, matchType: "amount_date_description" } : null;
}

async function attachDuplicateMatches(userId, drafts) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(20, drafts.length) }, async () => {
    while (cursor < drafts.length) {
      const index = cursor;
      cursor += 1;
      const match = await findDuplicate(userId, drafts[index]);
      if (match) {
        drafts[index].duplicateStatus = "possible";
        drafts[index].duplicateMatches = [match];
      }
    }
  });
  await Promise.all(workers);
}

function countIssues(drafts) {
  return drafts.filter((draft) => draft.validationErrors.length > 0).length;
}

function publicImport(statementImport) {
  const data = statementImport.toObject ? statementImport.toObject() : { ...statementImport };
  if (data.file) delete data.file.storageKey;
  return data;
}

export async function createStatementImport({ user, file, walletId, bankName, mapping }) {
  const format = detectStatementFormat(file);
  const wallet = await Wallet.findOne({ _id: walletId, userId: user._id, archived: false }).select("_id");
  if (!wallet) throw ApiError.badRequest("Active wallet not found or does not belong to this user");

  const importId = new Types.ObjectId();
  const fileId = crypto.randomUUID();
  const storage = getStatementStorage();
  let storageKey;
  try {
    storageKey = await storage.put({ userId: user._id, fileId, format, buffer: file.buffer });
  } catch {
    throw new ApiError(500, "IMPORT_STORAGE_ERROR", "Could not securely store the statement");
  }

  let statementImport;
  try {
    statementImport = await BankStatementImport.create({
      _id: importId,
      userId: user._id,
      walletId,
      file: {
        storageKey,
        format,
        size: file.buffer.length,
        originalName: `statement.${format}`,
      },
      bankName: bankName || null,
      status: "processing",
    });
  } catch (error) {
    await storage.delete({ storageKey, userId: user._id });
    throw error;
  }

  let drafts;
  try {
    drafts = await parseFile(format, file.buffer, mapping);
    if (drafts.length > MAX_STATEMENT_ROWS) {
      throw ApiError.badRequest(`Statement exceeds the ${MAX_STATEMENT_ROWS}-transaction limit`);
    }
    await attachDuplicateMatches(user._id, drafts);
    const dates = drafts.map((draft) => draft.txnDate).filter(Boolean).sort((a, b) => a - b);
    await StatementTransactionDraft.insertMany(
      drafts.map((draft) => ({ ...draft, importId, userId: user._id })),
      { ordered: true }
    );
    statementImport.status = "review";
    statementImport.parsedTransactionCount = drafts.length;
    statementImport.duplicateCount = drafts.filter((draft) => draft.duplicateStatus === "possible").length;
    statementImport.statementRange = {
      startDate: dates[0] || null,
      endDate: dates.at(-1) || null,
    };
    await statementImport.save();
    return publicImport(statementImport);
  } catch (error) {
    const message = error instanceof ApiError
      ? error.message
      : "Statement could not be parsed reliably; verify the file and column mapping";
    statementImport.status = "failed";
    statementImport.errorDetails = {
      code: error.code || "STATEMENT_PARSE_ERROR",
      message: message.slice(0, 300),
    };
    await statementImport.save();
    throw new ApiError(
      422,
      "STATEMENT_PARSE_ERROR",
      message,
      { importId: String(statementImport._id), rowErrors: countIssues(drafts || []) }
    );
  }
}

export async function listStatementImports(userId, { page, limit, status }) {
  const filter = { userId };
  if (status) filter.status = status;
  const [data, total] = await Promise.all([
    BankStatementImport.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-file.storageKey")
      .lean(),
    BankStatementImport.countDocuments(filter),
  ]);
  return {
    data: data.map(publicImport),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getOwnedStatementImport(userId, importId) {
  const record = await BankStatementImport.findOne({ _id: importId, userId })
    .select("-file.storageKey")
    .lean();
  if (!record) throw ApiError.notFound("Statement import not found");
  return publicImport(record);
}

export async function listStatementDrafts(userId, importId, { page, limit, reviewStatus }) {
  const record = await BankStatementImport.findOne({ _id: importId, userId }).select("_id");
  if (!record) throw ApiError.notFound("Statement import not found");
  const filter = { userId, importId: record._id };
  if (reviewStatus) filter.reviewStatus = reviewStatus;
  const [data, total] = await Promise.all([
    StatementTransactionDraft.find(filter)
      .sort({ rowNumber: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    StatementTransactionDraft.countDocuments(filter),
  ]);
  return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function validateDraftCategory(userId, categoryId, transactionType, session) {
  if (!categoryId) return;
  const category = await Category.findOne({
    _id: categoryId,
    type: transactionType,
    $or: [{ userId: null }, { userId }],
  }).session(session);
  if (!category) throw ApiError.badRequest("Category not found or does not match the transaction direction");
}

export async function updateStatementDraft(userId, importId, draftId, changes) {
  const statementImport = await BankStatementImport.findOne({ _id: importId, userId }).select("_id status");
  if (!statementImport) throw ApiError.notFound("Statement import not found");
  if (["completed", "failed"].includes(statementImport.status)) {
    throw ApiError.conflict("This statement import is not editable");
  }
  const draft = await StatementTransactionDraft.findOne({
    _id: draftId,
    importId: statementImport._id,
    userId,
  });
  if (!draft) throw ApiError.notFound("Statement transaction not found");
  if (draft.reviewStatus === "imported") throw ApiError.conflict("Imported transactions cannot be edited");

  if ("categoryId" in changes && changes.categoryId) {
    const direction = changes.direction || draft.direction;
    const type = direction === "debit" ? "expense" : direction === "credit" ? "income" : null;
    if (!type) throw ApiError.badRequest("Set a debit or credit direction before choosing a category");
    const category = await Category.findOne({
      _id: changes.categoryId,
      type,
      $or: [{ userId: null }, { userId }],
    }).select("_id");
    if (!category) throw ApiError.badRequest("Category not found or does not match the transaction direction");
  }

  Object.assign(draft, changes);
  if ("direction" in changes) {
    draft.transactionType = changes.direction === "debit"
      ? "expense"
      : changes.direction === "credit"
        ? "income"
        : null;
  }
  if (changes.reviewStatus === "pending") {
    draft.validationErrors = draft.validationErrors.filter((message) =>
      !(/transaction date/i.test(message) && changes.txnDate) &&
      !(/amount/i.test(message) && changes.amountPaise) &&
      !(/direction/i.test(message) && changes.direction)
    );
  }
  const duplicate = await findDuplicate(userId, draft);
  draft.duplicateStatus = duplicate ? "possible" : "none";
  draft.duplicateMatches = duplicate ? [duplicate] : [];
  await draft.save();
  await refreshImportCounts(statementImport);
  return draft.toObject();
}

function assertImportableDraft(draft) {
  if (!draft.txnDate || !Number.isFinite(draft.txnDate.getTime())) {
    throw ApiError.badRequest(`Row ${draft.rowNumber} needs a valid transaction date`);
  }
  if (!Number.isSafeInteger(draft.amountPaise) || draft.amountPaise <= 0) {
    throw ApiError.badRequest(`Row ${draft.rowNumber} needs a positive amount in paise`);
  }
  if (!["debit", "credit"].includes(draft.direction)) {
    throw ApiError.badRequest(`Row ${draft.rowNumber} needs a debit or credit direction`);
  }
}

async function refreshImportCounts(statementImport, session) {
  const count = (filter) => {
    const query = StatementTransactionDraft.countDocuments(filter);
    return session ? query.session(session) : query;
  };
  const parsed = await count({ importId: statementImport._id });
  const duplicates = await count({ importId: statementImport._id, duplicateStatus: "possible" });
  const imported = await count({ importId: statementImport._id, reviewStatus: "imported" });
  const pending = await count({ importId: statementImport._id, reviewStatus: "pending" });
  statementImport.parsedTransactionCount = parsed;
  statementImport.duplicateCount = duplicates;
  statementImport.importedCount = imported;
  statementImport.status = pending === 0 ? "completed" : imported > 0 ? "partially_imported" : "review";
  await statementImport.save({ session });
}

export async function confirmStatementImport({ userId, importId, draftIds, allowDuplicateIds }) {
  const ids = draftIds.map((id) => new Types.ObjectId(id));
  const duplicateIds = new Set(allowDuplicateIds);
  const session = await BankStatementImport.startSession();
  let importedTransactions = [];
  let createdTransaction = false;
  try {
    await session.withTransaction(async () => {
      createdTransaction = false;
      const statementImport = await BankStatementImport.findOne({ _id: importId, userId }).session(session);
      if (!statementImport) throw ApiError.notFound("Statement import not found");
      if (statementImport.status === "failed") throw ApiError.conflict("Failed statement imports cannot be confirmed");

      const wallet = await Wallet.findOne({
        _id: statementImport.walletId,
        userId,
        archived: false,
      }).session(session);
      if (!wallet) throw ApiError.badRequest("Active wallet not found or does not belong to this user");

      const imported = [];
      for (let index = 0; index < ids.length; index += 1) {
        const draft = await StatementTransactionDraft.findOne({
          _id: ids[index],
          importId: statementImport._id,
          userId,
        }).session(session);
        if (!draft) throw ApiError.notFound("One or more selected statement transactions were not found");
        if (draft.reviewStatus === "imported") {
          const existing = await Transaction.findOne({
            userId,
            statementDraftId: draft._id,
          }).session(session);
          if (!existing) throw ApiError.conflict("Imported transaction is unavailable");
          imported.push(existing);
          continue;
        }
        if (draft.reviewStatus === "skipped") {
          throw ApiError.conflict(`Row ${draft.rowNumber} is skipped; change it to pending before importing`);
        }
        assertImportableDraft(draft);
        if (draft.duplicateStatus === "possible" && !duplicateIds.has(String(draft._id))) {
          throw new ApiError(
            409,
            "CONFLICT",
            `Row ${draft.rowNumber} may be a duplicate; explicitly allow it or skip the row`,
            { draftId: String(draft._id), duplicateMatches: draft.duplicateMatches.map((item) => String(item.transactionId)) }
          );
        }

        const type = draft.direction === "debit" ? "expense" : "income";
        await validateDraftCategory(userId, draft.categoryId, type, session);
        const description = draft.description || "";
        const merchant = description.slice(0, 80) || undefined;
        const merchantKey = toMerchantKey(merchant);
        const [transaction] = await Transaction.create(
          [{
            userId,
            walletId: statementImport.walletId,
            type,
            amount: draft.amountPaise,
            categoryId: draft.categoryId || null,
            merchant,
            merchantKey,
            note: description || undefined,
            txnDate: draft.txnDate,
            capturedAt: new Date(),
            source: "statement",
            status: "confirmed",
            paymentMethod: "net_banking",
            statementReference: draft.referenceNumber || undefined,
            statementDraftId: draft._id,
            dedupeHash: makeDedupeHash({
              userId,
              merchantKey,
              amount: draft.amountPaise,
              txnDate: draft.txnDate,
            }),
          }],
          { session }
        );
        createdTransaction = true;
        const updated = await StatementTransactionDraft.updateOne(
          {
            _id: draft._id,
            importId: statementImport._id,
            userId,
            reviewStatus: "pending",
          },
          {
            $set: {
              reviewStatus: "imported",
              linkedTransactionId: transaction._id,
            },
          },
          { session }
        );
        if (updated.modifiedCount !== 1) {
          throw ApiError.conflict(`Row ${draft.rowNumber} has already been reviewed`);
        }
        imported.push(transaction);
      }
      await refreshImportCounts(statementImport, session);
      importedTransactions = imported;
    });
  } catch (error) {
    if (error?.code === 11000) {
      const prior = await Transaction.find({
        userId,
        statementDraftId: { $in: ids },
      }).sort({ txnDate: 1 }).lean();
      if (prior.length === ids.length) {
        return { data: prior, duplicate: true };
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }
  for (const transaction of importedTransactions) {
    queueCategorizationForTransaction(transaction);
  }
  return { data: importedTransactions, duplicate: !createdTransaction };
}

export async function deleteStatementImport(userId, importId) {
  const statementImport = await BankStatementImport.findOne({ _id: importId, userId }).select("+file.storageKey importedCount");
  if (!statementImport) throw ApiError.notFound("Statement import not found");
  if (statementImport.importedCount > 0) {
    throw ApiError.conflict("Imports with transactions already created cannot be deleted");
  }
  try {
    await getStatementStorage().delete({ storageKey: statementImport.file.storageKey, userId });
  } catch {
    throw new ApiError(500, "IMPORT_STORAGE_ERROR", "Could not remove the private statement file");
  }
  await StatementTransactionDraft.deleteMany({ importId: statementImport._id, userId });
  await BankStatementImport.deleteOne({ _id: statementImport._id, userId });
  return { id: statementImport._id, deleted: true };
}

export async function purgeExpiredStatementImports({ retentionDays, now = new Date(), batchSize = 100 }) {
  if (!Number.isInteger(retentionDays) || retentionDays < 1) throw new RangeError("retentionDays must be a positive integer");
  const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
  let deleted = 0;
  let failures = 0;
  while (true) {
    const imports = await BankStatementImport.find({ createdAt: { $lte: cutoff } })
      .sort({ createdAt: 1 })
      .limit(batchSize)
      .select("+file.storageKey userId")
      .lean();
    if (!imports.length) break;
    for (const statementImport of imports) {
      try {
        await getStatementStorage().delete({ storageKey: statementImport.file.storageKey, userId: statementImport.userId });
        await StatementTransactionDraft.deleteMany({
          importId: statementImport._id,
          userId: statementImport.userId,
        });
        await BankStatementImport.deleteOne({ _id: statementImport._id });
        deleted += 1;
      } catch {
        failures += 1;
      }
    }
    if (imports.length < batchSize) break;
  }
  return { deleted, failures };
}
