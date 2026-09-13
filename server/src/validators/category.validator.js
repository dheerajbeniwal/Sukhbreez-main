import mongoose from "mongoose";

const allowedFields = ["name", "description", "icon", "image"];

const rejectUnexpected = (body, fields) =>
  Object.keys(body).filter((key) => !fields.includes(key));

export const validateCategoryCreate = (request, response, next) => {
  const { name } = request.body;
  const unexpected = rejectUnexpected(request.body, [
    "name",
    "description",
    "icon",
    "image",
  ]);
  const invalidOptional = ["description", "icon", "image"].some(
    (field) =>
      Object.hasOwn(request.body, field) &&
      typeof request.body[field] !== "string",
  );
  if (
    unexpected.length ||
    invalidOptional ||
    typeof name !== "string" ||
    name.trim().length < 2 ||
    name.trim().length > 100
  ) {
    return response
      .status(400)
      .json({
        success: false,
        message: "Category name is required and must be 2-100 characters.",
      });
  }
  next();
};

export const validateCategoryUpdate = (request, response, next) => {
  const unexpected = rejectUnexpected(request.body, allowedFields);
  const hasUpdate = allowedFields.some((field) =>
    Object.hasOwn(request.body, field),
  );
  if (
    !mongoose.isValidObjectId(request.params.id) ||
    unexpected.length ||
    !hasUpdate
  ) {
    return response
      .status(400)
      .json({ success: false, message: "Invalid category update request." });
  }
  if (
    Object.hasOwn(request.body, "name") &&
    (typeof request.body.name !== "string" ||
      request.body.name.trim().length < 2 ||
      request.body.name.trim().length > 100)
  ) {
    return response
      .status(400)
      .json({
        success: false,
        message: "Category name must be 2-100 characters.",
      });
  }
  if (
    ["description", "icon", "image"].some(
      (field) =>
        Object.hasOwn(request.body, field) &&
        typeof request.body[field] !== "string",
    )
  )
    return response
      .status(400)
      .json({ success: false, message: "Category fields must be strings." });
  next();
};

export const validateCategoryId = (request, response, next) => {
  if (!mongoose.isValidObjectId(request.params.id))
    return response
      .status(400)
      .json({ success: false, message: "Invalid category ID." });
  next();
};

export const validateCategoryStatus = (request, response, next) => {
  if (
    !mongoose.isValidObjectId(request.params.id) ||
    typeof request.body.isActive !== "boolean" ||
    Object.keys(request.body).length !== 1
  ) {
    return response
      .status(400)
      .json({ success: false, message: "isActive must be a boolean." });
  }
  next();
};
