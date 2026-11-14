import {
  getFinancialHealth,
  getFinancialHealthBreakdown,
} from "../services/financialHealthService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getFinancialHealthScore = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getFinancialHealth(req.user) });
});

export const getFinancialHealthDetails = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getFinancialHealthBreakdown(req.user) });
});
