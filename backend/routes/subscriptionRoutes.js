import { Router } from "express";
import {
  cancelSubscription,
  confirmSubscription,
  detectSubscriptions,
  dismissSubscription,
  getSubscription,
  getSubscriptionHistory,
  getSubscriptionSummary,
  listSubscriptions,
  updateSubscription,
} from "../controllers/subscriptionController.js";
import { requireAuth } from "../middleware/auth.js";
import { subscriptionDetectionLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import {
  subscriptionDetectSchema,
  subscriptionHistoryQuery,
  subscriptionIdParam,
  subscriptionListQuery,
  updateSubscriptionSchema,
} from "../validators/schemas.js";

const router = Router();
router.use(requireAuth);
router.post("/detect", subscriptionDetectionLimiter, validate({ body: subscriptionDetectSchema }), detectSubscriptions);
router.get("/summary", validate({}), getSubscriptionSummary);
router.get("/", validate({ query: subscriptionListQuery }), listSubscriptions);
router.get("/:id/history", validate({ params: subscriptionIdParam, query: subscriptionHistoryQuery }), getSubscriptionHistory);
router.get("/:id", validate({ params: subscriptionIdParam }), getSubscription);
router.patch("/:id", validate({ params: subscriptionIdParam, body: updateSubscriptionSchema }), updateSubscription);
router.patch("/:id/confirm", validate({ params: subscriptionIdParam }), confirmSubscription);
router.patch("/:id/dismiss", validate({ params: subscriptionIdParam }), dismissSubscription);
router.patch("/:id/cancel", validate({ params: subscriptionIdParam }), cancelSubscription);

export default router;
