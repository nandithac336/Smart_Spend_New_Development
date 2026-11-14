import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getCategoryExpensePredictions,
  getDailyExpensePrediction,
  getExpensePredictionAccuracy,
  getExpensePredictionOverview,
  getMonthlyExpensePrediction,
} from "../services/expensePredictionService.js";

export const getPredictionOverview = asyncHandler(async (req, res) => {
  const data = await getExpensePredictionOverview(req.user, req.validated.query);
  res.json({ success: true, data });
});

export const getMonthlyPrediction = asyncHandler(async (req, res) => {
  const data = await getMonthlyExpensePrediction(req.user, req.validated.query);
  res.json({ success: true, data });
});

export const getCategoryPredictions = asyncHandler(async (req, res) => {
  const data = await getCategoryExpensePredictions(req.user, req.validated.query);
  res.json({ success: true, data });
});

export const getDailyPrediction = asyncHandler(async (req, res) => {
  const data = await getDailyExpensePrediction(req.user, req.validated.query);
  res.json({ success: true, data });
});

export const getPredictionAccuracy = asyncHandler(async (req, res) => {
  const data = await getExpensePredictionAccuracy(req.user, req.validated.query);
  res.json({ success: true, data });
});
