import mongoose from "mongoose";

const bankStatementImportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", required: true },
    file: {
      storageKey: { type: String, required: true, select: false },
      format: { type: String, enum: ["csv", "xlsx", "pdf"], required: true },
      size: { type: Number, required: true, min: 1, max: 10 * 1024 * 1024 },
      originalName: { type: String, required: true, maxlength: 120 },
    },
    bankName: { type: String, trim: true, maxlength: 80, default: null },
    statementRange: {
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
    },
    status: {
      type: String,
      enum: ["processing", "review", "partially_imported", "completed", "failed"],
      default: "processing",
      required: true,
    },
    parsedTransactionCount: { type: Number, min: 0, default: 0 },
    duplicateCount: { type: Number, min: 0, default: 0 },
    importedCount: { type: Number, min: 0, default: 0 },
    errorDetails: {
      code: { type: String, default: null },
      message: { type: String, default: null },
    },
  },
  { timestamps: true }
);

bankStatementImportSchema.index({ userId: 1, createdAt: -1 });
bankStatementImportSchema.index({ createdAt: 1 });
bankStatementImportSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const BankStatementImport = mongoose.model("BankStatementImport", bankStatementImportSchema);
