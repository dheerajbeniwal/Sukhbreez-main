import { Router } from "express";
import * as categoryController from "../controllers/category.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import {
  validateCategoryCreate,
  validateCategoryId,
  validateCategoryStatus,
  validateCategoryUpdate,
} from "../validators/category.validator.js";

const categoryRouter = Router();
const adminOnly = [authenticate, authorize("admin")];

categoryRouter.get("/", categoryController.listPublic);
categoryRouter.get("/admin", ...adminOnly, categoryController.listAdmin);
categoryRouter.post(
  "/",
  ...adminOnly,
  validateCategoryCreate,
  categoryController.create,
);
categoryRouter.patch(
  "/:id",
  ...adminOnly,
  validateCategoryUpdate,
  categoryController.update,
);
categoryRouter.patch(
  "/:id/status",
  ...adminOnly,
  validateCategoryStatus,
  categoryController.updateStatus,
);
categoryRouter.delete(
  "/:id",
  ...adminOnly,
  validateCategoryId,
  categoryController.remove,
);

export default categoryRouter;
