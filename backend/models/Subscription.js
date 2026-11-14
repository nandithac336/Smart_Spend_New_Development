import mongoose from "mongoose";

const paymentEvidenceSchema = new mongoose.Schema(
  {
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", required: true },
    paidAt: { type: Date, required: true },
    amountPaise: { type: Number, required: true, min: 1, validate: Number.isInteger },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
  },
  { _id: false }
);

const detectionEvidenceSchema = new mongoose.Schema(
  {
    transactionCount: { type: Number, required: true, min: 2 },
    intervalsDays: { type: [Number], default: [] },
    matchedIntervals: { type: Number, required: true, min: 1 },
    intervalConsistencyPercent: { type: Number, required: true, min: 0, max: 100 },
    amountVariationPercent: { type: Number, required: true, min: 0, max: 100 },
    merchantIdentityConsistencyPercent: { type: Number, default: 100, min: 0, max: 100 },
    averageIntervalDays: { type: Number, required: true, min: 1 },
    payments: { type: [paymentEvidenceSchema], default: [] },
    historyTruncated: { type: Boolean, default: false },
    detectedAt: { type: Date, required: true },
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    merchantName: { type: String, required: true, trim: true, maxlength: 120 },
    normalizedMerchant: { type: String, required: true, trim: true, maxlength: 120 },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    averageAmountPaise: { type: Number, required: true, min: 1, max: 10_000_000_000, validate: Number.isInteger },
    lastPaymentDate: { type: Date, required: true },
    estimatedNextPaymentDate: { type: Date, required: true },
    frequency: { type: String, enum: ["weekly", "monthly", "quarterly", "annual"], required: true },
    confidenceScore: { type: Number, required: true, min: 0, max: 100 },
    confidenceLevel: { type: String, enum: ["low", "medium", "high"], required: true },
    detectionEvidence: { type: detectionEvidenceSchema, required: true },
    status: {
      type: String,
      enum: ["detected", "confirmed", "dismissed", "cancelled"],
      default: "detected",
      required: true,
    },
  },
  { timestamps: true }
);

subscriptionSchema.index(
  { userId: 1, normalizedMerchant: 1, frequency: 1 },
  { unique: true }
);
subscriptionSchema.index({ userId: 1, status: 1, updatedAt: -1 });
subscriptionSchema.index({ userId: 1, status: 1, estimatedNextPaymentDate: 1 });
subscriptionSchema.index({ userId: 1, frequency: 1, confidenceLevel: 1 });

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
