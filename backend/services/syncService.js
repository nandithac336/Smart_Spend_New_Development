import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { Category } from "../models/Category.js";
import { SyncOperation } from "../models/SyncOperation.js";
import { Transaction } from "../models/Transaction.js";
import { Wallet } from "../models/Wallet.js";
import { ApiError } from "../utils/apiError.js";
import { makeDedupeHash, toMerchantKey } from "../utils/merchant.js";
import { pushSyncSchema, syncOperationSchema } from "../validators/schemas.js";
import { queueCategorizationForTransaction } from "./categorizationService.js";
import { makeSyncConflict, operationFingerprint, sameSyncVersion } from "./syncConflictService.js";

const MAX_OPERATION_BYTES = 16 * 1024;
const MAX_PULL_LIMIT = 100;

function documentSnapshot(document) {
  return document?.toObject ? document.toObject() : document;
}

function operationFailure(index, clientOperationId, code, message, details) {
  return {
    index,
    ...(typeof clientOperationId === "string" && { clientOperationId }),
    status: "failed",
    error: { code, message, ...(details && { details }) },
  };
}

function operationResponse(record, duplicate = false) {
  return {
    ...record.result,
    duplicate,
  };
}

function readPriorOperation(record, fingerprint) {
  if (record.fingerprint !== fingerprint) {
    return {
      clientOperationId: record.clientOperationId,
      entityId: String(record.entityId),
      status: "conflict",
      conflict: makeSyncConflict(
        "operation_id_reused",
        "This clientOperationId was already used for a different operation"
      ),
      duplicate: true,
    };
  }
  return operationResponse(record, true);
}

async function findOwnedReferences(userId, payload, transactionType, session) {
  const wallet = await Wallet.findOne({
    _id: payload.walletId,
    userId,
    archived: false,
  }).session(session).select("_id");
  if (!wallet) {
    return makeSyncConflict("wallet_unavailable", "The wallet is missing, archived, or not available to this user");
  }
  if (payload.categoryId) {
    const category = await Category.findOne({
      _id: payload.categoryId,
      type: transactionType,
      $or: [{ userId: null }, { userId }],
    }).session(session).select("_id");
    if (!category) {
      return makeSyncConflict("category_unavailable", "The category is missing, has a different type, or is not available to this user");
    }
  }
  return null;
}

async function saveOperationRecord({
  userId,
  operation,
  entityId,
  fingerprint,
  status,
  conflictDetails,
  result,
  session,
  now,
}) {
  await SyncOperation.create([{
    userId,
    clientOperationId: operation.clientOperationId,
    operationType: operation.operationType,
    entityType: operation.entityType,
    entityId,
    payload: operation.payload || {},
    clientTimestamp: operation.clientTimestamp,
    serverTimestamp: now,
    status,
    conflictDetails: conflictDetails || null,
    result,
    fingerprint,
    processedAt: now,
  }], { session });
}

function resultFromOperation(operation, entityId, status, data, conflict) {
  return {
    clientOperationId: operation.clientOperationId,
    entityId: String(entityId),
    status,
    ...(data && { data }),
    ...(conflict && { conflict }),
  };
}

