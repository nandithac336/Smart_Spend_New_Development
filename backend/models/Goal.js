import mongoose from "mongoose";

const goalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    targetAmount: {
      type: Number,
      required: true,
      min: 1,
      max: 10_000_000_000,
      validate: [
        Number.isInteger,
        {
          validator(value) {
            return this.savedAmount === undefined || value >= this.savedAmount;
          },
          message: "Target amount cannot be less than the saved amount",
        },
      ],
    },
    savedAmount: {
      type: Number,
      required: true,
      min: 0,
      max: 10_000_000_000,
      validate: [
        Number.isInteger,
        {
          validator(value) {
            return this.targetAmount === undefined || value <= this.targetAmount;
          },
          message: "Saved amount cannot exceed the target amount",
        },
      ],
      default: 0,
    },
    targetDate: { type: Date, required: true },
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", default: null },
    status: {
      type: String,
      enum: ["active", "completed", "paused", "archived"],
      default: "active",
      required: true,
    },
  },
  { timestamps: true }
);

goalSchema.index({ userId: 1, status: 1, targetDate: 1 });
goalSchema.index({ userId: 1, walletId: 1 });

export const Goal = mongoose.model("Goal", goalSchema);
