import { Router } from "express";
import * as notificationController from "../controllers/notification.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  parseNotificationQuery,
  validateEmptyBody,
  validateNotificationId,
} from "../validators/notification.validator.js";

const notificationRouter = Router();
notificationRouter.use(authenticate);

notificationRouter.get(
  "/",
  parseNotificationQuery,
  notificationController.list,
);
notificationRouter.get("/unread-count", notificationController.unreadCount);
notificationRouter.patch(
  "/:id/read",
  validateNotificationId,
  validateEmptyBody,
  notificationController.markRead,
);
notificationRouter.patch(
  "/read-all",
  validateEmptyBody,
  notificationController.markAllRead,
);

export default notificationRouter;
