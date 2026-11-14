import { asyncHandler } from "../utils/asyncHandler.js";
import {
  confirmScan,
  createScan,
  deleteOwnedScan,
  getOwnedScan,
  listScans,
  updateScanDraft,
} from "../services/scanService.js";

export const uploadReceiptScan = asyncHandler(async (req, res) => {
  const scan = await createScan({ user: req.user, type: "receipt", file: req.file });
  res.status(201).json({ success: true, data: scan });
});

export const uploadUpiScan = asyncHandler(async (req, res) => {
  const scan = await createScan({ user: req.user, type: "upi", file: req.file });
  res.status(201).json({ success: true, data: scan });
});

export const listUserScans = asyncHandler(async (req, res) => {
  const result = await listScans(req.user._id, req.validated.query);
  res.json({ success: true, ...result });
});

export const getUserScan = asyncHandler(async (req, res) => {
  const scan = await getOwnedScan(req.user._id, req.validated.params.id);
  res.json({ success: true, data: scan });
});

export const patchUserScan = asyncHandler(async (req, res) => {
  const scan = await updateScanDraft(
    req.user._id,
    req.validated.params.id,
    req.validated.body
  );
  res.json({ success: true, data: scan });
});

export const confirmUserScan = asyncHandler(async (req, res) => {
  const result = await confirmScan({
    user: req.user,
    scanId: req.validated.params.id,
    input: req.validated.body,
  });
  res.status(result.duplicate ? 200 : 201).json({
    success: true,
    data: result.transaction,
    duplicate: result.duplicate,
  });
});

export const deleteUserScan = asyncHandler(async (req, res) => {
  const result = await deleteOwnedScan(req.user._id, req.validated.params.id);
  res.json({ success: true, data: result });
});
