import { Types } from "mongoose";
import { Notification } from "../models/Notification.js";
import { ApiError } from "../utils/apiError.js";

const RETENTION_DAYS = 90;
const DAY_MS = 86_400_000;

function notificationExpiry(now) {
  return new Date(now.getTime() + RETENTION_DAYS * DAY_MS);
}

export async function createNotification(userId, notification, { now = new Date() } = {}) {
  if (!Types.ObjectId.isValid(String(userId))) throw ApiError.badRequest("Invalid user id");
  const document = {
    ...notification,
    userId: new Types.ObjectId(String(userId)),
    expiresAt: notification.expiresAt || notificationExpiry(now),
  };
  try {
    const result = await Notification.updateOne(
      { userId: document.userId, deduplicationKey: document.deduplicationKey },
      { $setOnInsert: document },
      { upsert: true, runValidators: true }
    );
    if (result.upsertedCount) {
      return Notification.findOne({ userId: document.userId, deduplicationKey: document.deduplicationKey }).lean();
    }
    return null;
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
}

export async function createNotifications(userId, notifications, options) {
  const created = [];
  for (const notification of notifications) {
    const result = await createNotification(userId, notification, options);
    if (result) created.push(result);
  }
  return created;
}

export async function listNotifications(userId, filters) {
  const query = { userId: new Types.ObjectId(String(userId)), expiresAt: { $gt: new Date() } };
  if (filters.type) query.type = filters.type;
  if (filters.severity) query.severity = filters.severity;
  if (filters.isRead !== undefined) query.isRead = filters.isRead;
  const [data, total] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .lean(),
    Notification.countDocuments(query),
  ]);
  return {
    data,
    pagination: { page: filters.page, limit: filters.limit, total, pages: Math.ceil(total / filters.limit) },
  };
}

export async function countUnreadNotifications(userId) {
  return Notification.countDocuments({
    userId: new Types.ObjectId(String(userId)),
    isRead: false,
    expiresAt: { $gt: new Date() },
  });
}

export async function getNotification(userId, notificationId) {
  const notification = await Notification.findOne({
    _id: notificationId,
    userId: new Types.ObjectId(String(userId)),
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!notification) throw ApiError.notFound("Notification not found");
  return notification;
}

export async function markNotificationRead(userId, notificationId) {
  const notification = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      userId: new Types.ObjectId(String(userId)),
      isRead: false,
      expiresAt: { $gt: new Date() },
    },
    { $set: { isRead: true, readAt: new Date() } },
    { returnDocument: "after" }
  ).lean();
  if (notification) return notification;
  const existing = await Notification.findOne({
    _id: notificationId,
    userId: new Types.ObjectId(String(userId)),
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!existing) throw ApiError.notFound("Notification not found");
  return existing;
}

export async function markAllNotificationsRead(userId) {
  const result = await Notification.updateMany(
    {
      userId: new Types.ObjectId(String(userId)),
      isRead: false,
      expiresAt: { $gt: new Date() },
    },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return { modifiedCount: result.modifiedCount };
}

export async function deleteNotification(userId, notificationId) {
  const result = await Notification.deleteOne({
    _id: notificationId,
    userId: new Types.ObjectId(String(userId)),
  });
  if (!result.deletedCount) throw ApiError.notFound("Notification not found");
  return { id: notificationId, deleted: true };
}

export async function deleteAllNotifications(userId) {
  const result = await Notification.deleteMany({ userId: new Types.ObjectId(String(userId)) });
  return { deletedCount: result.deletedCount };
}
