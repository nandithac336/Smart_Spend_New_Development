import mongoose from "mongoose";

const merchantCategoryRuleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    merchant: { type: String, trim: true, required: true, maxlength: 80 },
    merchantKey: { type: String, required: true },
    transactionType: { type: String, enum: ["income", "expense"], required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
  },
  { timestamps: true }
);

merchantCategoryRuleSchema.index(
  { userId: 1, merchantKey: 1, transactionType: 1 },
  { unique: true }
);

export const MerchantCategoryRule = mongoose.model("MerchantCategoryRule", merchantCategoryRuleSchema);
