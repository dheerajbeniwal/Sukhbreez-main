import * as notificationService from "../services/notification.service.js";

export const list = async (request, response) => {
  const data = await notificationService.listNotifications(request.user._id, {
    ...request.pagination,
    ...request.notificationFilters,
  });
  response.json({
    success: true,
    message: "Notifications fetched successfully.",
    data,
  });
};

export const unreadCount = async (request, response) => {
  const count = await notificationService.getUnreadCount(request.user._id);
  response.json({
    success: true,
    message: "Unread notification count fetched successfully.",
    data: { count },
  });
};

export const markRead = async (request, response) => {
  const notification = await notificationService.markAsRead(
    request.params.id,
    request.user._id,
  );
  response.json({
    success: true,
    message: "Notification marked as read.",
    data: { notification },
  });
};

export const markAllRead = async (request, response) => {
  const data = await notificationService.markAllAsRead(request.user._id);
  response.json({
    success: true,
    message: "Notifications marked as read.",
    data,
  });
};
