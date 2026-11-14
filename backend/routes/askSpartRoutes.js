import { Router } from "express";
import {
  chatWithAskSpart,
  getAskSpartConversationById,
  getAskSpartConversations,
  getAskSpartStatus,
  patchAskSpartConversation,
  removeAskSpartConversation,
} from "../controllers/askSpartController.js";
import { requireAuth } from "../middleware/auth.js";
import { askSpartLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import {
  askSpartChatSchema,
  askSpartConversationListQuery,
  askSpartIdParam,
  renameAskSpartConversationSchema,
} from "../validators/schemas.js";

const router = Router();
router.use(requireAuth);

router.get("/health", getAskSpartStatus);
router.post("/chat", askSpartLimiter, validate({ body: askSpartChatSchema }), chatWithAskSpart);
router.get("/conversations", validate({ query: askSpartConversationListQuery }), getAskSpartConversations);
router.get("/conversations/:id", validate({ params: askSpartIdParam }), getAskSpartConversationById);
router.patch(
  "/conversations/:id",
  validate({ params: askSpartIdParam, body: renameAskSpartConversationSchema }),
  patchAskSpartConversation
);
router.delete("/conversations/:id", validate({ params: askSpartIdParam }), removeAskSpartConversation);

export default router;
