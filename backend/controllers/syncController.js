import { asyncHandler } from "../utils/asyncHandler.js";
import { getSyncStatus, pullSyncChanges, pushSyncOperations } from "../services/syncService.js";

export const pushSync = asyncHandler(async (req, res) => {
  const result = await pushSyncOperations(req.user._id, req.validated.body);
  res.json({ success: true, data: result });
});

export const pullSync = asyncHandler(async (req, res) => {
  const result = await pullSyncChanges(req.user._id, req.validated.query);
  res.json({ success: true, data: result });
});

export const getSyncState = asyncHandler(async (req, res) => {
  const result = await getSyncStatus(req.user._id);
  res.json({ success: true, data: result });
});
