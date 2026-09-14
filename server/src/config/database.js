import mongoose from "mongoose";
import { env } from "./env.js";

export const connectDatabase = async () => {
  if (!env.mongodbUri) {
    console.warn(
      "MONGODB_URI is not configured; starting without a database connection.",
    );
    return;
  }

  await mongoose.connect(env.mongodbUri, {
    maxPoolSize: env.mongodbMaxPoolSize,
  });
  console.log("MongoDB connected");
};
