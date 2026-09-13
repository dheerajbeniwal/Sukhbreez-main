import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ProviderProfile from "../models/ProviderProfile.js";
import { env } from "../config/env.js";

export const authenticate = async (request, response, next) => {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token)
    return response
      .status(401)
      .json({ success: false, message: "Authentication required." });
  try {
    const payload = jwt.verify(token, env.jwtAccessSecret);
    const user = await User.findById(payload.userId);
    if (
      !user ||
      user.role !== payload.role ||
      ["blocked", "suspended"].includes(user.accountStatus)
    )
      return response
        .status(401)
        .json({ success: false, message: "Authentication required." });
    if (user.role === "provider") {
      const profile = await ProviderProfile.findOne({ userId: user._id });
      if (!profile || profile.approvalStatus !== "approved")
        return response.status(403).json({
          success: false,
          message: "Provider account approval is pending.",
        });
    }
    request.user = user;
    next();
  } catch {
    return response
      .status(401)
      .json({ success: false, message: "Authentication required." });
  }
};

export const authorize =
  (...roles) =>
  (request, response, next) => {
    if (!request.user)
      return response
        .status(401)
        .json({ success: false, message: "Authentication required." });
    if (!roles.includes(request.user.role))
      return response.status(403).json({
        success: false,
        message: "You do not have permission to access this resource.",
      });
    next();
  };
