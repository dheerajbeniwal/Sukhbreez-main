import mongoose from "mongoose";

const methods = ["cash", "upi", "bank_transfer", "other", "online"];
const paymentStatuses = ["pending", "paid", "verified", "refunded", "failed"];
const rejectUnexpected = (body, fields) =>
  Object.keys(body).filter((key) => !fields.includes(key));

export const validateBookingIdBody = (request, response, next) => {
  if (
    rejectUnexpected(request.body, ["bookingId"]).length ||
    !mongoose.isValidObjectId(request.body.bookingId)
  )
    return response
      .status(400)
      .json({ success: false, message: "A valid bookingId is required." });
  next();
};

export const validateVerification = (request, response, next) => {
  const allowed = [
    "bookingId",
    "razorpay_order_id",
    "razorpay_payment_id",
    "razorpay_signature",
  ];
  if (
    rejectUnexpected(request.body, allowed).length ||
    !mongoose.isValidObjectId(request.body.bookingId) ||
    typeof request.body.razorpay_order_id !== "string" ||
    !request.body.razorpay_order_id.trim() ||
    typeof request.body.razorpay_payment_id !== "string" ||
    !request.body.razorpay_payment_id.trim() ||
    typeof request.body.razorpay_signature !== "string" ||
    !request.body.razorpay_signature.trim()
  )
    return response
      .status(400)
      .json({
        success: false,
        message: "Invalid Razorpay verification request.",
      });
  next();
};

export const validatePaginationAndFilters = (request, response, next) => {
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
    return response
      .status(400)
      .json({
        success: false,
        message: "page must be at least 1 and limit must be between 1 and 50.",
      });
  for (const field of ["bookingId", "providerId", "customerId"])
    if (request.query[field] && !mongoose.isValidObjectId(request.query[field]))
      return response
        .status(400)
        .json({ success: false, message: `Invalid ${field}.` });
  if (
    request.query.paymentStatus &&
    !paymentStatuses.includes(request.query.paymentStatus)
  )
    return response
      .status(400)
      .json({ success: false, message: "Invalid payment status." });
  if (
    request.query.paymentMethod &&
    !methods.includes(request.query.paymentMethod)
  )
    return response
      .status(400)
      .json({ success: false, message: "Invalid payment method." });
  request.pagination = { page, limit };
  next();
};

export const validateAdminVerification = (request, response, next) => {
  if (Object.keys(request.body || {}).length !== 0)
    return response
      .status(400)
      .json({
        success: false,
        message: "No request body is accepted for verification.",
      });
  next();
};

export const validateSettlement = (request, response, next) => {
  if (
    rejectUnexpected(request.body, ["settlementReference", "settlementNotes"])
      .length ||
    typeof request.body.settlementReference !== "string" ||
    !request.body.settlementReference.trim() ||
    request.body.settlementReference.trim().length > 200 ||
    (request.body.settlementNotes !== undefined &&
      typeof request.body.settlementNotes !== "string")
  )
    return response
      .status(400)
      .json({ success: false, message: "A settlementReference is required." });
  next();
};

export const validateCommission = (request, response, next) => {
  if (
    Object.keys(request.body).length !== 1 ||
    !Number.isFinite(request.body.commissionPercentage) ||
    request.body.commissionPercentage < 0 ||
    request.body.commissionPercentage > 100
  )
    return response
      .status(400)
      .json({
        success: false,
        message: "commissionPercentage must be between 0 and 100.",
      });
  next();
};
