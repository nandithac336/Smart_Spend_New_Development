import mongoose from "mongoose";

const categorySuggestionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", required: true },
    transactionType: { type: String, enum: ["income", "expense"], required: true },
    merchantKey: { type: String, default: "" },
    detectedMerchant: { type: String, default: null, maxlength: 80 },
    suggestedCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    confidence: { type: Number, min: 0, max: 1, required: true },
    confidenceLevel: { type: String, enum: ["high", "medium", "low"], required: true },
    source: { type: String, enum: ["user_rule", "keyword_rule", "history", "ai", "none"], required: true },
    explanation: { type: String, maxlength: 300, default: "" },
    alternatives: {
      type: [{
        categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
        confidence: { type: Number, min: 0, max: 1, required: true },
        explanation: { type: String, maxlength: 200, default: "" },
      }],
      default: [],
    },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
    reviewedCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
  },
  { timestamps: true }
);

categorySuggestionSchema.index({ userId: 1, transactionId: 1 }, { unique: true });
categorySuggestionSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const CategorySuggestion = mongoose.model("CategorySuggestion", categorySuggestionSchema);
