import crypto from "node:crypto";
import sharp from "sharp";
import { Scan } from "../models/Scan.js";
import { Transaction } from "../models/Transaction.js";
import { Wallet } from "../models/Wallet.js";
import { Category } from "../models/Category.js";
import { getScanStorage } from "./scanStorageService.js";
import { createGoogleVisionProvider } from "./ocrProvider.js";
import { normalizeOcrText } from "./scanExtractionService.js";
import { makeDedupeHash, toMerchantKey } from "../utils/merchant.js";
import { ApiError } from "../utils/apiError.js";
import { queueCategorizationForTransaction } from "./categorizationService.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DAY_MS = 86_400_000;

export function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12 || buffer.length > MAX_IMAGE_BYTES) return null;

  if (
    buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff &&
    buffer.readUInt16BE(buffer.length - 2) === 0xffd9
  ) {
    return "image/jpeg";
  }
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.subarray(0, 8).equals(pngSignature)) {
    let offset = 8;
    let seenHeader = false;
    let seenData = false;
    while (offset + 12 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const type = buffer.toString("ascii", offset + 4, offset + 8);
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      const chunkEnd = dataEnd + 4;
      if (chunkEnd > buffer.length) return null;
      const crc = buffer.readUInt32BE(dataEnd);
      if (crc32(buffer.subarray(offset + 4, dataEnd)) !== crc) return null;
      if (!seenHeader) {
        if (type !== "IHDR" || length !== 13) return null;
        if (buffer.readUInt32BE(dataStart) === 0 || buffer.readUInt32BE(dataStart + 4) === 0) return null;
        seenHeader = true;
      }
      if (type === "IDAT") seenData = true;
      offset = chunkEnd;
      if (type === "IEND") {
        if (length !== 0 || offset !== buffer.length || !seenData) return null;
        return "image/png";
      }
    }
    return null;
  }
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP" &&
    buffer.readUInt32LE(4) + 8 === buffer.length &&
    buffer.length >= 20
  ) {
    return "image/webp";
  }

  function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  return null;
}

async function validateImageContent(buffer, mimeType) {
  try {
    const image = sharp(buffer, { failOn: "error", limitInputPixels: 40_000_000, sequentialRead: true });
    const metadata = await image.metadata();
    const format = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" }[mimeType];
    if (!format || metadata.format !== format || !metadata.width || !metadata.height) return false;
    await image.stats();
    return true;
  } catch {
    return false;
  }
}

function publicScan(scan) {
  const data = scan.toObject ? scan.toObject() : { ...scan };
  if (data.image) delete data.image.storageKey;
  return data;
}

function addWarnings(scan, warnings) {
  scan.warnings = [...new Set([...(scan.warnings || []), ...warnings])];
}

async function findPossibleDuplicates(userId, fields) {
  if (!fields.amountPaise || !fields.transactionDate) return [];
  const start = new Date(fields.transactionDate.getTime() - DAY_MS);
  const end = new Date(fields.transactionDate.getTime() + DAY_MS);
  const common = {
    userId,
    amount: fields.amountPaise,
    status: "confirmed",
    deletedAt: null,
    txnDate: { $gte: start, $lte: end },
  };
  let matches;
  if (fields.upiRef) {
    matches = await Transaction.find({ userId, upiRef: fields.upiRef, status: "confirmed", deletedAt: null })
      .sort({ txnDate: -1 })
      .limit(5)
      .select("_id txnDate amount merchant")
      .lean();
    if (matches.length) return matches.map((txn) => ({
      transactionId: txn._id,
      txnDate: txn.txnDate,
      amountPaise: txn.amount,
      merchant: txn.merchant,
      matchType: "upi_reference",
    }));
  }

  const query = fields.transactionType ? { ...common, type: fields.transactionType } : common;
  if (fields.merchant) {
    const merchantKey = toMerchantKey(fields.merchant);
    matches = await Transaction.find({
      ...query,
      $or: [{ merchantKey }, { merchant: fields.merchant }],
    }).sort({ txnDate: -1 }).limit(5).select("_id txnDate amount merchant").lean();
    if (matches.length) return matches.map((txn) => ({
      transactionId: txn._id,
      txnDate: txn.txnDate,
      amountPaise: txn.amount,
      merchant: txn.merchant,
      matchType: "amount_date_merchant",
    }));
  }
  matches = await Transaction.find(query)
    .sort({ txnDate: -1 })
    .limit(5)
    .select("_id txnDate amount merchant")
    .lean();
  return matches.map((txn) => ({
    transactionId: txn._id,
    txnDate: txn.txnDate,
    amountPaise: txn.amount,
    merchant: txn.merchant,
    matchType: "amount_date",
  }));
}

let ocrProvider = createGoogleVisionProvider();

export function configureOcrProvider(provider) {
  if (!provider || typeof provider.recognize !== "function") throw new TypeError("OCR provider must implement recognize");
  ocrProvider = provider;
}

