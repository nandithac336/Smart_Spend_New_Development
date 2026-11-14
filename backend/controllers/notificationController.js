import {
  countUnreadNotifications,
  deleteAllNotifications,
  deleteNotification,
  getNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getNotifications = asyncHandler(async (req, res) => {
  const result = await listNotifications(req.user._id, req.validated.query);
  res.json({ success: true, ...result });
});

export const getUnreadNotificationCount = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { count: await countUnreadNotifications(req.user._id) } });
});

export const getNotificationById = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await getNotification(req.user._id, req.validated.params.id),
  });
});

export const markNotificationAsRead = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await markNotificationRead(req.user._id, req.validated.params.id),
  });
});

export const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await markAllNotificationsRead(req.user._id) });
});

export const removeNotification = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await deleteNotification(req.user._id, req.validated.params.id),
  });
});

export const removeAllNotifications = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await deleteAllNotifications(req.user._id) });
});
