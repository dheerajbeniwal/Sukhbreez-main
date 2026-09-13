import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
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
    amount: { type: Number, required: true, min: 0, immutable: true },
    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "bank_transfer", "other", "online"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "verified", "refunded", "failed"],
      default: "pending",
      index: true,
    },
    transactionReference: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    verifiedByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verifiedAt: { type: Date, default: null },
    refundReason: { type: String, trim: true, maxlength: 500, default: "" },
    gateway: { type: String, enum: ["razorpay"] },
    gatewayOrderId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    gatewayPaymentId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    gatewaySignature: {
      type: String,
      trim: true,
      select: false,
      default: null,
    },
    paidAt: { type: Date, default: null },
    commissionPercentage: { type: Number, min: 0, max: 100, default: null },
    commissionAmount: { type: Number, min: 0, default: null },
    providerPayableAmount: { type: Number, min: 0, default: null },
    settlementStatus: {
      type: String,
      enum: ["pending", "settled"],
      default: "pending",
      index: true,
    },
    settledAt: { type: Date, default: null },
    settledByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    settlementReference: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    settlementNotes: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { timestamps: true, strict: true },
);

export default mongoose.model("Payment", paymentSchema);
