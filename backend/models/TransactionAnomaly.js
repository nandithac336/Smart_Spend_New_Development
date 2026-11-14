import mongoose from "mongoose";

const transactionAnomalySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", required: true },
    anomalyType: {
      type: String,
      enum: [
        "large_transaction",
        "duplicate_exact",
        "duplicate_possible",
        "new_merchant",
        "unusual_merchant_amount",
        "merchant_spending_increase",
        "high_frequency",
        "category_spending_increase",
        "category_amount_anomaly",
        "wallet_anomaly",
      ],
      required: true,
    },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], required: true },
    score: { type: Number, min: 0, max: 100, required: true },
    explanation: { type: String, required: true, maxlength: 300 },
    suggestedAction: { type: String, required: true, maxlength: 200 },
    evidence: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    detectionKey: { type: String, required: true, maxlength: 100 },
    status: { type: String, enum: ["new", "reviewed", "dismissed", "resolved"], default: "new", required: true },
    detectedAt: { type: Date, default: Date.now, required: true },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

transactionAnomalySchema.index(
  { userId: 1, transactionId: 1, anomalyType: 1, detectionKey: 1 },
  { unique: true }
);
transactionAnomalySchema.index({ userId: 1, status: 1, detectedAt: -1 });
transactionAnomalySchema.index({ userId: 1, severity: 1, detectedAt: -1 });
transactionAnomalySchema.index({ userId: 1, anomalyType: 1, detectedAt: -1 });

export const TransactionAnomaly = mongoose.model("TransactionAnomaly", transactionAnomalySchema);
