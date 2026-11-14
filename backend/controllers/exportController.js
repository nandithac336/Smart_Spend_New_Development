import { createTransactionPdfReport, iterateTransactionCsvRows } from "../services/exportService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { Category } from "../models/Category.js";
import { Wallet } from "../models/Wallet.js";

async function validateExportFilters(user, query) {
  if (query.walletId && !(await Wallet.exists({ _id: query.walletId, userId: user._id }))) {
    throw ApiError.badRequest("Wallet filter is invalid");
  }
  if (
    query.categoryId &&
    !(await Category.exists({
      _id: query.categoryId,
      $or: [{ userId: null }, { userId: user._id }],
    }))
  ) {
    throw ApiError.badRequest("Category filter is invalid");
  }
}

export const exportTransactionsCsv = asyncHandler(async (req, res) => {
  const query = req.validated.query;
  await validateExportFilters(req.user, query);
  const filename = `smart-spend-transactions-${query.startDate?.toISOString().slice(0, 10) || "period"}.csv`;
  res.status(200).set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  for await (const chunk of iterateTransactionCsvRows(req.user, query)) {
    if (!res.write(chunk)) {
      await new Promise((resolve, reject) => {
        const cleanup = () => {
          res.off("drain", onDrain);
          res.off("close", onClose);
          res.off("error", onError);
        };
        const onDrain = () => { cleanup(); resolve(); };
        const onClose = () => { cleanup(); resolve(); };
        const onError = (error) => { cleanup(); reject(error); };
        res.once("drain", onDrain);
        res.once("close", onClose);
        res.once("error", onError);
      });
    }
    if (res.destroyed) return;
  }
  res.end();
});

export const exportTransactionsPdf = asyncHandler(async (req, res) => {
  const query = req.validated.query;
  await validateExportFilters(req.user, query);
  const pdf = await createTransactionPdfReport(req.user, query);
  res.status(200).set({
    "Content-Type": "application/pdf",
    "Content-Disposition": 'attachment; filename="smart-spend-financial-report.pdf"',
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  }).send(pdf);
});
