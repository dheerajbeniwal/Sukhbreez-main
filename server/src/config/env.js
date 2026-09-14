import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const environmentFile = fileURLToPath(new URL("../../.env", import.meta.url));
dotenv.config({ path: environmentFile });

const requiredInProduction = [
  "MONGODB_URI",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
];
const developmentAccessSecret = "development-access-secret-change-me";
const developmentRefreshSecret = "development-refresh-secret-change-me";

if (process.env.NODE_ENV === "production") {
  const missing = requiredInProduction.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
  if (
    process.env.JWT_ACCESS_SECRET === developmentAccessSecret ||
    process.env.JWT_REFRESH_SECRET === developmentRefreshSecret
  ) {
    throw new Error(
      "Production JWT secrets must not use development default values.",
    );
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  mongodbUri: process.env.MONGODB_URI || "",
  mongodbMaxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE) || 50,
  disableRateLimit:
    process.env.NODE_ENV !== "production" &&
    process.env.DISABLE_RATE_LIMIT === "true",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || developmentAccessSecret,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || developmentRefreshSecret,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  adminSeedMobile: process.env.ADMIN_SEED_MOBILE || "",
  adminSeedPassword: process.env.ADMIN_SEED_PASSWORD || "",
  adminSeedFullName: process.env.ADMIN_SEED_FULL_NAME || "Platform Admin",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "",
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  razorpayTimeoutMs: Number(process.env.RAZORPAY_TIMEOUT_MS) || 10000,
};
