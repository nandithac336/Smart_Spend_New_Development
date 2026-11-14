function idOf(record) {
  return record?.id ?? record?._id
}

export function buildQuickAddFavorites(transactions) {
  const counts = new Map()
  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || !transaction.merchant?.trim()) continue
    const category = transaction.categoryId
    const categoryId = idOf(category)
    if (!categoryId) continue
    const merchant = transaction.merchant.trim()
    const key = `${merchant.toLocaleLowerCase()}|${transaction.amount}|${categoryId}`
    const existing = counts.get(key)
    if (existing) {
      existing.count += 1
    } else {
      counts.set(key, {
        key,
        count: 1,
        amount: Number(transaction.amount),
        merchant,
        categoryId,
        categoryName: category.name ?? 'Expense',
        categoryIcon: category.icon ?? '📦',
      })
    }
  }

  return [...counts.values()]
    .filter((favorite) => favorite.count >= 2)
    .sort((left, right) => right.count - left.count)
    .slice(0, 5)
}
