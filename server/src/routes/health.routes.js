import { Router } from "express";

const healthRouter = Router();

healthRouter.get("/", (request, response) => {
  response.json({ success: true, message: "Sukh Breeze API is running." });
});

export default healthRouter;
