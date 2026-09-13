import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "booking_created",
        "booking_accepted",
        "booking_rejected",
        "booking_started",
        "booking_completed",
        "booking_cancelled",
        "payment_updated",
        "review_received",
        "system",
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    isRead: { type: Boolean, default: false },
    dedupeKey: { type: String, trim: true, unique: true, sparse: true },
  },
  { timestamps: true, strict: true },
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
