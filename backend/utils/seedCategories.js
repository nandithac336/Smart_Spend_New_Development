import { Category } from "../models/Category.js";

const EXPENSE = [
  ["Food", "🍽️"], ["Groceries", "🛒"], ["Transport", "🚌"], ["Shopping", "🛍️"],
  ["Bills", "💡"], ["Rent", "🏠"], ["Health", "💊"], ["Education", "📚"],
  ["Entertainment", "🎬"], ["Travel", "✈️"], ["Subscriptions", "🔁"],
  ["Personal Care", "🧴"], ["Gifts", "🎁"], ["Unlogged Cash", "❓"], ["Other", "📦"],
];
const INCOME = [
  ["Salary", "💼"], ["Pocket Money", "👛"], ["Freelance", "💻"], ["Refund", "↩️"], ["Other Income", "💰"],
];

// Default categories have userId = null and are shared by every user. Safe to run on every start.
export async function seedDefaultCategories() {
  const ops = [
    ...EXPENSE.map(([name, icon]) => ({ name, icon, type: "expense" })),
    ...INCOME.map(([name, icon]) => ({ name, icon, type: "income" })),
  ].map((c) => ({
    updateOne: {
      filter: { userId: null, name: c.name, type: c.type },
      update: { $setOnInsert: { ...c, userId: null } },
      upsert: true,
    },
  }));
  await Category.bulkWrite(ops);
}
