import mongoose from "mongoose";

const bookingStatuses = [
  "pending",
  "accepted",
  "rejected",
  "in_progress",
  "completed",
  "cancelled",
];
const paymentStatuses = ["pending", "paid", "verified", "refunded", "failed"];
const businessTimeZone = "Asia/Kolkata";
const rejectUnexpected = (body, fields) =>
  Object.keys(body).filter((key) => !fields.includes(key));

const businessCalendarDate = (value) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: businessTimeZone,
  }).format(value);

const parsePagination = (query) => {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 10 : Number(query.limit);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50
  ) {
    const error = new Error(
      "page must be at least 1 and limit must be between 1 and 50.",
    );
    error.statusCode = 400;
    throw error;
  }
  return { page, limit };
};

export const validateCreateBooking = (request, response, next) => {
  const allowed = [
    "categoryId",
    "providerId",
    "problemDescription",
    "address",
    "serviceDate",
    "preferredTime",
  ];
  const {
    categoryId,
    providerId,
    problemDescription,
    address,
    serviceDate,
    preferredTime,
  } = request.body;
  const invalidAddress =
    !address ||
    typeof address !== "object" ||
    Array.isArray(address) ||
    typeof address.fullAddress !== "string" ||
    !address.fullAddress.trim() ||
    (address.city !== undefined && typeof address.city !== "string") ||
    (address.pincode !== undefined && typeof address.pincode !== "string");
  const invalidDate = Number.isNaN(new Date(serviceDate).getTime());
  const isPastDate =
    !invalidDate &&
    businessCalendarDate(new Date(serviceDate)) <
      businessCalendarDate(new Date());
  if (
    rejectUnexpected(request.body, allowed).length ||
    !mongoose.isValidObjectId(categoryId) ||
    !mongoose.isValidObjectId(providerId) ||
    typeof problemDescription !== "string" ||
    !problemDescription.trim() ||
    problemDescription.trim().length > 2000 ||
    invalidAddress ||
    !serviceDate ||
    invalidDate ||
    isPastDate ||
    typeof preferredTime !== "string" ||
    !preferredTime.trim()
  ) {
    return response
      .status(400)
      .json({ success: false, message: "Invalid booking request." });
  }
  next();
};

export const validatePaginationAndFilters = (request, response, next) => {
  try {
    request.pagination = parsePagination(request.query);
    if (request.query.status && !bookingStatuses.includes(request.query.status))
      return response
        .status(400)
        .json({ success: false, message: "Invalid booking status." });
    if (
      request.query.paymentStatus &&
      !paymentStatuses.includes(request.query.paymentStatus)
    )
      return response
        .status(400)
        .json({ success: false, message: "Invalid payment status." });
    for (const field of ["categoryId", "providerId", "customerId"])
      if (
        request.query[field] &&
        !mongoose.isValidObjectId(request.query[field])
      )
        return response
          .status(400)
          .json({ success: false, message: `Invalid ${field}.` });
    if (
      request.query.serviceDate &&
      Number.isNaN(new Date(request.query.serviceDate).getTime())
    )
      return response
        .status(400)
        .json({ success: false, message: "Invalid service date." });
    next();
  } catch (error) {
    next(error);
  }
};

const validateReason = (field) => (request, response, next) => {
  if (
    rejectUnexpected(request.body, [field]).length ||
    typeof request.body[field] !== "string" ||
    !request.body[field].trim() ||
    request.body[field].trim().length > 500
  )
    return response
      .status(400)
      .json({ success: false, message: `${field} is required.` });
  next();
};

export const validateCancellation = validateReason("cancellationReason");
export const validateRejection = validateReason("rejectionReason");

export const validateBookingId = (request, response, next) => {
  if (!mongoose.isValidObjectId(request.params.id))
    return response
      .status(400)
      .json({ success: false, message: "Invalid booking ID." });
  next();
};

export const validateAdminStatus = (request, response, next) => {
  if (
    rejectUnexpected(request.body, [
      "status",
      "cancellationReason",
      "rejectionReason",
    ]).length ||
    !bookingStatuses.includes(request.body.status)
  )
    return response
      .status(400)
      .json({ success: false, message: "Invalid booking status." });
  if (
    request.body.status === "rejected" &&
    (typeof request.body.rejectionReason !== "string" ||
      !request.body.rejectionReason.trim())
  )
    return response.status(400).json({
      success: false,
      message: "rejectionReason is required when rejecting a booking.",
    });
  if (
    request.body.status === "cancelled" &&
    (typeof request.body.cancellationReason !== "string" ||
      !request.body.cancellationReason.trim())
  )
    return response.status(400).json({
      success: false,
      message: "cancellationReason is required when cancelling a booking.",
    });
  next();
};

export const validateReassignment = (request, response, next) => {
  if (
    rejectUnexpected(request.body, ["providerId"]).length ||
    !mongoose.isValidObjectId(request.body.providerId)
  )
    return response
      .status(400)
      .json({ success: false, message: "A valid providerId is required." });
  next();
};
