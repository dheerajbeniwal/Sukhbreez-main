import mongoose from "mongoose";

const pagination = (query) => {
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

export const parseProviderQuery = (request, response, next) => {
  try {
    request.pagination = pagination(request.query);
    if (
      request.query.categoryId &&
      !mongoose.isValidObjectId(request.query.categoryId)
    )
      return response
        .status(400)
        .json({ success: false, message: "Invalid category ID." });
    if (
      request.query.available !== undefined &&
      !["true", "false"].includes(request.query.available)
    )
      return response
        .status(400)
        .json({ success: false, message: "available must be true or false." });
    next();
  } catch (error) {
    next(error);
  }
};

const rejectUnexpected = (body, fields) =>
  Object.keys(body).filter((key) => !fields.includes(key));

export const validateProviderUpdate = (request, response, next) => {
  const allowed = [
    "fullName",
    "profileImage",
    "categoryId",
    "experience",
    "address",
    "bio",
    "startingCharge",
  ];
  if (
    rejectUnexpected(request.body, allowed).length ||
    !allowed.some((field) => Object.hasOwn(request.body, field))
  )
    return response
      .status(400)
      .json({
        success: false,
        message: "Invalid provider profile update request.",
      });
  if (
    Object.hasOwn(request.body, "categoryId") &&
    !mongoose.isValidObjectId(request.body.categoryId)
  )
    return response
      .status(400)
      .json({ success: false, message: "Invalid category ID." });
  if (
    Object.hasOwn(request.body, "experience") &&
    (!Number.isFinite(request.body.experience) ||
      request.body.experience < 0 ||
      request.body.experience > 80)
  )
    return response
      .status(400)
      .json({
        success: false,
        message: "Experience must be between 0 and 80 years.",
      });
  if (
    Object.hasOwn(request.body, "startingCharge") &&
    (!Number.isFinite(request.body.startingCharge) ||
      request.body.startingCharge <= 0)
  )
    return response
      .status(400)
      .json({ success: false, message: "Starting charge must be greater than zero." });
  for (const field of ["fullName", "profileImage", "address", "bio"]) {
    if (
      Object.hasOwn(request.body, field) &&
      typeof request.body[field] !== "string"
    )
      return response
        .status(400)
        .json({ success: false, message: `${field} must be a string.` });
  }
  if (
    Object.hasOwn(request.body, "fullName") &&
    request.body.fullName.trim().length < 2
  )
    return response
      .status(400)
      .json({ success: false, message: "Full name is invalid." });
  next();
};

export const validateAvailability = (request, response, next) => {
  if (
    Object.keys(request.body).length !== 1 ||
    typeof request.body.availability !== "boolean"
  )
    return response
      .status(400)
      .json({ success: false, message: "availability must be a boolean." });
  next();
};

export const validateProviderId = (request, response, next) => {
  if (!mongoose.isValidObjectId(request.params.id))
    return response
      .status(400)
      .json({ success: false, message: "Invalid provider ID." });
  next();
};

export const validateApproval = (request, response, next) => {
  if (
    Object.keys(request.body).length !== 1 ||
    !["approved", "rejected"].includes(request.body.approvalStatus)
  )
    return response
      .status(400)
      .json({
        success: false,
        message: "approvalStatus must be approved or rejected.",
      });
  next();
};

export const validateProviderStatus = (request, response, next) => {
  if (
    Object.keys(request.body).length !== 1 ||
    !["active", "blocked", "suspended"].includes(request.body.accountStatus)
  )
    return response
      .status(400)
      .json({ success: false, message: "Invalid provider account status." });
  next();
};
