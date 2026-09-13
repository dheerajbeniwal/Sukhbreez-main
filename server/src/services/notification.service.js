import mongoose from "mongoose";
import Notification from "../models/Notification.js";

const notFound = () => {
  const error = new Error("Notification not found.");
  error.statusCode = 404;
  return error;
};

const notificationView = (notification) => ({
  id: notification._id.toString(),
  type: notification.type,
  title: notification.title,
  message: notification.message,
  isRead: notification.isRead,
  createdAt: notification.createdAt,
  updatedAt: notification.updatedAt,
});

const safeNotificationQuery = (query) =>
  query.select("_id type title message isRead createdAt updatedAt");

export const createNotification = async ({
  userId,
  type,
  title,
  message,
  dedupeKey,
}) => {
  try {
    return await Notification.create({
      userId,
      type,
      title,
      message,
      dedupeKey,
    });
  } catch (error) {
    if (error.code !== 11000)
      console.error("Notification creation failed:", error.message);
    return null;
  }
};

export const notifyUser = async (userId, details) =>
  createNotification({ userId, ...details });

export const listNotifications = async (userId, { page, limit, isRead }) => {
  const filter = { userId };
  if (isRead !== undefined) filter.isRead = isRead;
  const [total, notifications] = await Promise.all([
    Notification.countDocuments(filter),
    safeNotificationQuery(
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ).lean(),
  ]);
  return {
    notifications: notifications.map(notificationView),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getUnreadCount = async (userId) =>
  Notification.countDocuments({ userId, isRead: false });

export const markAsRead = async (notificationId, userId) => {
  if (!mongoose.isValidObjectId(notificationId)) throw notFound();
  const notification = await safeNotificationQuery(
    Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true },
    ),
  ).lean();
  if (!notification) throw notFound();
  return notificationView(notification);
};

export const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true },
  );
  return { updatedCount: result.modifiedCount };
};

export { notificationView };
