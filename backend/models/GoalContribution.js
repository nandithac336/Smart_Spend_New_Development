import mongoose from "mongoose";

const goalContributionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    goalId: { type: mongoose.Schema.Types.ObjectId, ref: "Goal", required: true },
    type: { type: String, enum: ["contribution", "withdrawal"], required: true },
    amount: { type: Number, required: true, min: 1, max: 10_000_000_000, validate: Number.isInteger },
    contributionDate: { type: Date, required: true, default: Date.now },
    note: { type: String, trim: true, maxlength: 300, default: "" },
  },
  { timestamps: true }
);

goalContributionSchema.index({ userId: 1, goalId: 1, contributionDate: -1, _id: -1 });

export const GoalContribution = mongoose.model("GoalContribution", goalContributionSchema);
