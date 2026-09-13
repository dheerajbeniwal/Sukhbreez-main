import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      default: () => {
        const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
        const sequence = Math.floor(100000 + Math.random() * 900000);
        return `SB-${date}-${sequence}`;
      },
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    problemDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    address: {
      fullAddress: { type: String, required: true, trim: true, maxlength: 500 },
      city: { type: String, trim: true, maxlength: 100, default: "" },
      pincode: { type: String, trim: true, maxlength: 10, default: "" },
    },
    serviceDate: { type: Date, required: true, index: true },
    preferredTime: { type: String, required: true, trim: true, maxlength: 50 },
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "rejected",
        "in_progress",
        "completed",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "verified", "refunded", "failed"],
      default: "pending",
      index: true,
    },
    amount: { type: Number, min: 0, default: 0, immutable: true },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: "" },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true, strict: true },
);

bookingSchema.index({ customerId: 1, createdAt: -1 });
bookingSchema.index({ providerId: 1, status: 1, serviceDate: 1 });
bookingSchema.index({ categoryId: 1, serviceDate: 1 });
bookingSchema.index({ createdAt: -1 });

export default mongoose.model("Booking", bookingSchema);
