import mongoose from "mongoose";
import { Wallet } from "../models/Wallet.js";
import { Transaction } from "../models/Transaction.js";
import { listWalletsWithBalance } from "../services/balanceService.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listWallets = asyncHandler(async (req, res) => {
  const includeArchived = req.validated.query.includeArchived === "true";
  const wallets = await listWalletsWithBalance(req.user._id, { includeArchived });
  const totalBalance = wallets.filter((w) => !w.archived).reduce((sum, w) => sum + w.balance, 0);
  res.json({ success: true, data: wallets, totalBalance });
});

export const createWallet = asyncHandler(async (req, res) => {
  const wallet = await Wallet.create({ ...req.validated.body, userId: req.user._id });
  res.status(201).json({ success: true, data: { ...wallet.toObject(), id: wallet._id, balance: wallet.openingBalance } });
});

export const updateWallet = asyncHandler(async (req, res) => {
  const wallet = await Wallet.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    req.validated.body,
    { new: true, runValidators: true }
  );
  if (!wallet) throw ApiError.notFound("Wallet not found");
  res.json({ success: true, data: wallet });
});

// "Delete" archives the wallet so old transactions keep working.
export const archiveWallet = asyncHandler(async (req, res) => {
  const wallet = await Wallet.findOne({ _id: req.params.id, userId: req.user._id });
  if (!wallet) throw ApiError.notFound("Wallet not found");
  if (wallet.isDefault) throw ApiError.badRequest("The default wallet cannot be archived");
  wallet.archived = true;
  await wallet.save();
  res.json({ success: true, message: "Wallet archived" });
});

// Moves money between two of the user's wallets. Not counted as income or spending.
export const transfer = asyncHandler(async (req, res) => {
  const { fromWalletId, toWalletId, amount, note, txnDate } = req.validated.body;
  const userId = req.user._id;

  if (fromWalletId === toWalletId) throw ApiError.badRequest("Choose two different wallets");

  const wallets = await Wallet.find({ _id: { $in: [fromWalletId, toWalletId] }, userId, archived: false });
  if (wallets.length !== 2) throw ApiError.badRequest("Wallet not found");

  const pairId = new mongoose.Types.ObjectId();
  const when = txnDate ?? new Date();
  const base = { userId, type: "transfer", transferPairId: pairId, amount, note, txnDate: when, source: "transfer" };

  // Both sides are saved together or not at all (needs MongoDB Atlas or a replica set).
  const session = await mongoose.startSession();
  let docs;
  try {
    await session.withTransaction(async () => {
      docs = await Transaction.create(
        [
          { ...base, walletId: fromWalletId, transferDirection: "out" },
          { ...base, walletId: toWalletId, transferDirection: "in" },
        ],
        { session, ordered: true }
      );
    });
  } finally {
    await session.endSession();
  }

  res.status(201).json({ success: true, data: { transferPairId: pairId, out: docs[0], in: docs[1] } });
});
