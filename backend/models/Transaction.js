import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", required: true },
    type: { type: String, enum: ["income", "expense", "transfer"], required: true },
    transferDirection: { type: String, enum: ["in", "out"] }, // only for type = transfer
    transferPairId: { type: mongoose.Schema.Types.ObjectId },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger }, // paise
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    merchant: { type: String, trim: true, maxlength: 80 },
    merchantKey: { type: String, index: true },
    note: { type: String, trim: true, maxlength: 300 },
    tags: { type: [String], default: [] },
    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "debit_card", "credit_card", "net_banking"],
      default: "cash",
    },
    txnDate: { type: Date, required: true, default: Date.now }, // when the purchase happened
    capturedAt: { type: Date, default: Date.now }, // when it was recorded in the app
    source: {
      type: String,
      enum: ["manual", "quickadd", "voice", "receipt", "screenshot", "statement", "sms", "recurring", "reconciliation", "transfer"],
      default: "manual",
    },
    status: { type: String, enum: ["confirmed", "pending_review"], default: "confirmed" },
    upiRef: { type: String },
    dedupeHash: { type: String },
    clientId: { type: String }, // UUID made on the device; makes retries and offline sync safe
    deletedAt: { type: Date, default: null }, // soft delete (trash)
  },
  { timestamps: true }
);

transactionSchema.index({ userId: 1, txnDate: -1 });
transactionSchema.index({ userId: 1, categoryId: 1, txnDate: -1 });
transactionSchema.index({ userId: 1, walletId: 1 });
transactionSchema.index({ userId: 1, deletedAt: 1 });
transactionSchema.index({ userId: 1, dedupeHash: 1 });
transactionSchema.index(
  { userId: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: "string" } } }
);

export const Transaction = mongoose.model("Transaction", transactionSchema);
