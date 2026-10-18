import { Transaction } from "../models/Transaction.js";
import { listWalletsWithBalance } from "../services/balanceService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { startOfDay, startOfMonth } from "../utils/dates.js";

// Transfers are never included in spending or income totals.
export const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const tz = req.user.timezone;
  const now = new Date();

  const dayStart = startOfDay(tz, now);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const monthStart = startOfMonth(tz, now);
  const monthEnd = startOfMonth(tz, now, 1);

  const base = { userId, deletedAt: null, status: "confirmed" };
  const total = async (match) => {
    const rows = await Transaction.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    return rows[0]?.total ?? 0;
  };

  const [wallets, todaySpent, monthSpent, monthIncome, topCategories, recent] = await Promise.all([
    listWalletsWithBalance(userId),
    total({ ...base, type: "expense", txnDate: { $gte: dayStart, $lt: dayEnd } }),
    total({ ...base, type: "expense", txnDate: { $gte: monthStart, $lt: monthEnd } }),
    total({ ...base, type: "income", txnDate: { $gte: monthStart, $lt: monthEnd } }),
    Transaction.aggregate([
      { $match: { ...base, type: "expense", txnDate: { $gte: monthStart, $lt: monthEnd } } },
      { $group: { _id: "$categoryId", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
      { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
      {
        $project: {
          _id: 0,
          categoryId: "$_id",
          name: { $ifNull: [{ $first: "$category.name" }, "Uncategorized"] },
          icon: { $ifNull: [{ $first: "$category.icon" }, "📦"] },
          total: 1,
          count: 1,
        },
      },
    ]),
    Transaction.find({ ...base })
      .sort({ txnDate: -1, _id: -1 })
      .limit(5)
      .populate([
        { path: "categoryId", select: "name icon type" },
        { path: "walletId", select: "name type" },
      ]),
  ]);

  res.json({
    success: true,
    data: {
      totalBalance: wallets.reduce((sum, w) => sum + w.balance, 0),
      wallets,
      todaySpent,
      monthSpent,
      monthIncome,
      monthNet: monthIncome - monthSpent,
      topCategories,
      recent,
      period: { timezone: tz, monthStart, monthEnd },
    },
  });
});
