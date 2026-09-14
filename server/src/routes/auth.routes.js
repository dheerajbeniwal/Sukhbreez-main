import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import {
  validateChangePassword,
  validateCustomerRegistration,
  validateLogin,
  validateProviderRegistration,
} from "../validators/auth.validator.js";

const authRouter = Router();
const authLimiter = env.disableRateLimit
  ? (request, response, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      skipSuccessfulRequests: true,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        success: false,
        message: "Too many authentication attempts. Please try again later.",
      },
    });

authRouter.post(
  "/register/customer",
  validateCustomerRegistration,
  authController.registerCustomer,
);
authRouter.post(
  "/register/provider",
  validateProviderRegistration,
  authController.registerProvider,
);
authRouter.post("/login", authLimiter, validateLogin, authController.login);
authRouter.post(
  "/admin/login",
  authLimiter,
  validateLogin,
  authController.adminLogin,
);
authRouter.post("/refresh", authController.refresh);
authRouter.post("/logout", authController.logout);
authRouter.get("/me", authenticate, authController.me);
authRouter.patch(
  "/change-password",
  authenticate,
  validateChangePassword,
  authController.changePassword,
);

export default authRouter;
