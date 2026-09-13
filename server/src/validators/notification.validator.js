import mongoose from "mongoose";

export const parseNotificationQuery = (request, response, next) => {
  const page =
    request.query.page === undefined ? 1 : Number(request.query.page);
  const limit =
    request.query.limit === undefined ? 10 : Number(request.query.limit);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50
  )
    return response.status(400).json({
      success: false,
      message: "page must be at least 1 and limit must be between 1 and 50.",
    });
  if (
    request.query.isRead !== undefined &&
    !["true", "false"].includes(request.query.isRead)
  )
    return response
      .status(400)
      .json({ success: false, message: "isRead must be true or false." });
  request.pagination = { page, limit };
  request.notificationFilters =
    request.query.isRead === undefined
      ? {}
      : { isRead: request.query.isRead === "true" };
  next();
};

export const validateNotificationId = (request, response, next) => {
  if (!mongoose.isValidObjectId(request.params.id))
    return response
      .status(400)
      .json({ success: false, message: "Invalid notification ID." });
  next();
};

export const validateEmptyBody = (request, response, next) => {
  if (Object.keys(request.body || {}).length)
    return response
      .status(400)
      .json({ success: false, message: "No request body is accepted." });
  next();
};
