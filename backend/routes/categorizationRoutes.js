import { Router } from "express";
import {
  acceptSuggestion,
  bulkSuggestCategories,
  createMerchantRule,
  getCategorySuggestions,
  getMerchantRules,
  patchMerchantRule,
  rejectSuggestion,
  removeMerchantRule,
  suggestCategory,
} from "../controllers/categorizationController.js";
import { requireAuth } from "../middleware/auth.js";
import { categorizationLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import {
  categorizationBulkSuggestSchema,
  categorizationIdParam,
  categorizationReviewSchema,
  categorizationSuggestSchema,
  categorizationSuggestionsQuery,
  createMerchantRuleSchema,
  merchantRuleListQuery,
  updateMerchantRuleSchema,
} from "../validators/schemas.js";

const router = Router();
router.use(requireAuth);

router.post("/suggest", categorizationLimiter, validate({ body: categorizationSuggestSchema }), suggestCategory);
router.post("/bulk-suggest", categorizationLimiter, validate({ body: categorizationBulkSuggestSchema }), bulkSuggestCategories);
router.get("/suggestions", validate({ query: categorizationSuggestionsQuery }), getCategorySuggestions);

router.get("/rules", validate({ query: merchantRuleListQuery }), getMerchantRules);
router.post("/rules", validate({ body: createMerchantRuleSchema }), createMerchantRule);
router.patch("/rules/:id", validate({ params: categorizationIdParam, body: updateMerchantRuleSchema }), patchMerchantRule);
router.delete("/rules/:id", validate({ params: categorizationIdParam }), removeMerchantRule);

router.post("/:id/accept", validate({ params: categorizationIdParam, body: categorizationReviewSchema }), acceptSuggestion);
router.post("/:id/reject", validate({ params: categorizationIdParam, body: categorizationReviewSchema }), rejectSuggestion);

export default router;
