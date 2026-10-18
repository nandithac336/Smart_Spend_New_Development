import { Transaction } from "../models/Transaction.js";
import { Wallet } from "../models/Wallet.js";
import { Category } from "../models/Category.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { makeDedupeHash, toMerchantKey } from "../utils/merchant.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function assertWallet(userId, walletId) {
  const wallet = await Wallet.findOne({ _id: walletId, userId, archived: false });
  if (!wallet) throw ApiError.badRequest("Wallet not found");
}

async function assertCategory(userId, categoryId, type) {
  const category = await Category.findOne({ _id: categoryId, $or: [{ userId: null }, { userId }] });
  if (!category) throw ApiError.badRequest("Category not found");
  if (category.type !== type) throw ApiError.badRequest(`This is an ${category.type} category, not ${type}`);
}

const populateRefs = [
  { path: "categoryId", select: "name icon type" },
  { path: "walletId", select: "name type" },
];

// CREATE. Sending the same clientId twice returns the first record instead of a duplicate.
export const createTransaction = asyncHandler(async (req, res) => {
  const body = req.validated.body;
  const userId = req.user._id;

  await assertWallet(userId, body.walletId);
  if (body.categoryId) await assertCategory(userId, body.categoryId, body.type);

  const txnDate = body.txnDate ?? new Date();
  const merchantKey = toMerchantKey(body.merchant);

  try {
    const txn = await Transaction.create({
      ...body,
      userId,
      txnDate,
      capturedAt: new Date(),
      merchantKey,
      dedupeHash: makeDedupeHash({ userId, merchantKey, amount: body.amount, txnDate }),
      status: "confirmed",
    });
    res.status(201).json({ success: true, data: txn });
  } catch (err) {
    if (err?.code === 11000 && body.clientId) {
      const existing = await Transaction.findOne({ userId, clientId: body.clientId });
      return res.status(200).json({ success: true, data: existing, duplicate: true });
    }
    throw err;
  }
});

// READ ALL with filters, search and pagination
export const listTransactions = asyncHandler(async (req, res) => {
  const q = req.validated.query;
  const filter = { userId: req.user._id, deletedAt: null, status: "confirmed" };

  if (q.type) filter.type = q.type;
  if (q.walletId) filter.walletId = q.walletId;
  if (q.categoryId) filter.categoryId = q.categoryId;
  if (q.tag) filter.tags = q.tag;
  if (q.from || q.to) {
    filter.txnDate = {};
    if (q.from) filter.txnDate.$gte = q.from;
    if (q.to) filter.txnDate.$lte = q.to;
  }
  if (q.minAmount != null || q.maxAmount != null) {
    filter.amount = {};
    if (q.minAmount != null) filter.amount.$gte = q.minAmount;
    if (q.maxAmount != null) filter.amount.$lte = q.maxAmount;
  }
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), "i");
    filter.$or = [{ merchant: rx }, { note: rx }];
  }

  const [data, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ txnDate: -1, _id: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate(populateRefs),
    Transaction.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data,
    pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) },
  });
});

// READ ONE
export const getTransaction = asyncHandler(async (req, res) => {
  const txn = await Transaction.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: null }).populate(populateRefs);
  if (!txn) throw ApiError.notFound("Transaction not found");
  res.json({ success: true, data: txn });
});

// UPDATE (type cannot be changed; transfers cannot be edited)
export const updateTransaction = asyncHandler(async (req, res) => {
  const body = req.validated.body;
  const userId = req.user._id;

  const txn = await Transaction.findOne({ _id: req.params.id, userId, deletedAt: null });
  if (!txn) throw ApiError.notFound("Transaction not found");
  if (txn.type === "transfer") throw ApiError.badRequest("Transfers cannot be edited. Delete it and create a new one.");

  if (body.walletId) await assertWallet(userId, body.walletId);
  if (body.categoryId) await assertCategory(userId, body.categoryId, txn.type);

  Object.assign(txn, body);
  if ("merchant" in body) txn.merchantKey = toMerchantKey(txn.merchant);
  txn.dedupeHash = makeDedupeHash({ userId, merchantKey: txn.merchantKey, amount: txn.amount, txnDate: txn.txnDate });
  await txn.save();

  res.json({ success: true, data: await txn.populate(populateRefs) });
});

// DELETE = move to trash (both sides of a transfer go together)
export const deleteTransaction = asyncHandler(async (req, res) => {
  const txn = await Transaction.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: null });
  if (!txn) throw ApiError.notFound("Transaction not found");

  const filter = txn.transferPairId
    ? { userId: req.user._id, transferPairId: txn.transferPairId, deletedAt: null }
    : { _id: txn._id };
  await Transaction.updateMany(filter, { deletedAt: new Date() });

  res.json({ success: true, message: "Moved to trash", id: txn._id });
});

// UNDO DELETE
export const restoreTransaction = asyncHandler(async (req, res) => {
  const txn = await Transaction.findOne({ _id: req.params.id, userId: req.user._id, deletedAt: { $ne: null } });
  if (!txn) throw ApiError.notFound("Transaction not found in trash");

  const filter = txn.transferPairId
    ? { userId: req.user._id, transferPairId: txn.transferPairId, deletedAt: { $ne: null } }
    : { _id: txn._id };
  await Transaction.updateMany(filter, { deletedAt: null });

  res.json({ success: true, data: await Transaction.findById(txn._id).populate(populateRefs) });
});

// TRASH LIST
export const listTrash = asyncHandler(async (req, res) => {
  const data = await Transaction.find({ userId: req.user._id, deletedAt: { $ne: null } })
    .sort({ deletedAt: -1 })
    .limit(100)
    .populate(populateRefs);
  res.json({ success: true, data });
});
