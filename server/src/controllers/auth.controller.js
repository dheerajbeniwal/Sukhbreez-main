import * as authService from "../services/auth.service.js";

const responseForAuth = (response, message, result, statusCode = 200) => {
  response.cookie(
    authService.refreshCookie,
    result.tokens.refreshToken,
    authService.getRefreshCookieOptions(),
  );
  response.status(statusCode).json({
    success: true,
    message,
    data: {
      user: result.user.toSafeObject(),
      accessToken: result.tokens.accessToken,
    },
  });
};

export const registerCustomer = async (request, response) => {
  const user = await authService.registerCustomer(request.body);
  response.status(201).json({
    success: true,
    message: "Customer registered successfully.",
    data: { user: user.toSafeObject() },
  });
};

export const registerProvider = async (request, response) => {
  const user = await authService.registerProvider(request.body);
  response.status(201).json({
    success: true,
    message: "Provider registration submitted for approval.",
    data: { user: user.toSafeObject(), approvalStatus: "pending" },
  });
};

export const login = async (request, response) =>
  responseForAuth(
    response,
    "Login successful.",
    await authService.login(request.body),
  );
export const adminLogin = async (request, response) =>
  responseForAuth(
    response,
    "Admin login successful.",
    await authService.login(request.body, "admin"),
  );

export const refresh = async (request, response) => {
  const token =
    request.cookies[authService.refreshCookie] || request.body.refreshToken;
  if (!token)
    return response
      .status(401)
      .json({ success: false, message: "Refresh token is required." });
  const result = await authService.rotateRefreshToken(token);
  responseForAuth(response, "Token refreshed successfully.", result);
};

export const logout = async (request, response) => {
  await authService.logout(
    request.cookies[authService.refreshCookie] || request.body.refreshToken,
  );
  response.clearCookie(
    authService.refreshCookie,
    authService.getRefreshCookieOptions(),
  );
  response.json({ success: true, message: "Logout successful." });
};

export const me = async (request, response) =>
  response.json({ success: true, data: { user: request.user.toSafeObject() } });

export const changePassword = async (request, response) => {
  await authService.changePassword(
    request.user._id,
    request.body.currentPassword,
    request.body.newPassword,
  );
  response.json({ success: true, message: "Password changed successfully." });
};
