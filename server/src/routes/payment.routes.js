import { Router } from "express";
import * as paymentController from "../controllers/payment.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  validateAdminVerification,
  validateBookingIdBody,
  validateCommission,
  validatePaginationAndFilters,
  validateSettlement,
  validateVerification,
} from "../validators/payment.validator.js";

const paymentRouter = Router();
const customerOnly = [authenticate, authorize("customer")];
const providerOnly = [authenticate, authorize("provider")];
const adminOnly = [authenticate, authorize("admin")];

paymentRouter.post("/webhook/razorpay", paymentController.razorpayWebhook);
paymentRouter.post(
  "/create-order",
  ...customerOnly,
  validateBookingIdBody,
  paymentController.createOrder,
);
paymentRouter.post(
  "/verify",
  ...customerOnly,
  validateVerification,
  paymentController.verify,
);
paymentRouter.post(
  "/cash/received",
  ...providerOnly,
  validateBookingIdBody,
  paymentController.cashReceived,
);
paymentRouter.get(
  "/admin/commission",
  ...adminOnly,
  paymentController.getCommission,
);
paymentRouter.patch(
  "/admin/commission",
  ...adminOnly,
  validateCommission,
  paymentController.updateCommission,
);
paymentRouter.get(
  "/admin/settlements",
  ...adminOnly,
  validatePaginationAndFilters,
  paymentController.settlements,
);
paymentRouter.get(
  "/admin",
  ...adminOnly,
  validatePaginationAndFilters,
  paymentController.adminList,
);
paymentRouter.get("/admin/:id", ...adminOnly, paymentController.adminDetails);
paymentRouter.patch(
  "/admin/:id/verify",
  ...adminOnly,
  validateAdminVerification,
  paymentController.adminVerify,
);
paymentRouter.patch(
  "/admin/:id/settle",
  ...adminOnly,
  validateSettlement,
  paymentController.settle,
);

export default paymentRouter;
