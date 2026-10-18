import mongoose from "mongoose";

// Money is always stored as integer paise (Rs 120.50 = 12050).
const walletSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    type: { type: String, enum: ["cash", "bank", "upi", "card"], required: true },
    openingBalance: { type: Number, default: 0, validate: Number.isInteger },
    isDefault: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

walletSchema.index({ userId: 1, name: 1 }, { unique: true });

export const Wallet = mongoose.model("Wallet", walletSchema);
