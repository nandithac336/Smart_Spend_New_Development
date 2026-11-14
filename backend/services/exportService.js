import PDFDocument from "pdfkit";
import { Types } from "mongoose";
import { Transaction } from "../models/Transaction.js";
import { getAnalyticsReport, resolveAnalyticsWindow } from "./analyticsService.js";

const csvColumns = [
  "Date",
  "Type",
  "Status",
  "Transfer direction",
  "Amount",
  "Merchant",
  "Category",
  "Wallet",
  "Note",
  "Payment method",
  "Source",
];

function csvCell(value) {
  let text = value == null ? "" : String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function formatCurrency(paise) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

function formatPdfCurrency(paise) {
  return `INR ${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100)}`;
}

function formatDate(value, timeZone) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h12",
  }).format(value);
}

function transactionPipeline(user, query = {}) {
  const window = resolveAnalyticsWindow(query, user);
  const match = {
    userId: new Types.ObjectId(String(user._id)),
    deletedAt: null,
    txnDate: { $gte: window.start, $lt: window.end },
  };
  if (query.type) match.type = query.type;
  if (query.categoryId) match.categoryId = new Types.ObjectId(query.categoryId);
  if (query.walletId) match.walletId = new Types.ObjectId(query.walletId);
  return [
    { $match: match },
    { $sort: { txnDate: 1, _id: 1 } },
    {
      $lookup: {
        from: "categories",
        let: { categoryId: "$categoryId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$categoryId"] },
                  { $or: [{ $eq: ["$userId", null] }, { $eq: ["$userId", new Types.ObjectId(String(user._id))] }] },
                ],
              },
            },
          },
          { $project: { name: 1 } },
        ],
        as: "category",
      },
    },
    {
      $lookup: {
        from: "wallets",
        let: { walletId: "$walletId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$walletId"] },
                  { $eq: ["$userId", new Types.ObjectId(String(user._id))] },
                ],
              },
            },
          },
          { $project: { name: 1 } },
        ],
        as: "wallet",
      },
    },
    {
      $project: {
        txnDate: 1,
        type: 1,
        status: 1,
        transferDirection: 1,
        amount: 1,
        merchant: 1,
        note: 1,
        paymentMethod: 1,
        source: 1,
        categoryName: { $ifNull: [{ $first: "$category.name" }, "Uncategorized"] },
        walletName: { $ifNull: [{ $first: "$wallet.name" }, "Wallet"] },
      },
    },
  ];
}

export async function* iterateTransactionCsvRows(user, query = {}) {
  const timeZone = query.timezone || user.timezone || "Asia/Kolkata";
  const cursor = Transaction.aggregate(transactionPipeline(user, query)).cursor({ batchSize: 500 });
  try {
    yield `${csvColumns.map(csvCell).join(",")}\r\n`;
    for await (const transaction of cursor) {
      const values = [
        formatDate(transaction.txnDate, timeZone),
        transaction.type,
        transaction.status,
        transaction.transferDirection,
        formatCurrency(transaction.amount),
        transaction.merchant,
        transaction.categoryName,
        transaction.walletName,
        transaction.note,
        transaction.paymentMethod,
        transaction.source,
      ];
      yield `${values.map(csvCell).join(",")}\r\n`;
    }
  } finally {
    await cursor.close();
  }
}

function pdfText(document, label, value) {
  document.font("Helvetica-Bold").text(`${label}: `, { continued: true });
  document.font("Helvetica").text(String(value));
}

export async function createTransactionPdfReport(user, query = {}) {
  const report = await getAnalyticsReport(user, query);
  const document = new PDFDocument({ size: "A4", margin: 48, info: { Title: "Smart Spend Financial Report" } });
  const chunks = [];
  const buffer = new Promise((resolve, reject) => {
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  document.fontSize(20).font("Helvetica-Bold").text("Smart Spend Financial Report");
  document.moveDown(0.5);
  document.fontSize(10).font("Helvetica");
  pdfText(document, "Reporting period", `${report.summary.period.startDate} to ${report.summary.period.endDate}`);
  pdfText(document, "Timezone", report.summary.period.timeZone);
  document.moveDown();

  document.fontSize(14).font("Helvetica-Bold").text("Financial summary");
  document.fontSize(10);
  pdfText(document, "Total income", formatPdfCurrency(report.summary.income));
  pdfText(document, "Total expenses", formatPdfCurrency(report.summary.expense));
  pdfText(document, "Net savings", formatPdfCurrency(report.summary.netSavings));
  pdfText(document, "Savings rate", `${report.summary.savingsRate}%`);
  pdfText(document, "Transactions", report.summary.transactionCount);
  pdfText(document, "Average transaction", formatPdfCurrency(report.summary.averageTransactionAmount));
  document.moveDown();

  document.fontSize(14).font("Helvetica-Bold").text("Expense categories");
  document.fontSize(10).font("Helvetica");
  if (report.categories.categories.length === 0) document.text("No expenses in this period.");
  for (const category of report.categories.categories.slice(0, 20)) {
    document.text(`${category.name}: ${formatPdfCurrency(category.total)} (${category.percentage}%)`);
  }
  document.moveDown();

  document.fontSize(14).font("Helvetica-Bold").text("Wallet activity");
  document.fontSize(10).font("Helvetica");
  if (report.wallets.wallets.length === 0) document.text("No wallet activity in this period.");
  for (const wallet of report.wallets.wallets.slice(0, 20)) {
    document.text(`${wallet.name}: income ${formatPdfCurrency(wallet.income)}, expenses ${formatPdfCurrency(wallet.expense)}`);
  }
  document.moveDown();

  document.fontSize(14).font("Helvetica-Bold").text("Monthly comparison");
  document.fontSize(10).font("Helvetica");
  for (const key of ["income", "expense", "netSavings"]) {
    const metric = report.comparison.metrics[key];
    const change = metric.percentageChange == null ? "n/a (no previous-period value)" : `${metric.percentageChange}%`;
    document.text(`${key}: ${formatPdfCurrency(metric.current)} vs ${formatPdfCurrency(metric.previous)} (${change})`);
  }
  document.moveDown();
  document.fontSize(8).fillColor("#666666").text("Generated from confirmed, non-trashed income and expense transactions. Transfers are excluded.");

  document.end();
  return buffer;
}

export { csvColumns, csvCell, formatCurrency, formatDate };
