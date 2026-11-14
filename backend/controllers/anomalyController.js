import { asyncHandler } from "../utils/asyncHandler.js";
import {
  checkTransactionAnomalies,
  detectUserAnomalies,
  getUserAnomaly,
  getUserAnomalySummary,
  listUserAnomalies,
  updateUserAnomalyStatus,
} from "../services/anomalyDetectionService.js";

export const detectAnomalies = asyncHandler(async (req, res) => {
  const data = await detectUserAnomalies(req.user, req.validated.body);
  res.json({ success: true, data });
});

export const listAnomalies = asyncHandler(async (req, res) => {
  const result = await listUserAnomalies(req.user._id, req.validated.query);
  res.json({ success: true, ...result });
});

export const getAnomaly = asyncHandler(async (req, res) => {
  const data = await getUserAnomaly(req.user._id, req.validated.params.id);
  res.json({ success: true, data });
});

export const updateAnomalyStatus = asyncHandler(async (req, res) => {
  const data = await updateUserAnomalyStatus(
    req.user._id,
    req.validated.params.id,
    req.validated.body.status
  );
  res.json({ success: true, data });
});

export const getAnomalySummary = asyncHandler(async (req, res) => {
  const data = await getUserAnomalySummary(req.user._id);
  res.json({ success: true, data });
});

export const checkTransaction = asyncHandler(async (req, res) => {
  const data = await checkTransactionAnomalies(
    req.user._id,
    req.validated.params.transactionId
  );
  res.json({ success: true, data });
});
