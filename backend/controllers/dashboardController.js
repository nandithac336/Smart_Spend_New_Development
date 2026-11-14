import { Transaction } from "../models/Transaction.js";
import { listWalletsWithBalance } from "../services/balanceService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { startOfDay, startOfLocalDate } from "../utils/dates.js";

// Transfers are never included in spending or income totals.
export const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const tz = req.user.timezone;
  const now = new Date();

  const requestedDate = req.validated.query.date;
  const localToday = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map(({ type, value }) => [type, value])
  );
  const selectedDateText = requestedDate
    ? requestedDate.toISOString().slice(0, 10)
    : `${localToday.year}-${localToday.month}-${localToday.day}`;
  const selectedDate = new Date(`${selectedDateText}T00:00:00.000Z`);
  const selectedParts = {
    year: selectedDate.getUTCFullYear(),
    month: selectedDate.getUTCMonth(),
    day: selectedDate.getUTCDate(),
  };
  const dayStart = startOfLocalDate(tz, selectedDate);
  const dayEnd = startOfLocalDate(
    tz,
    new Date(Date.UTC(selectedParts.year, selectedParts.month, selectedParts.day + 1))
  );
  const monthStart = startOfLocalDate(tz, new Date(Date.UTC(selectedParts.year, selectedParts.month, 1)));
  const monthEnd = startOfLocalDate(tz, new Date(Date.UTC(selectedParts.year, selectedParts.month + 1, 1)));
  const todayStart = startOfDay(tz, now);
  const todayEnd = startOfDay(tz, now, 1);

  const base = { userId, deletedAt: null, status: "confirmed" };
  const monthExpenseFilter = {
    ...base,
    type: "expense",
    txnDate: { $gte: monthStart, $lt: monthEnd },
  };
  const total = async (match) => {
    const rows = await Transaction.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    return rows[0]?.total ?? 0;
  };

  const [wallets, todaySpent, selectedDateSpent, monthSpent, monthIncome, topCategories, recent, monthExpenses] = await Promise.all([
    listWalletsWithBalance(userId),
    total({ ...base, type: "expense", txnDate: { $gte: todayStart, $lt: todayEnd } }),
    total({ ...base, type: "expense", txnDate: { $gte: dayStart, $lt: dayEnd } }),
    total(monthExpenseFilter),
    total({ ...base, type: "income", txnDate: { $gte: monthStart, $lt: monthEnd } }),
    Transaction.aggregate([
      { $match: monthExpenseFilter },
      { $group: { _id: "$categoryId", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
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
    Transaction.find(monthExpenseFilter)
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
      selectedDateSpent,
      monthSpent,
      monthIncome,
      monthNet: monthIncome - monthSpent,
      topCategories,
      recent,
      monthExpenses,
      period: { timezone: tz, monthStart, monthEnd, selectedDate: selectedDateText },
    },
  });
});
