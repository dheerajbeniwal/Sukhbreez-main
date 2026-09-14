import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import ProviderProfile from "../models/ProviderProfile.js";
import RefreshToken from "../models/RefreshToken.js";
import User from "../models/User.js";
import Category from "../models/Category.js";
import { env } from "../config/env.js";
import { notifyUser } from "./notification.service.js";

const unauthorizedMessage = "Invalid mobile number or password.";
const refreshCookie = "sukh_breeze_refresh";

const durationToMs = (duration) => {
  const match = String(duration).match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return Number(match[1]) * units[match[2]];
};

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
const signAccessToken = (user) =>
  jwt.sign(
    { userId: user._id.toString(), role: user.role },
    env.jwtAccessSecret,
    { expiresIn: env.jwtAccessExpiresIn },
  );
const signRefreshToken = (user) =>
  jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      tokenType: "refresh",
      jti: crypto.randomUUID(),
    },
    env.jwtRefreshSecret,
    { expiresIn: env.jwtRefreshExpiresIn },
  );

export const getRefreshCookieOptions = () => {
  const crossSiteClient = env.clientUrl.startsWith("https://");
  const sameSite = crossSiteClient ? "none" : "lax";

  return {
    httpOnly: true,
    secure: sameSite === "none" || env.nodeEnv === "production",
    sameSite,
    path: "/api/v1/auth",
    maxAge: durationToMs(env.jwtRefreshExpiresIn),
  };
};
export { refreshCookie };

const issueTokens = async (user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + durationToMs(env.jwtRefreshExpiresIn)),
  });
  return { accessToken, refreshToken };
};

const findLoginUser = async (mobile) =>
  User.findOne({ mobile }).select("+password");
const ensureActive = (user) => {
  if (["blocked", "suspended"].includes(user.accountStatus)) {
    const error = new Error("This account is not available.");
    error.statusCode = 403;
    throw error;
  }
};

export const registerCustomer = async (payload) => {
  const existing = await User.exists({ mobile: payload.mobile });
  if (existing) {
    const error = new Error("Mobile number is already registered.");
    error.statusCode = 409;
    throw error;
  }
  const user = await User.create({
    fullName: payload.fullName.trim(),
    mobile: payload.mobile,
    email: payload.email,
    password: await bcrypt.hash(payload.password, 12),
    role: "customer",
  });
  return user;
};

export const registerProvider = async (payload) => {
  const existing = await User.exists({ mobile: payload.mobile });
  if (existing) {
    const error = new Error("Mobile number is already registered.");
    error.statusCode = 409;
    throw error;
  }
  const categoryIds = [...new Set(payload.categoryIds.map((id) => id.toString()))];
  const categories = await Category.find({
    _id: { $in: categoryIds },
    isActive: true,
  }).select("_id");
  const activeCategoryIds = new Set(categories.map((category) => category._id.toString()));
  const invalidCategoryIds = categoryIds.filter((id) => !activeCategoryIds.has(id));
  if (invalidCategoryIds.length) {
    const error = new Error(
      `Active categories not found: ${invalidCategoryIds.join(", ")}.`,
    );
    error.statusCode = 404;
    throw error;
  }
  const user = await User.create({
    fullName: payload.fullName.trim(),
    mobile: payload.mobile,
    email: payload.email,
    password: await bcrypt.hash(payload.password, 12),
    role: "provider",
  });
  try {
    await ProviderProfile.create({
      userId: user._id,
      categoryIds,
      experience: payload.experience,
      address: payload.address,
      approvalStatus: "pending",
    });
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    throw error;
  }
  const admins = await User.find({ role: "admin", accountStatus: "active" }).select("_id").lean();
  await Promise.all(
    admins.map((admin) =>
      notifyUser(admin._id, {
        type: "provider_application",
        title: "New provider application",
        message: `${user.fullName} has submitted a provider application for approval.`,
        dedupeKey: `provider_application:${user._id}:${admin._id}`,
      }),
    ),
  );
  return user;
};

export const login = async ({ mobile, password }, requiredRole) => {
  const user = await findLoginUser(mobile);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    const error = new Error(unauthorizedMessage);
    error.statusCode = 401;
    throw error;
  }
  ensureActive(user);
  if (requiredRole && user.role !== requiredRole) {
    const error = new Error(unauthorizedMessage);
    error.statusCode = 401;
    throw error;
  }
  if (user.role === "provider") {
    const profile = await ProviderProfile.findOne({ userId: user._id });
    if (!profile || profile.approvalStatus !== "approved") {
      const error = new Error("Provider account approval is pending.");
      error.statusCode = 403;
      throw error;
    }
  }
  user.lastLoginAt = new Date();
  await user.save();
  return { user, tokens: await issueTokens(user) };
};

export const rotateRefreshToken = async (token) => {
  let payload;
  try {
    payload = jwt.verify(token, env.jwtRefreshSecret);
  } catch {
    const error = new Error("Invalid or expired refresh token.");
    error.statusCode = 401;
    throw error;
  }
  const session = await RefreshToken.findOne({
    tokenHash: hashToken(token),
    revokedAt: null,
  }).select("+tokenHash");
  if (
    !session ||
    session.expiresAt <= new Date() ||
    session.user.toString() !== payload.userId
  ) {
    const error = new Error("Invalid or expired refresh token.");
    error.statusCode = 401;
    throw error;
  }
  session.revokedAt = new Date();
  await session.save();
  const user = await User.findById(payload.userId);
  if (!user) {
    const error = new Error("Invalid or expired refresh token.");
    error.statusCode = 401;
    throw error;
  }
  ensureActive(user);
  return { user, tokens: await issueTokens(user) };
};

export const logout = async (token) => {
  if (token)
    await RefreshToken.updateOne(
      { tokenHash: hashToken(token), revokedAt: null },
      { revokedAt: new Date() },
    );
};

export const getCurrentUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }
  ensureActive(user);
  return user;
};

export const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select("+password");
  if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
    const error = new Error("Current password is incorrect.");
    error.statusCode = 401;
    throw error;
  }
  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();
  await RefreshToken.updateMany(
    { user: user._id, revokedAt: null },
    { revokedAt: new Date() },
  );
};

export const seedAdmin = async () => {
  if (!env.adminSeedMobile || !env.adminSeedPassword) return null;
  const existing = await User.exists({ mobile: env.adminSeedMobile });
  if (existing) return null;
  return User.create({
    fullName: env.adminSeedFullName,
    mobile: env.adminSeedMobile,
    password: await bcrypt.hash(env.adminSeedPassword, 12),
    role: "admin",
  });
};
