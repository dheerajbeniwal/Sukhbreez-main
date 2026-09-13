import * as reviewService from "../services/review.service.js";

export const create = async (request, response) => {
  const review = await reviewService.createReview(
    request.user._id,
    request.body,
  );
  response.status(201).json({
    success: true,
    message: "Review created successfully.",
    data: { review },
  });
};

export const myReviews = async (request, response) => {
  const data = await reviewService.listCustomerReviews(
    request.user._id,
    request.pagination,
  );
  response.json({
    success: true,
    message: "Reviews fetched successfully.",
    data,
  });
};

export const bookingReview = async (request, response) => {
  const review = await reviewService.getCustomerBookingReview(
    request.user._id,
    request.params.bookingId,
  );
  response.json({
    success: true,
    message: "Review fetched successfully.",
    data: { review },
  });
};

export const providerReviews = async (request, response) => {
  const data = await reviewService.listProviderReviews(
    request.user._id,
    request.pagination,
  );
  response.json({
    success: true,
    message: "Provider reviews fetched successfully.",
    data,
  });
};

export const publicProviderReviews = async (request, response) => {
  const data = await reviewService.listProviderReviews(
    request.params.providerId,
    request.pagination,
  );
  response.json({
    success: true,
    message: "Provider reviews fetched successfully.",
    data,
  });
};

export const adminList = async (request, response) => {
  const data = await reviewService.listAdminReviews(
    request.query,
    request.pagination,
  );
  response.json({
    success: true,
    message: "Reviews fetched successfully.",
    data,
  });
};

export const adminDetails = async (request, response) => {
  const review = await reviewService.getAdminReview(request.params.id);
  response.json({
    success: true,
    message: "Review fetched successfully.",
    data: { review },
  });
};

export const adminDelete = async (request, response) => {
  await reviewService.deleteReview(request.params.id);
  response.json({ success: true, message: "Review deleted successfully." });
};
