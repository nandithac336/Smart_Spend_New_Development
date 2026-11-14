import mongoose from "mongoose";

const syncOperationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    clientOperationId: { type: String, required: true, maxlength: 36 },
    operationType: { type: String, enum: ["create", "update", "delete"], required: true },
    entityType: { type: String, enum: ["transaction"], required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    clientTimestamp: { type: Date, required: true },
    serverTimestamp: { type: Date, required: true },
    status: { type: String, enum: ["processed", "conflict"], required: true },
    conflictDetails: { type: mongoose.Schema.Types.Mixed, default: null },
    result: { type: mongoose.Schema.Types.Mixed, required: true },
    fingerprint: { type: String, required: true, maxlength: 64 },
    processedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

syncOperationSchema.index({ userId: 1, clientOperationId: 1 }, { unique: true });
syncOperationSchema.index({ userId: 1, serverTimestamp: -1 });
syncOperationSchema.index({ userId: 1, status: 1, processedAt: -1 });

export const SyncOperation = mongoose.model("SyncOperation", syncOperationSchema);
