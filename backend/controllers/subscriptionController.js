import { asyncHandler } from "../utils/asyncHandler.js";
import {
  detectUserSubscriptions,
  listUserSubscriptions,
} from "../services/subscriptionDetectionService.js";
import {
  getUserSubscription,
  getUserSubscriptionHistory,
  getUserSubscriptionSummary,
  transitionUserSubscription,
  updateUserSubscription,
} from "../services/subscriptionService.js";

export const detectSubscriptions = asyncHandler(async (req, res) => {
  const data = await detectUserSubscriptions(req.user, req.validated.body);
  res.json({ success: true, data });
});

export const listSubscriptions = asyncHandler(async (req, res) => {
  const result = await listUserSubscriptions(req.user._id, req.validated.query);
  res.json({ success: true, ...result });
});

export const getSubscriptionSummary = asyncHandler(async (req, res) => {
  const data = await getUserSubscriptionSummary(req.user._id, {
    timeZone: req.user.timezone || "Asia/Kolkata",
  });
  res.json({ success: true, data });
});

export const getSubscription = asyncHandler(async (req, res) => {
  const data = await getUserSubscription(req.user._id, req.validated.params.id);
  res.json({ success: true, data });
});

export const updateSubscription = asyncHandler(async (req, res) => {
  const data = await updateUserSubscription(
    req.user._id,
    req.validated.params.id,
    req.validated.body
  );
  res.json({ success: true, data });
});

export const confirmSubscription = asyncHandler(async (req, res) => {
  const data = await transitionUserSubscription(req.user._id, req.validated.params.id, "confirmed");
  res.json({ success: true, data });
});

export const dismissSubscription = asyncHandler(async (req, res) => {
  const data = await transitionUserSubscription(req.user._id, req.validated.params.id, "dismissed");
  res.json({ success: true, data });
});

export const cancelSubscription = asyncHandler(async (req, res) => {
  const data = await transitionUserSubscription(req.user._id, req.validated.params.id, "cancelled");
  res.json({ success: true, data });
});

export const getSubscriptionHistory = asyncHandler(async (req, res) => {
  const data = await getUserSubscriptionHistory(
    req.user._id,
    req.validated.params.id,
    req.validated.query
  );
  res.json({ success: true, ...data });
});
