import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Rating must be an integer.",
      },
    },
    comment: { type: String, trim: true, maxlength: 2000, default: "" },
  },
  { timestamps: true, strict: true },
);

reviewSchema.index({ bookingId: 1, customerId: 1 }, { unique: true });
reviewSchema.index({ providerId: 1, createdAt: -1 });

export default mongoose.model("Review", reviewSchema);
