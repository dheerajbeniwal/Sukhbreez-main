import mongoose from "mongoose";

const parsePagination = (query) => {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 10 : Number(query.limit);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50
  )
    return null;
  return { page, limit };
};

const invalidPagination = (response) =>
  response.status(400).json({
    success: false,
    message: "page must be at least 1 and limit must be between 1 and 50.",
  });

export const validateReviewCreate = (request, response, next) => {
  const { bookingId, rating, comment } = request.body;
  if (
    Object.keys(request.body).some(
      (field) => !["bookingId", "rating", "comment"].includes(field),
    ) ||
    !mongoose.isValidObjectId(bookingId) ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5 ||
    (comment !== undefined &&
      (typeof comment !== "string" || comment.trim().length > 2000))
  )
    return response
      .status(400)
      .json({ success: false, message: "Invalid review request." });
  next();
};

export const validateReviewId = (request, response, next) => {
  if (!mongoose.isValidObjectId(request.params.id))
    return response
      .status(400)
      .json({ success: false, message: "Invalid review ID." });
  next();
};

export const validateBookingReviewId = (request, response, next) => {
  if (!mongoose.isValidObjectId(request.params.bookingId))
    return response
      .status(400)
      .json({ success: false, message: "Invalid booking ID." });
  next();
};

export const validateProviderReviewId = (request, response, next) => {
  if (!mongoose.isValidObjectId(request.params.providerId))
    return response
      .status(400)
      .json({ success: false, message: "Invalid provider ID." });
  next();
};

export const parseCustomerReviewQuery = (request, response, next) => {
  const pagination = parsePagination(request.query);
  if (!pagination) return invalidPagination(response);
  request.pagination = pagination;
  next();
};

export const parseProviderReviewQuery = (request, response, next) => {
  const pagination = parsePagination(request.query);
  if (!pagination) return invalidPagination(response);
  request.pagination = pagination;
  next();
};

export const parseAdminReviewQuery = (request, response, next) => {
  const pagination = parsePagination(request.query);
  if (!pagination) return invalidPagination(response);
  for (const field of ["providerId", "customerId"])
    if (request.query[field] && !mongoose.isValidObjectId(request.query[field]))
      return response
        .status(400)
        .json({ success: false, message: `Invalid ${field}.` });
  if (
    request.query.rating !== undefined &&
    (!Number.isInteger(Number(request.query.rating)) ||
      Number(request.query.rating) < 1 ||
      Number(request.query.rating) > 5)
  )
    return response
      .status(400)
      .json({ success: false, message: "rating must be between 1 and 5." });
  request.pagination = pagination;
  next();
};