export function resetOcrProvider() {
  ocrProvider = createGoogleVisionProvider();
}

export async function createScan({ user, type, file }) {
  if (!file?.buffer) throw ApiError.badRequest("Image file is required");
  const mimeType = detectImageType(file.buffer);
  if (!mimeType || !(await validateImageContent(file.buffer, mimeType))) {
    throw ApiError.badRequest("Image is unsupported or corrupted; upload a valid JPEG, PNG, or WebP");
  }

  const scanId = crypto.randomUUID();
  const storage = getScanStorage();
  let storageKey;
  try {
    storageKey = await storage.put({ userId: user._id, fileId: scanId, mimeType, buffer: file.buffer });
  } catch {
    throw new ApiError(500, "SCAN_STORAGE_ERROR", "Could not securely store the image");
  }

  let scan;
  try {
    scan = await Scan.create({
      userId: user._id,
      type,
      image: { storageKey, mimeType, size: file.buffer.length },
      extractionStatus: "processing",
      confirmationClientId: crypto.randomUUID(),
    });
  } catch (error) {
    await storage.delete({ storageKey, userId: user._id });
    throw error;
  }

  try {
    const result = await ocrProvider.recognize(file.buffer, { type, mimeType });
    const extraction = normalizeOcrText(type, result.text || "", result.confidence ?? null);
    scan.extractedFields = extraction.fields;
    scan.draftFields = extraction.fields;
    scan.confidence = extraction.confidence;
    scan.warnings = extraction.warnings;
    scan.possibleDuplicates = await findPossibleDuplicates(user._id, extraction.fields);
    if (scan.possibleDuplicates.length) addWarnings(scan, ["Possible duplicate transactions were found"]);
    scan.extractionStatus = "ready";
    await scan.save();
    return publicScan(scan);
  } catch (error) {
    const code = error.code === "OCR_TIMEOUT"
      ? "OCR_TIMEOUT"
      : error.code === "OCR_NOT_CONFIGURED"
        ? "OCR_NOT_CONFIGURED"
        : "OCR_FAILED";
    scan.extractionStatus = "failed";
    process.emitWarning(`Scan OCR processing failed (${code})`, { code: "SCAN_OCR_ERROR" });
    scan.processingError = {
      code,
      message: code === "OCR_TIMEOUT"
        ? "Image processing timed out; try again"
        : code === "OCR_NOT_CONFIGURED"
          ? "Image scanning is not configured"
          : "Image processing failed; try again",
    };
    addWarnings(scan, ["Text extraction failed; no transaction was created"]);
    await scan.save();
    throw new ApiError(
      code === "OCR_NOT_CONFIGURED" ? 503 : 502,
      code,
      scan.processingError.message,
      { scanId: String(scan._id) }
    );
  }
}

