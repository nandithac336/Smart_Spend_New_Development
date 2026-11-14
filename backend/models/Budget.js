import mongoose from "mongoose";

const budgetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    amount: { type: Number, required: true, min: 1, max: 10_000_000_000, validate: Number.isInteger },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    period: { type: String, enum: ["weekly", "monthly", "yearly", "custom"], required: true },
    // Date fields represent user-calendar dates stored at UTC midnight.
    startDate: { type: Date, required: true },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator(value) {
          return !this.startDate || value >= this.startDate;
        },
        message: "End date must be on or after start date",
      },
    },
    status: { type: String, enum: ["active", "archived"], default: "active", required: true },
  },
  { timestamps: true }
);

budgetSchema.index({ userId: 1, status: 1, startDate: 1, endDate: 1 });
budgetSchema.index(
  { userId: 1, categoryId: 1, period: 1, startDate: 1, endDate: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

export const Budget = mongoose.model("Budget", budgetSchema);
