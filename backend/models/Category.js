import mongoose from "mongoose";

// userId = null means a default category visible to everyone.
const categorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    icon: { type: String, default: "📦" },
    color: { type: String },
    type: { type: String, enum: ["expense", "income"], required: true },
  },
  { timestamps: true }
);

categorySchema.index({ userId: 1, name: 1, type: 1 }, { unique: true });

export const Category = mongoose.model("Category", categorySchema);
