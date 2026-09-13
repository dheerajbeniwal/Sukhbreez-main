import mongoose from "mongoose";
import validator from "validator";

const passwordRules = (value) => typeof value === "string" && value.length >= 8;
const mobileRules = (value) =>
  typeof value === "string" && /^[6-9]\d{9}$/.test(value);
const unexpectedFields = (body, allowedFields) =>
  Object.keys(body).filter((key) => !allowedFields.includes(key));

const validateBaseRegistration = (body, extraFields = []) => {
  const errors = {};
  if (typeof body.fullName !== "string" || body.fullName.trim().length < 2)
    errors.fullName = "Full name is required.";
  if (!mobileRules(body.mobile))
    errors.mobile = "A valid 10-digit Indian mobile number is required.";
  if (body.email && !validateEmail(body.email))
    errors.email = "Email address is invalid.";
  const unexpected = unexpectedFields(body, [
    "fullName",
    "mobile",
    "email",
    "password",
    "confirmPassword",
    ...extraFields,
  ]);
  if (unexpected.length)
    errors.request = `Unexpected fields: ${unexpected.join(", ")}.`;
  if (!passwordRules(body.password))
    errors.password = "Password must be at least 8 characters.";
  if (body.password !== body.confirmPassword)
    errors.confirmPassword = "Passwords do not match.";
  return errors;
};

export const validateCustomerRegistration = (request, response, next) => {
  const errors = validateBaseRegistration(request.body);
  if (Object.keys(errors).length)
    return response
      .status(400)
      .json({ success: false, message: "Validation failed.", errors });
  next();
};

export const validateProviderRegistration = (request, response, next) => {
  const errors = validateBaseRegistration(request.body, [
    "categoryIds",
    "experience",
    "address",
  ]);
  if (
    !Array.isArray(request.body.categoryIds) ||
    request.body.categoryIds.length < 1 ||
    request.body.categoryIds.some((id) => !mongoose.isValidObjectId(id))
  )
    errors.categoryIds = "At least one valid category ID is required.";
  if (
    !Number.isFinite(request.body.experience) ||
    request.body.experience < 0 ||
    request.body.experience > 80
  )
    errors.experience = "Experience must be between 0 and 80 years.";
  if (typeof request.body.address !== "string" || !request.body.address.trim())
    errors.address = "Address is required.";
  const unexpected = unexpectedFields(request.body, [
    "fullName",
    "mobile",
    "email",
    "password",
    "confirmPassword",
    "categoryIds",
    "experience",
    "address",
  ]);
  if (unexpected.length)
    errors.request = `Unexpected fields: ${unexpected.join(", ")}.`;
  if (Object.keys(errors).length)
    return response
      .status(400)
      .json({ success: false, message: "Validation failed.", errors });
  next();
};

export const validateLogin = (request, response, next) => {
  if (
    !mobileRules(request.body.mobile) ||
    typeof request.body.password !== "string" ||
    !request.body.password
  )
    return response
      .status(400)
      .json({ success: false, message: "Mobile and password are required." });
  next();
};

export const validateChangePassword = (request, response, next) => {
  const { currentPassword, newPassword, confirmPassword } = request.body;
  if (
    !passwordRules(currentPassword) ||
    !passwordRules(newPassword) ||
    newPassword !== confirmPassword
  )
    return response
      .status(400)
      .json({ success: false, message: "Password details are invalid." });
  next();
};

export const validateEmail = (value) => !value || validator.isEmail(value);
