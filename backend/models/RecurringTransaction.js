import mongoose from "mongoose";

const recurringTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    type: { type: String, enum: ["income", "expense"], required: true },
    amount: { type: Number, required: true, min: 1, max: 10_000_000_000, validate: Number.isInteger },
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet", required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    description: { type: String, trim: true, maxlength: 300, default: "" },
    frequency: { type: String, enum: ["daily", "weekly", "monthly", "yearly"], required: true },
    // Schedule dates are UTC-midnight encodings of the user's calendar dates.
    startDate: { type: Date, required: true },
    nextDueDate: {
      type: Date,
      required: true,
      validate: {
        validator(value) {
          return !this.startDate || value >= this.startDate;
        },
        message: "Next due date must be on or after the start date",
      },
    },
    endDate: {
      type: Date,
      default: null,
      validate: {
        validator(value) {
          return !value || !this.startDate || value >= this.startDate;
        },
        message: "End date must be on or after the start date",
      },
    },
    lastGeneratedDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ["active", "paused", "completed", "cancelled"],
      default: "active",
      required: true,
    },
  },
  { timestamps: true }
);

recurringTransactionSchema.index({ status: 1, nextDueDate: 1 });
recurringTransactionSchema.index({ userId: 1, status: 1, nextDueDate: 1 });
recurringTransactionSchema.index({ userId: 1, createdAt: -1 });
recurringTransactionSchema.index({ userId: 1, walletId: 1 });

export const RecurringTransaction = mongoose.model("RecurringTransaction", recurringTransactionSchema);
