import mongoose from "mongoose";

const providerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    experience: { type: Number, required: true, min: 0, max: 80 },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    bio: { type: String, trim: true, maxlength: 1000, default: "" },
    startingCharge: {
      type: Number,
      min: 0,
      default: null,
      validate: {
        validator(value) {
          return value === null || Number(value) > 0;
        },
        message: "Starting charge must be greater than zero.",
      },
    },
    availability: { type: Boolean, default: false },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    accountStatus: {
      type: String,
      enum: ["active", "blocked", "suspended"],
      default: "active",
      index: true,
    },
    ratingAverage: { type: Number, min: 0, max: 5, default: 0 },
    totalReviews: { type: Number, min: 0, default: 0 },
    totalCompletedJobs: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.model("ProviderProfile", providerProfileSchema);
