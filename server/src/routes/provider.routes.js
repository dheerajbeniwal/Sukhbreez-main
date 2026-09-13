import { Router } from "express";
import * as providerController from "../controllers/provider.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  parseProviderQuery,
  validateApproval,
  validateAvailability,
  validateProviderId,
  validateProviderStatus,
  validateProviderUpdate,
} from "../validators/provider.validator.js";

const providerRouter = Router();
const customerOnly = [authenticate, authorize("customer")];
const providerOnly = [authenticate, authorize("provider")];
const adminOnly = [authenticate, authorize("admin")];

providerRouter.get(
  "/",
  ...customerOnly,
  parseProviderQuery,
  providerController.listPublic,
);
providerRouter.get("/me", ...providerOnly, providerController.ownProfile);
providerRouter.patch(
  "/me",
  ...providerOnly,
  validateProviderUpdate,
  providerController.updateOwnProfile,
);
providerRouter.patch(
  "/me/availability",
  ...providerOnly,
  validateAvailability,
  providerController.updateAvailability,
);
providerRouter.get(
  "/admin",
  ...adminOnly,
  parseProviderQuery,
  providerController.listAdmin,
);
providerRouter.get(
  "/admin/:id",
  ...adminOnly,
  validateProviderId,
  providerController.detailsAdmin,
);
providerRouter.patch(
  "/admin/:id/approval",
  ...adminOnly,
  validateProviderId,
  validateApproval,
  providerController.updateApproval,
);
providerRouter.patch(
  "/admin/:id/status",
  ...adminOnly,
  validateProviderId,
  validateProviderStatus,
  providerController.updateStatus,
);
providerRouter.get(
  "/:id",
  ...customerOnly,
  validateProviderId,
  providerController.detailsPublic,
);

export default providerRouter;
