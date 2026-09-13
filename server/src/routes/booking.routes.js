import { Router } from "express";
import * as bookingController from "../controllers/booking.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  validateAdminStatus,
  validateBookingId,
  validateCancellation,
  validateCreateBooking,
  validatePaginationAndFilters,
  validateReassignment,
  validateRejection,
} from "../validators/booking.validator.js";

const bookingRouter = Router();
const customerOnly = [authenticate, authorize("customer")];
const providerOnly = [authenticate, authorize("provider")];
const adminOnly = [authenticate, authorize("admin")];

bookingRouter.post(
  "/",
  ...customerOnly,
  validateCreateBooking,
  bookingController.create,
);
bookingRouter.get(
  "/my",
  ...customerOnly,
  validatePaginationAndFilters,
  bookingController.myBookings,
);
bookingRouter.get(
  "/provider/requests",
  ...providerOnly,
  validatePaginationAndFilters,
  bookingController.providerRequests,
);
bookingRouter.get(
  "/provider/active",
  ...providerOnly,
  validatePaginationAndFilters,
  bookingController.providerActive,
);
bookingRouter.get(
  "/provider/history",
  ...providerOnly,
  validatePaginationAndFilters,
  bookingController.providerHistory,
);
bookingRouter.get(
  "/admin",
  ...adminOnly,
  validatePaginationAndFilters,
  bookingController.adminList,
);
bookingRouter.patch(
  "/admin/:id/status",
  ...adminOnly,
  validateBookingId,
  validateAdminStatus,
  bookingController.adminStatus,
);
bookingRouter.patch(
  "/admin/:id/reassign-provider",
  ...adminOnly,
  validateBookingId,
  validateReassignment,
  bookingController.reassignProvider,
);
bookingRouter.get(
  "/:id",
  authenticate,
  validateBookingId,
  bookingController.details,
);
bookingRouter.patch(
  "/:id/cancel",
  ...customerOnly,
  validateBookingId,
  validateCancellation,
  bookingController.cancel,
);
bookingRouter.patch(
  "/:id/accept",
  ...providerOnly,
  validateBookingId,
  bookingController.accept,
);
bookingRouter.patch(
  "/:id/reject",
  ...providerOnly,
  validateBookingId,
  validateRejection,
  bookingController.reject,
);
bookingRouter.patch(
  "/:id/start",
  ...providerOnly,
  validateBookingId,
  bookingController.start,
);
bookingRouter.patch(
  "/:id/complete",
  ...providerOnly,
  validateBookingId,
  bookingController.complete,
);

export default bookingRouter;
