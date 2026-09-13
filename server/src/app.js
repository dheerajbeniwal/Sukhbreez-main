import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import { fileURLToPath } from "node:url";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import authRouter from "./routes/auth.routes.js";
import categoryRouter from "./routes/category.routes.js";
import bookingRouter from "./routes/booking.routes.js";
import devAuthRouter from "./routes/dev-auth.routes.js";
import healthRouter from "./routes/health.routes.js";
import providerRouter from "./routes/provider.routes.js";
import paymentRouter from "./routes/payment.routes.js";
import reviewRouter from "./routes/review.routes.js";
import notificationRouter from "./routes/notification.routes.js";

const uploadsDirectory = fileURLToPath(new URL("./uploads", import.meta.url));

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(
  express.json({
    limit: "1mb",
    verify: (request, response, buffer) => {
      if (
        request.originalUrl.split("?")[0] ===
        "/api/v1/payments/webhook/razorpay"
      )
        request.rawBody = Buffer.from(buffer);
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.use("/uploads", express.static(uploadsDirectory));

app.use("/api/health", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/providers", providerRouter);
app.use("/api/v1/bookings", bookingRouter);
app.use("/api/v1/payments", paymentRouter);
app.use("/api/v1/reviews", reviewRouter);
app.use("/api/v1/notifications", notificationRouter);
if (env.nodeEnv !== "production") app.use("/api/v1/dev-auth", devAuthRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