async function processValidatedOperation(userId, operation, fingerprint) {
  const prior = await SyncOperation.findOne({ userId, clientOperationId: operation.clientOperationId }).lean();
  if (prior) return readPriorOperation(prior, fingerprint);

  const session = await SyncOperation.startSession();
  const serverTimestamp = new Date();
  const createId = operation.operationType === "create" ? new Types.ObjectId() : null;
  let response;
  try {
    await session.withTransaction(async () => {
      let entityId = operation.entityId ? new Types.ObjectId(operation.entityId) : createId;
      let status = "processed";
      let data;
      let conflict;

      if (operation.operationType === "create") {
        conflict = await findOwnedReferences(userId, operation.payload, operation.payload.type, session);
        if (!conflict) {
          const existingClientId = await Transaction.findOne({
            userId,
            clientId: operation.clientOperationId,
          }).session(session);
          if (existingClientId) {
            entityId = existingClientId._id;
            conflict = makeSyncConflict(
              "duplicate_creation",
              "A transaction already uses this client operation id",
              documentSnapshot(existingClientId)
            );
          } else {
            const merchantKey = toMerchantKey(operation.payload.merchant);
            const [transaction] = await Transaction.create([{
              ...operation.payload,
              _id: entityId,
              userId,
              clientId: operation.clientOperationId,
              merchantKey,
              dedupeHash: makeDedupeHash({
                userId,
                merchantKey,
                amount: operation.payload.amount,
                txnDate: operation.payload.txnDate || serverTimestamp,
              }),
              txnDate: operation.payload.txnDate || serverTimestamp,
              capturedAt: serverTimestamp,
              status: "confirmed",
            }], { session });
            data = documentSnapshot(transaction);
          }
        }
      } else {
        const transaction = await Transaction.findOne({ _id: entityId, userId }).session(session);
        if (!transaction) {
          conflict = makeSyncConflict("entity_not_found", "The transaction is no longer available to this user");
        } else if (transaction.deletedAt) {
          conflict = makeSyncConflict("deleted_entity", "The transaction was deleted on the server", documentSnapshot(transaction));
        } else if (transaction.type === "transfer" && operation.operationType === "update") {
          conflict = makeSyncConflict("unsupported_transfer_update", "Transfers cannot be edited; delete the transfer pair and create a new one");
        } else if (!sameSyncVersion(transaction.updatedAt, operation.baseUpdatedAt)) {
          conflict = makeSyncConflict("stale_update", "The transaction changed after this device last synchronized", documentSnapshot(transaction));
        } else if (operation.operationType === "update") {
          const nextPayload = { ...operation.payload };
          if (nextPayload.walletId || nextPayload.categoryId) {
            const references = {
              walletId: nextPayload.walletId || transaction.walletId,
              categoryId: "categoryId" in nextPayload ? nextPayload.categoryId : transaction.categoryId,
            };
            const referenceConflict = await findOwnedReferences(
              userId,
              references,
              transaction.type,
              session
            );
            if (referenceConflict) conflict = referenceConflict;
          }
          if (!conflict) {
            Object.assign(transaction, nextPayload);
            transaction.merchantKey = toMerchantKey(transaction.merchant);
            transaction.dedupeHash = makeDedupeHash({
              userId,
              merchantKey: transaction.merchantKey,
              amount: transaction.amount,
              txnDate: transaction.txnDate,
            });
            await transaction.save({ session });
            data = documentSnapshot(transaction);
          }
        } else if (transaction.type === "transfer") {
          const deletedAt = serverTimestamp;
          await Transaction.updateMany(
            { userId, transferPairId: transaction.transferPairId, deletedAt: null },
            { $set: { deletedAt, updatedAt: deletedAt } },
            { session, timestamps: false }
          );
          data = { id: String(transaction._id), deletedAt, entityIds: [String(transaction._id)] };
        } else {
          transaction.deletedAt = serverTimestamp;
          await transaction.save({ session });
          data = documentSnapshot(transaction);
        }
      }

      if (conflict) status = "conflict";
      response = resultFromOperation(operation, entityId, status, data, conflict);
      await saveOperationRecord({
        userId,
        operation,
        entityId,
        fingerprint,
        status,
        conflictDetails: conflict,
        result: response,
        session,
        now: serverTimestamp,
      });
    });
    return response;
  } catch (error) {
    if (error?.code === 11000) {
      const saved = await SyncOperation.findOne({
        userId,
        clientOperationId: operation.clientOperationId,
      }).lean();
      if (saved) return readPriorOperation(saved, fingerprint);
      const transaction = operation.operationType === "create"
        ? await Transaction.findOne({ userId, clientId: operation.clientOperationId }).lean()
        : null;
      if (transaction) {
        return {
          clientOperationId: operation.clientOperationId,
          entityId: String(transaction._id),
          status: "conflict",
          conflict: makeSyncConflict("duplicate_creation", "A transaction already uses this client operation id", transaction),
          duplicate: false,
        };
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function pushSyncOperations(userId, request) {
  const batch = pushSyncSchema.safeParse(request);
  if (!batch.success) {
    throw ApiError.badRequest("Invalid sync batch", batch.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })));
  }

  const results = [];
  for (const [index, rawOperation] of batch.data.operations.entries()) {
    let rawSize;
    try {
      rawSize = Buffer.byteLength(JSON.stringify(rawOperation) ?? "");
    } catch {
      rawSize = MAX_OPERATION_BYTES + 1;
    }
    if (rawSize > MAX_OPERATION_BYTES) {
      results.push(operationFailure(index, rawOperation?.clientOperationId, "PAYLOAD_TOO_LARGE", "Each sync operation must be 16 KB or smaller"));
      continue;
    }

    const parsed = syncOperationSchema.safeParse(rawOperation);
    if (!parsed.success) {
      results.push(operationFailure(
        index,
        rawOperation?.clientOperationId,
        "VALIDATION_ERROR",
        "Sync operation is invalid",
        parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }))
      ));
      continue;
    }

    const operation = parsed.data;
    const fingerprint = operationFingerprint(operation, createHash);
    try {
      const result = await processValidatedOperation(userId, operation, fingerprint);
      results.push({ index, ...result });
      if (operation.operationType === "create" && result.status === "processed" && !result.duplicate) {
        queueCategorizationForTransaction(result.data);
      }
    } catch {
      results.push(operationFailure(
        index,
        operation.clientOperationId,
        "SYNC_PROCESSING_FAILED",
        "The operation was not committed; it is safe to retry with the same clientOperationId"
      ));
    }
  }
  return { results };
}

