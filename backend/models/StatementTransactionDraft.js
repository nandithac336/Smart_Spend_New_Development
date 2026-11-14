import mongoose from "mongoose";

const statementTransactionDraftSchema = new mongoose.Schema(
  {
    importId: { type: mongoose.Schema.Types.ObjectId, ref: "BankStatementImport", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rowNumber: { type: Number, required: true, min: 1 },
    txnDate: { type: Date, default: null },
    description: { type: String, trim: true, maxlength: 300, default: null },
    amountPaise: {
      type: Number,
      min: 1,
      max: 10_000_000_000,
      validate: (value) => value == null || Number.isInteger(value),
      default: null,
    },
    direction: { type: String, enum: ["debit", "credit", null], default: null },
    transactionType: { type: String, enum: ["income", "expense", null], default: null },
    balancePaise: {
      type: Number,
      min: 0,
      max: 10_000_000_000,
      validate: (value) => value == null || Number.isInteger(value),
      default: null,
    },
    referenceNumber: { type: String, trim: true, maxlength: 100, default: null },
    suggestedCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    duplicateStatus: { type: String, enum: ["none", "possible"], default: "none" },
    duplicateMatches: {
      type: [{
        transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", required: true },
        matchType: { type: String, enum: ["reference", "amount_date_description", "amount_date"], required: true },
      }],
      default: [],
    },
    validationErrors: { type: [String], default: [] },
    reviewStatus: { type: String, enum: ["pending", "skipped", "imported"], default: "pending" },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    linkedTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
  },
  { timestamps: true }
);

statementTransactionDraftSchema.index({ importId: 1, rowNumber: 1 }, { unique: true });
statementTransactionDraftSchema.index({ userId: 1, importId: 1, reviewStatus: 1, txnDate: 1 });

export const StatementTransactionDraft = mongoose.model("StatementTransactionDraft", statementTransactionDraftSchema);
