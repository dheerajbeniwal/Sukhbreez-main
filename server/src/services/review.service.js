import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import ProviderProfile from "../models/ProviderProfile.js";
import Review from "../models/Review.js";
import { notifyUser } from "./notification.service.js";

const safeUser = "_id fullName profileImage";
const notFound = (message = "Review not found.") => {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
};
const conflict = (message) => {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
};
const referenceId = (value) => value?._id?.toString() || value?.toString();

const reviewView = (review) => ({
  id: referenceId(review._id),
  bookingId: referenceId(review.bookingId),
  customer: review.customerId && {
    id: referenceId(review.customerId),
    fullName: review.customerId.fullName,
    profileImage: review.customerId.profileImage,
  },
  provider: review.providerId && {
    id: referenceId(review.providerId),
    fullName: review.providerId.fullName,
    profileImage: review.providerId.profileImage,
  },
  rating: review.rating,
  comment: review.comment,
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
});

const populateReview = (query) =>
  query
    .populate("customerId", safeUser)
    .populate("providerId", safeUser)
    .populate("bookingId", "_id bookingId status");

const refreshProviderRating = async (providerId, session) => {
  const [stats] = await Review.aggregate([
    { $match: { providerId: new mongoose.Types.ObjectId(providerId) } },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        ratingAverage: { $avg: "$rating" },
      },
    },
  ]).session(session);
  const ratingAverage = stats
    ? Number(Number(stats.ratingAverage).toFixed(2))
    : 0;
  const profile = await ProviderProfile.findOneAndUpdate(
    { userId: providerId },
    {
      $set: {
        ratingAverage,
        totalReviews: stats?.totalReviews || 0,
      },
    },
    { new: true, session },
  );
  if (!profile) throw new Error("Provider profile not found.");
  return profile;
};

const listReviews = async (filter, { page, limit }) => {
  const [total, reviews] = await Promise.all([
    Review.countDocuments(filter),
    populateReview(
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ).lean(),
  ]);
  return {
    reviews: reviews.map(reviewView),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const createReview = async (customerId, payload) => {
  const booking = await Booking.findOne({
    _id: payload.bookingId,
    customerId,
    status: "completed",
  }).lean();
  if (!booking || !booking.providerId)
    throw notFound("Completed customer booking not found.");

  const session = await mongoose.startSession();
  let review;
  try {
    await session.withTransaction(async () => {
      const created = await Review.create(
        [
          {
            bookingId: booking._id,
            customerId,
            providerId: booking.providerId,
            rating: payload.rating,
            comment: payload.comment?.trim() || "",
          },
        ],
        { session },
      );
      review = created[0];
      await refreshProviderRating(booking.providerId, session);
    });
  } catch (error) {
    if (error.code === 11000)
      throw conflict("This booking has already been reviewed.");
    throw error;
  } finally {
    await session.endSession();
  }

  await notifyUser(booking.providerId, {
    type: "review_received",
    title: "New review received",
    message: `You received a new ${review.rating}-star review.`,
    dedupeKey: `review_received:${review._id}`,
  });
  return reviewView(review);
};

export const listCustomerReviews = (customerId, pagination) =>
  listReviews({ customerId }, pagination);

export const getCustomerBookingReview = async (customerId, bookingId) => {
  const booking = await Booking.exists({ _id: bookingId, customerId });
  if (!booking) throw notFound("Booking not found.");
  const review = await populateReview(
    Review.findOne({ bookingId, customerId }),
  ).lean();
  if (!review) throw notFound("Review not found.");
  return reviewView(review);
};

export const listProviderReviews = (providerId, pagination) =>
  listReviews({ providerId }, pagination);

export const listAdminReviews = async (query, pagination) => {
  const filter = {};
  for (const field of ["providerId", "customerId"])
    if (query[field]) filter[field] = query[field];
  if (query.rating) filter.rating = Number(query.rating);
  return listReviews(filter, pagination);
};

export const getAdminReview = async (reviewId) => {
  const review = await populateReview(Review.findById(reviewId)).lean();
  if (!review) throw notFound();
  return reviewView(review);
};

export const deleteReview = async (reviewId) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const review = await Review.findById(reviewId).session(session);
      if (!review) throw notFound();
      await Review.deleteOne({ _id: reviewId }, { session });
      await refreshProviderRating(review.providerId, session);
    });
  } finally {
    await session.endSession();
  }
};

export { refreshProviderRating, reviewView };
