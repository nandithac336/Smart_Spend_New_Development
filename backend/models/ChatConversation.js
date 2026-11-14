import mongoose from "mongoose";

const chatConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, trim: true, maxlength: 80, default: "New conversation" },
    status: { type: String, enum: ["active", "archived"], default: "active", required: true },
  },
  { timestamps: true }
);

chatConversationSchema.index({ userId: 1, updatedAt: -1 });

export const ChatConversation = mongoose.model("ChatConversation", chatConversationSchema);
