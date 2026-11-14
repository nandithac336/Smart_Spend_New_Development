import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: [
        "budget_approaching",
        "budget_exceeded",
        "recurring_upcoming",
        "recurring_failed",
        "subscription_upcoming",
        "subscription_detected",
        "goal_reached",
        "goal_milestone",
        "anomaly_detected",
        "spending_increase",
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    relatedEntityType: {
      type: String,
      enum: ["budget", "recurring_transaction", "subscription", "goal", "anomaly", "user"],
      default: null,
    },
    relatedEntityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    severity: { type: String, enum: ["info", "warning", "high", "critical"], required: true },
    isRead: { type: Boolean, default: false, required: true },
    readAt: { type: Date, default: null },
    deduplicationKey: { type: String, required: true, maxlength: 200 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ userId: 1, deduplicationKey: 1 }, { unique: true });
notificationSchema.index({ userId: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, severity: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Notification = mongoose.model("Notification", notificationSchema);