export async function listScans(userId, { page = 1, limit = 20, type, status } = {}) {
  const filter = { userId };
  if (type) filter.type = type;
  if (status) filter.extractionStatus = status;
  const [data, total] = await Promise.all([
    Scan.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-image.storageKey")
      .lean(),
    Scan.countDocuments(filter),
  ]);
  return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getOwnedScan(userId, scanId) {
  const scan = await Scan.findOne({ _id: scanId, userId }).select("-image.storageKey").lean();
  if (!scan) throw ApiError.notFound("Scan not found");
  return scan;
}

export async function updateScanDraft(userId, scanId, changes) {
  const scan = await Scan.findOne({ _id: scanId, userId });
  if (!scan) throw ApiError.notFound("Scan not found");
  if (!["ready", "failed"].includes(scan.extractionStatus)) {
    throw ApiError.conflict("Only a completed scan draft can be edited");
  }
  Object.assign(scan.draftFields, changes);
  if (scan.extractionStatus === "failed" && scan.draftFields.amountPaise && scan.draftFields.transactionDate) {
    scan.extractionStatus = "ready";
    scan.processingError = { code: null, message: null };
  }
  await scan.save();
  return publicScan(scan);
}

function assertConfirmation(scan, input) {
  const draft = scan.draftFields;
  if (!draft.amountPaise || !Number.isSafeInteger(draft.amountPaise) || draft.amountPaise <= 0) {
    throw ApiError.badRequest("Enter a valid transaction amount before confirming");
  }
  if (!draft.transactionDate || Number.isNaN(new Date(draft.transactionDate).getTime())) {
    throw ApiError.badRequest("Enter a valid transaction date before confirming");
  }
  if (new Date(draft.transactionDate).getTime() > Date.now() + DAY_MS) {
    throw ApiError.badRequest("Transaction date cannot be in the future");
  }
  if (scan.type === "upi") {
    if (draft.paymentStatus !== "success") {
      throw ApiError.badRequest("UPI payment success must be verified before confirming");
    }
    if (draft.paymentDirection === "out" && input.type !== "expense") {
      throw ApiError.badRequest("Payment direction indicates an expense");
    }
    if (draft.paymentDirection === "in" && input.type !== "income") {
      throw ApiError.badRequest("Payment direction indicates income");
    }
  }
  if (scan.possibleDuplicates.length && !input.allowPossibleDuplicate) {
    throw new ApiError(
      409,
      "CONFLICT",
      "Possible duplicate found; set allowPossibleDuplicate=true to confirm anyway",
      { possibleDuplicates: scan.possibleDuplicates.map((item) => String(item.transactionId)) }
    );
  }
}

export async function confirmScan({ user, scanId, input }) {
  const session = await Scan.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const scan = await Scan.findOne({ _id: scanId, userId: user._id }).session(session);
      if (!scan) throw ApiError.notFound("Scan not found");

      const existing = await Transaction.findOne({ userId: user._id, scanId: scan._id }).session(session);
      if (scan.extractionStatus === "confirmed" || existing) {
        const transaction = existing || await Transaction.findOne({ _id: scan.linkedTransactionId, userId: user._id }).session(session);
        if (!transaction) throw ApiError.conflict("Scan was confirmed but its transaction is unavailable");
        result = { transaction, duplicate: true };
        return;
      }
      if (scan.extractionStatus !== "ready") {
        throw ApiError.conflict("Scan is not ready for confirmation");
      }
      assertConfirmation(scan, input);

      const wallet = await Wallet.findOne({
        _id: input.walletId,
        userId: user._id,
        archived: false,
      }).session(session);
      if (!wallet) throw ApiError.badRequest("Active wallet not found");

      if (input.categoryId) {
        const category = await Category.findOne({
          _id: input.categoryId,
          type: input.type,
          $or: [{ userId: null }, { userId: user._id }],
        }).session(session);
        if (!category) throw ApiError.badRequest("Category not found or does not match the transaction type");
      }

      const draft = scan.draftFields;
      const merchant = input.merchant ?? draft.merchant;
      const merchantKey = toMerchantKey(merchant);
      const txnDate = new Date(draft.transactionDate);
      const [transaction] = await Transaction.create(
        [{
          userId: user._id,
          walletId: input.walletId,
          type: input.type,
          amount: draft.amountPaise,
          categoryId: input.categoryId || null,
          merchant: merchant || undefined,
          merchantKey,
          note: input.note,
          paymentMethod: input.paymentMethod,
          txnDate,
          capturedAt: new Date(),
          source: scan.type === "receipt" ? "receipt" : "screenshot",
          status: "confirmed",
          upiRef: draft.upiRef || undefined,
          clientId: scan.confirmationClientId,
          scanId: scan._id,
          dedupeHash: makeDedupeHash({ userId: user._id, merchantKey, amount: draft.amountPaise, txnDate }),
        }],
        { session }
      );
      const updated = await Scan.updateOne(
        { _id: scan._id, userId: user._id, extractionStatus: "ready", linkedTransactionId: null },
        { $set: { extractionStatus: "confirmed", linkedTransactionId: transaction._id } },
        { session }
      );
      if (updated.modifiedCount !== 1) throw ApiError.conflict("Scan confirmation is already in progress");
      result = { transaction, duplicate: false };
    });
  } catch (error) {
    if (error?.code === 11000) {
      const scan = await Scan.findOne({ _id: scanId, userId: user._id });
      if (scan?.linkedTransactionId) {
        const transaction = await Transaction.findOne({ _id: scan.linkedTransactionId, userId: user._id });
        if (transaction) return { transaction, duplicate: true };
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }
  if (result?.transaction) queueCategorizationForTransaction(result.transaction);
  return result;
}

export async function deleteOwnedScan(userId, scanId) {
  const scan = await Scan.findOne({ _id: scanId, userId }).select("+image.storageKey");
  if (!scan) throw ApiError.notFound("Scan not found");
  try {
    await getScanStorage().delete({ storageKey: scan.image.storageKey, userId });
  } catch {
    throw new ApiError(500, "SCAN_STORAGE_ERROR", "Could not remove the private scan image");
  }
  await Scan.deleteOne({ _id: scan._id, userId });
  return { id: scan._id, deleted: true };
}

export async function purgeExpiredScans({ retentionDays, now = new Date(), batchSize = 100 }) {
  if (!Number.isInteger(retentionDays) || retentionDays < 1) throw new RangeError("retentionDays must be a positive integer");
  const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
  let deleted = 0;
  let failures = 0;
  while (true) {
    const scans = await Scan.find({ createdAt: { $lte: cutoff } })
      .sort({ createdAt: 1 })
      .limit(batchSize)
      .select("+image.storageKey userId")
      .lean();
    if (!scans.length) break;
    for (const scan of scans) {
      try {
        await getScanStorage().delete({ storageKey: scan.image.storageKey, userId: scan.userId });
        await Scan.deleteOne({ _id: scan._id });
        deleted += 1;
      } catch {
        failures += 1;
      }
    }
    if (scans.length < batchSize) break;
  }
  return { deleted, failures };
}