function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      value?.v !== 1
      || typeof value.watermark !== "string"
      || Number.isNaN(Date.parse(value.watermark))
      || (value.from !== null && (typeof value.from !== "string" || Number.isNaN(Date.parse(value.from))))
      || (value.afterUpdatedAt !== null && (typeof value.afterUpdatedAt !== "string" || Number.isNaN(Date.parse(value.afterUpdatedAt))))
      || (value.afterId !== null && !/^[0-9a-f]{24}$/i.test(value.afterId))
      || typeof value.complete !== "boolean"
    ) return null;
    return value;
  } catch {
    return null;
  }
}

export async function pullSyncChanges(userId, { cursor, limit }) {
  const decoded = decodeCursor(cursor);
  if (cursor && !decoded) throw ApiError.badRequest("Invalid sync cursor");

  const now = new Date();
  const isNewWindow = !decoded || decoded.complete;
  const watermark = isNewWindow ? now : new Date(decoded.watermark);
  const from = !decoded
    ? null
    : isNewWindow
      ? new Date(decoded.watermark)
      : decoded.from === null
        ? null
        : new Date(decoded.from);
  const afterUpdatedAt = isNewWindow || !decoded?.afterUpdatedAt ? null : new Date(decoded.afterUpdatedAt);
  const afterId = isNewWindow ? null : decoded?.afterId;

  const filter = {
    userId,
    updatedAt: { $lte: watermark, ...(from && { $gte: from }) },
  };
  if (afterUpdatedAt && afterId) {
    filter.$or = [
      { updatedAt: { $gt: afterUpdatedAt, $lte: watermark } },
      { updatedAt: afterUpdatedAt, _id: { $gt: new Types.ObjectId(afterId) } },
    ];
  }

  const documents = await Transaction.find(filter)
    .sort({ updatedAt: 1, _id: 1 })
    .limit(Math.min(limit, MAX_PULL_LIMIT) + 1)
    .lean();
  const hasMore = documents.length > limit;
  const page = hasMore ? documents.slice(0, limit) : documents;
  const last = page.at(-1);
  const nextCursor = hasMore
    ? encodeCursor({
      v: 1,
      from: from?.toISOString() ?? null,
      watermark: watermark.toISOString(),
      afterUpdatedAt: last.updatedAt.toISOString(),
      afterId: String(last._id),
      complete: false,
    })
    : encodeCursor({
      v: 1,
      from: watermark.toISOString(),
      watermark: watermark.toISOString(),
      afterUpdatedAt: null,
      afterId: null,
      complete: true,
    });

  return {
    changes: page.map((transaction) => ({
      entityType: "transaction",
      entityId: String(transaction._id),
      operationType: transaction.deletedAt ? "delete" : "upsert",
      deletedAt: transaction.deletedAt,
      data: transaction,
    })),
    pagination: { limit, hasMore, nextCursor },
    serverTime: watermark,
  };
}

export async function getSyncStatus(userId) {
  const [latestChange, processedOperations, conflictedOperations] = await Promise.all([
    Transaction.findOne({ userId }).sort({ updatedAt: -1, _id: -1 }).select("updatedAt").lean(),
    SyncOperation.countDocuments({ userId, status: "processed" }),
    SyncOperation.countDocuments({ userId, status: "conflict" }),
  ]);
  return {
    latestChangeAt: latestChange?.updatedAt || null,
    processedOperations,
    conflictedOperations,
    serverTime: new Date(),
  };
}
