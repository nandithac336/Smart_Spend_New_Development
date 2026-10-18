import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    userType: {
      type: String,
      enum: ["student", "professional", "homemaker", "family", "business", "other"],
      default: "other",
    },
    currency: { type: String, default: "INR" },
    language: { type: String, enum: ["en", "hi", "kn"], default: "en" },
    timezone: { type: String, default: "Asia/Kolkata" },
    settings: {
      autoSaveHighConfidence: { type: Boolean, default: false },
      confidenceThreshold: { type: Number, default: 0.85 },
      reminderTime: { type: String, default: "21:00" },
      simpleMode: { type: Boolean, default: false },
    },
    refreshTokenHash: { type: String, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.refreshTokenHash;
        return ret;
      },
    },
  }
);

export const User = mongoose.model("User", userSchema);
