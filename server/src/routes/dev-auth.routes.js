import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware.js";

const devAuthRouter = Router();
const ok = (role) => (request, response) =>
  response.json({ success: true, role, userId: request.user._id.toString() });

devAuthRouter.get(
  "/customer",
  authenticate,
  authorize("customer"),
  ok("customer"),
);
devAuthRouter.get(
  "/provider",
  authenticate,
  authorize("provider"),
  ok("provider"),
);
devAuthRouter.get("/admin", authenticate, authorize("admin"), ok("admin"));

export default devAuthRouter;
