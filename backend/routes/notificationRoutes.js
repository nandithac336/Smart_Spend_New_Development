import { Router } from "express";
import {
  getNotificationById,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  removeAllNotifications,
  removeNotification,
} from "../controllers/notificationController.js";
import { requireAuth } from "../middleware/auth.js";
import { notificationLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { notificationIdParam, notificationListQuery } from "../validators/schemas.js";

const router = Router();
router.use(requireAuth, notificationLimiter);
router.get("/unread-count", validate({}), getUnreadNotificationCount);
router.patch("/read-all", validate({}), markAllNotificationsAsRead);
router.get("/", validate({ query: notificationListQuery }), getNotifications);
router.delete("/", validate({}), removeAllNotifications);
router.get("/:id", validate({ params: notificationIdParam }), getNotificationById);
router.patch("/:id/read", validate({ params: notificationIdParam }), markNotificationAsRead);
router.delete("/:id", validate({ params: notificationIdParam }), removeNotification);

export default router;
