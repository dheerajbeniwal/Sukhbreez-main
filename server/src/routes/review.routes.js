import { Router } from "express";
import * as reviewController from "../controllers/review.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  parseAdminReviewQuery,
  parseCustomerReviewQuery,
  parseProviderReviewQuery,
  validateBookingReviewId,
  validateProviderReviewId,
  validateReviewCreate,
  validateReviewId,
} from "../validators/review.validator.js";

const reviewRouter = Router();
const customerOnly = [authenticate, authorize("customer")];
const providerOnly = [authenticate, authorize("provider")];
const adminOnly = [authenticate, authorize("admin")];

reviewRouter.post(
  "/",
  ...customerOnly,
  validateReviewCreate,
  reviewController.create,
);
reviewRouter.get(
  "/my",
  ...customerOnly,
  parseCustomerReviewQuery,
  reviewController.myReviews,
);
reviewRouter.get(
  "/booking/:bookingId",
  ...customerOnly,
  validateBookingReviewId,
  reviewController.bookingReview,
);
reviewRouter.get(
  "/provider/me",
  ...providerOnly,
  parseProviderReviewQuery,
  reviewController.providerReviews,
);
reviewRouter.get(
  "/provider/:providerId",
  validateProviderReviewId,
  parseProviderReviewQuery,
  reviewController.publicProviderReviews,
);
reviewRouter.get(
  "/admin",
  ...adminOnly,
  parseAdminReviewQuery,
  reviewController.adminList,
);
reviewRouter.get(
  "/admin/:id",
  ...adminOnly,
  validateReviewId,
  reviewController.adminDetails,
);
reviewRouter.delete(
  "/admin/:id",
  ...adminOnly,
  validateReviewId,
  reviewController.adminDelete,
);

export default reviewRouter;
