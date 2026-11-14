import { Transaction } from "../models/Transaction.js";
import { Wallet } from "../models/Wallet.js";

// Wallet balance = openingBalance + income - expense + transfers in - transfers out.
// Only confirmed, non-deleted transactions count.
export async function getWalletDeltas(userId) {
  const rows = await Transaction.aggregate([
    { $match: { userId, deletedAt: null, status: "confirmed" } },
    {
      $group: {
        _id: "$walletId",
        delta: {
          $sum: {
            $switch: {
              branches: [
                { case: { $eq: ["$type", "income"] }, then: "$amount" },
                { case: { $eq: ["$type", "expense"] }, then: { $multiply: ["$amount", -1] } },
                {
                  case: { $and: [{ $eq: ["$type", "transfer"] }, { $eq: ["$transferDirection", "in"] }] },
                  then: "$amount",
                },
                {
                  case: { $and: [{ $eq: ["$type", "transfer"] }, { $eq: ["$transferDirection", "out"] }] },
                  then: { $multiply: ["$amount", -1] },
                },
              ],
              default: 0,
            },
          },
        },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.delta]));
}

export async function listWalletsWithBalance(userId, { includeArchived = false, limit } = {}) {
  const filter = { userId };
  if (!includeArchived) filter.archived = false;
  let walletQuery = Wallet.find(filter).sort({ isDefault: -1, createdAt: 1 });
  if (Number.isInteger(limit) && limit > 0) walletQuery = walletQuery.limit(limit);
  const [wallets, deltas] = await Promise.all([
    walletQuery.lean(),
    getWalletDeltas(userId),
  ]);
  return wallets.map((w) => ({
    ...w,
    id: w._id,
    balance: w.openingBalance + (deltas.get(String(w._id)) ?? 0),
  }));
}
