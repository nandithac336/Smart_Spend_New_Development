import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 120, default: null },
    amountPaise: {
      type: Number,
      min: 0,
      max: 10_000_000_000,
      validate: (value) => value == null || Number.isInteger(value),
      default: null,
    },
  },
  { _id: false }
);

const scanSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["receipt", "upi"], required: true },
    image: {
      storageKey: { type: String, required: true, select: false },
      mimeType: { type: String, enum: ["image/jpeg", "image/png", "image/webp"], required: true },
      size: { type: Number, required: true, min: 1, max: 5 * 1024 * 1024 },
    },
    extractionStatus: {
      type: String,
      enum: ["processing", "ready", "failed", "confirmed"],
      default: "processing",
      required: true,
    },
    extractedFields: {
      merchant: { type: String, default: null },
      transactionDate: { type: Date, default: null },
      amountPaise: {
        type: Number,
        min: 1,
        max: 10_000_000_000,
        validate: (value) => value == null || Number.isInteger(value),
        default: null,
      },
      currency: { type: String, maxlength: 3, default: null },
      taxPaise: {
        type: Number,
        min: 0,
        max: 10_000_000_000,
        validate: (value) => value == null || Number.isInteger(value),
        default: null,
      },
      items: { type: [itemSchema], default: [] },
      upiRef: { type: String, maxlength: 100, default: null },
      paymentStatus: { type: String, enum: ["success", "failed", "pending", "unknown", null], default: null },
      paymentDirection: { type: String, enum: ["in", "out", null], default: null },
      transactionType: { type: String, enum: ["income", "expense", null], default: null },
    },
    draftFields: {
      merchant: { type: String, trim: true, maxlength: 80, default: null },
      transactionDate: { type: Date, default: null },
      amountPaise: {
        type: Number,
        min: 1,
        max: 10_000_000_000,
        validate: (value) => value == null || Number.isInteger(value),
        default: null,
      },
      currency: { type: String, maxlength: 3, default: null },
      taxPaise: {
        type: Number,
        min: 0,
        max: 10_000_000_000,
        validate: (value) => value == null || Number.isInteger(value),
        default: null,
      },
      items: { type: [itemSchema], default: [] },
      upiRef: { type: String, trim: true, maxlength: 100, default: null },
      paymentStatus: { type: String, enum: ["success", "failed", "pending", "unknown", null], default: null },
      paymentDirection: { type: String, enum: ["in", "out", null], default: null },
      transactionType: { type: String, enum: ["income", "expense", null], default: null },
    },
    confidence: {
      overall: { type: Number, min: 0, max: 1, default: null },
      fields: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    warnings: { type: [String], default: [] },
    possibleDuplicates: {
      type: [
        {
          transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
          txnDate: Date,
          amountPaise: Number,
          merchant: String,
          matchType: { type: String, enum: ["upi_reference", "amount_date_merchant", "amount_date"] },
        },
      ],
      default: [],
    },
    processingError: {
      code: { type: String, default: null },
      message: { type: String, default: null },
    },
    linkedTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
    confirmationClientId: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

scanSchema.index({ userId:  1, createdAt: -1 });
scanSchema.index({ userId: 1, extractionStatus: 1, createdAt: -1 });
scanSchema.index({ createdAt: 1 });

export const Scan = mongoose.model("Scan", scanSchema);
