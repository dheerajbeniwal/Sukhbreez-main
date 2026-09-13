import crypto from "node:crypto";
import Razorpay from "razorpay";
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import Settings from "../models/Settings.js";
import { env } from "../config/env.js";
import { notifyUser } from "./notification.service.js";

const commissionKey = "platform_commission_percentage";
const safeProjection = "-gatewaySignature";
const notFound = (message) => {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
};
const conflict = (message) => {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
};
const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};
const gatewayConfigured = () => {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    const error = new Error("Online payment is not configured.");
    error.statusCode = 503;
    throw error;
  }
};
const getGateway = () => {
  gatewayConfigured();
  return new Razorpay({
    key_id: env.razorpayKeyId,
    key_secret: env.razorpayKeySecret,
    timeout: env.razorpayTimeoutMs,
  });
};
const toPaise = (rupees) => Math.round(Number(rupees) * 100);

export const getCommissionPercentage = async () => {
  const setting = await Settings.findOne({ key: commissionKey }).lean();
  const value = setting ? Number(setting.value) : 10;
  if (!Number.isFinite(value) || value < 0 || value > 100)
    throw new Error("Platform commission setting is invalid.");
  return value;
};

const calculateCommission = async (amount) => {
  const commissionPercentage = await getCommissionPercentage();
  const commissionAmount = Number(
    ((amount * commissionPercentage) / 100).toFixed(2),
  );
  return {
    commissionPercentage,
    commissionAmount,
    providerPayableAmount: Number((amount - commissionAmount).toFixed(2)),
  };
};
const referenceId = (value) => value?._id?.toString() || value?.toString();
const paymentView = (payment) => ({
  id: referenceId(payment._id),
  bookingId: referenceId(payment.bookingId),
  customerId: referenceId(payment.customerId),
  providerId: referenceId(payment.providerId),
  amount: payment.amount,
  paymentMethod: payment.paymentMethod,
  paymentStatus: payment.paymentStatus,
  transactionReference: payment.transactionReference,
  gateway: payment.gateway,
  gatewayOrderId: payment.gatewayOrderId,
  gatewayPaymentId: payment.gatewayPaymentId,
  paidAt: payment.paidAt,
  commissionPercentage: payment.commissionPercentage,
  commissionAmount: payment.commissionAmount,
  providerPayableAmount: payment.providerPayableAmount,
  settlementStatus: payment.settlementStatus,
  verifiedByAdmin: referenceId(payment.verifiedByAdmin),
  verifiedAt: payment.verifiedAt,
  settledAt: payment.settledAt,
  settledByAdmin: referenceId(payment.settledByAdmin),
  settlementReference: payment.settlementReference,
  settlementNotes: payment.settlementNotes,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt,
});
const populatePayment = (query) =>
  query
    .populate("customerId", "_id fullName mobile profileImage")
    .populate("providerId", "_id fullName profileImage")
    .populate("bookingId", "bookingId status paymentStatus");

const getOwnedBooking = async (bookingId, customerId) => {
  const booking = await Booking.findOne({ _id: bookingId, customerId });
  if (!booking) throw notFound("Booking not found.");
  return booking;
};
const syncBookingStatus = async (bookingId, paymentStatus) => {
  await Booking.updateOne({ _id: bookingId }, { paymentStatus });
};
const ensurePayment = async (booking, paymentMethod) =>
  Payment.findOneAndUpdate(
    { bookingId: booking._id },
    {
      $setOnInsert: {
        bookingId: booking._id,
        customerId: booking.customerId,
        providerId: booking.providerId,
        amount: booking.amount,
        paymentMethod,
        paymentStatus: "pending",
        settlementStatus: "pending",
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

export const createOrder = async (customerId, bookingId) => {
  const booking = await getOwnedBooking(bookingId, customerId);
  if (
    !booking.providerId ||
    !["accepted", "in_progress", "completed"].includes(booking.status)
  )
    throw conflict("Booking is not eligible for payment.");
  if (!(booking.amount > 0))
    throw badRequest("Online payment amount must be greater than zero.");
  const existing = await Payment.findOne({ bookingId: booking._id });
  if (
    existing?.paymentStatus === "paid" ||
    existing?.paymentStatus === "verified"
  )
    throw conflict("Payment has already been completed.");
  if (existing && existing.paymentMethod !== "online")
    throw conflict("A non-online payment has already been reported.");
  const payment = await ensurePayment(booking, "online");
  if (payment.paymentMethod !== "online")
    throw conflict("A non-online payment has already been reported.");
  if (
    payment.paymentStatus === "paid" ||
    payment.paymentStatus === "verified"
  )
    throw conflict("Payment has already been completed.");
  if (payment.gatewayOrderId)
    return {
      payment: paymentView(payment),
      orderId: payment.gatewayOrderId,
      keyId: env.razorpayKeyId,
      amount: toPaise(payment.amount),
      currency: "INR",
    };
  const order = await getGateway().orders.create({
    amount: toPaise(booking.amount),
    currency: "INR",
    receipt: booking.bookingId,
    notes: { bookingId: booking._id.toString() },
  });
  // Atomic claim: only the first concurrent request may attach this order.
  // gatewayOrderId may be missing or stored as null; `$exists: false` alone is not enough.
  const claimed = await Payment.findOneAndUpdate(
    {
      _id: payment._id,
      paymentMethod: "online",
      paymentStatus: { $nin: ["paid", "verified"] },
      $or: [
        { gatewayOrderId: { $exists: false } },
        { gatewayOrderId: null },
        { gatewayOrderId: "" },
      ],
    },
    {
      $set: {
        gateway: "razorpay",
        gatewayOrderId: order.id,
        paymentMethod: "online",
      },
    },
    { new: true },
  );
  if (!claimed) {
    const winner = await Payment.findById(payment._id);
    if (winner?.paymentMethod !== "online")
      throw conflict("A non-online payment has already been reported.");
    if (!winner?.gatewayOrderId)
      throw conflict("Payment order could not be claimed.");
    return {
      payment: paymentView(winner),
      orderId: winner.gatewayOrderId,
      keyId: env.razorpayKeyId,
      amount: toPaise(winner.amount),
      currency: "INR",
    };
  }
  return {
    payment: paymentView(claimed),
    orderId: order.id,
    keyId: env.razorpayKeyId,
    amount: order.amount,
    currency: order.currency,
  };
};

export const verifyPayment = async (customerId, payload) => {
  const booking = await getOwnedBooking(payload.bookingId, customerId);
  const payment = await Payment.findOne({ bookingId: booking._id });
  if (!payment || payment.gatewayOrderId !== payload.razorpay_order_id)
    throw badRequest("Payment order does not match this booking.");
  if (payment.paymentMethod !== "online")
    throw conflict("This booking is not using online payment.");
  if (
    payment.gatewayPaymentId &&
    payment.gatewayPaymentId !== payload.razorpay_payment_id
  )
    throw badRequest("Payment does not match this booking.");
  if (payment.paymentStatus === "paid" || payment.paymentStatus === "verified")
    return paymentView(payment);
  gatewayConfigured();
  const expected = crypto
    .createHmac("sha256", env.razorpayKeySecret)
    .update(`${payload.razorpay_order_id}|${payload.razorpay_payment_id}`)
    .digest("hex");
  if (
    expected.length !== payload.razorpay_signature.length ||
    !crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(payload.razorpay_signature),
    )
  )
    throw badRequest("Invalid payment signature.");
  const commission = await calculateCommission(payment.amount);
  const updatedPayment = await Payment.findOneAndUpdate(
    {
      _id: payment._id,
      gatewayOrderId: payload.razorpay_order_id,
      paymentStatus: "pending",
    },
    {
      $set: {
        gatewayPaymentId: payload.razorpay_payment_id,
        gatewaySignature: payload.razorpay_signature,
        paymentStatus: "paid",
        paidAt: new Date(),
        ...commission,
      },
    },
    { new: true, runValidators: true },
  );
  if (!updatedPayment) {
    const currentPayment = await Payment.findById(payment._id);
    if (
      currentPayment?.paymentStatus === "paid" ||
      currentPayment?.paymentStatus === "verified"
    )
      return paymentView(currentPayment);
    throw conflict("Payment state changed before verification completed.");
  }
  await syncBookingStatus(booking._id, "paid");
  await notifyUser(updatedPayment.providerId, {
    type: "payment_updated",
    title: "Payment received",
    message: "Payment has been received for a completed service booking.",
    dedupeKey: `payment_updated:${updatedPayment._id}:paid`,
  });
  return paymentView(updatedPayment);
};

export const receiveCash = async (providerId, bookingId) => {
  const booking = await Booking.findOne({
    _id: bookingId,
    providerId,
    status: "completed",
  });
  if (!booking) throw notFound("Completed provider booking not found.");
  const existing = await Payment.findOne({ bookingId });
  if (
    existing?.paymentStatus === "verified" ||
    existing?.settlementStatus === "settled"
  )
    throw conflict("Payment is already finalized.");
  if (existing?.paymentMethod === "cash") return paymentView(existing);
  if (
    existing &&
    existing.paymentMethod === "online" &&
    !existing.gatewayOrderId &&
    !existing.gatewayPaymentId
  ) {
    existing.paymentMethod = "cash";
    await existing.save();
    return paymentView(existing);
  }
  if (existing) throw conflict("An online payment has already been started.");
  let payment;
  try {
    payment = await ensurePayment(booking, "cash");
  } catch (error) {
    if (error.code !== 11000) throw error;
    payment = await Payment.findOne({ bookingId });
    if (!payment) throw error;
  }
  if (payment.paymentMethod !== "cash") {
    if (payment.gatewayOrderId || payment.gatewayPaymentId)
      throw conflict("An online payment has already been started.");
    payment.paymentMethod = "cash";
    await payment.save();
  }
  if (
    payment.paymentStatus === "verified" ||
    payment.settlementStatus === "settled"
  )
    throw conflict("Payment is already finalized.");
  const updatedPayment = await Payment.findOneAndUpdate(
    { _id: payment._id, paymentMethod: "cash", paymentStatus: "pending" },
    { $set: { paymentMethod: "cash", paymentStatus: "pending" } },
    { new: true, runValidators: true },
  );
  if (!updatedPayment) {
    const currentPayment = await Payment.findById(payment._id);
    if (currentPayment?.paymentMethod !== "cash")
      throw conflict("An online payment has already been started.");
    return paymentView(currentPayment);
  }
  await notifyUser(payment.customerId, {
    type: "payment_updated",
    title: "Cash payment reported",
    message:
      "Your provider reported cash payment. Admin verification is pending.",
    dedupeKey: `payment_updated:${updatedPayment._id}:cash-reported`,
  });
  return paymentView(updatedPayment);
};

export const listPayments = async ({
  page,
  limit,
  paymentStatus,
  paymentMethod,
  bookingId,
  providerId,
  customerId,
}) => {
  const filter = {};
  for (const [field, value] of Object.entries({
    paymentStatus,
    paymentMethod,
    bookingId,
    providerId,
    customerId,
  }))
    if (value) filter[field] = value;
  const [total, payments] = await Promise.all([
    Payment.countDocuments(filter),
    populatePayment(
      Payment.find(filter)
        .select(safeProjection)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ).lean(),
  ]);
  return {
    payments: payments.map(paymentView),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};
export const getPayment = async (id) => {
  const payment = await populatePayment(
    Payment.findById(id).select(safeProjection),
  ).lean();
  if (!payment) throw notFound("Payment not found.");
  return paymentView(payment);
};

export const verifyAdminPayment = async (id, adminId) => {
  const payment = await Payment.findById(id);
  if (!payment) throw notFound("Payment not found.");
  if (payment.paymentStatus === "verified")
    throw conflict("Payment is already verified.");
  if (!["pending", "paid"].includes(payment.paymentStatus))
    throw conflict("Payment cannot be verified in its current state.");
  if (payment.paymentStatus === "pending" && payment.paymentMethod === "online")
    throw conflict("Online payment must be paid before admin verification.");
  const commission =
    payment.commissionPercentage === null ||
    payment.commissionAmount === null ||
    payment.providerPayableAmount === null
      ? await calculateCommission(payment.amount)
      : {};
  const updatedPayment = await Payment.findOneAndUpdate(
    {
      _id: id,
      $or: [
        { paymentStatus: "paid" },
        { paymentStatus: "pending", paymentMethod: { $ne: "online" } },
      ],
    },
    {
      $set: {
        ...commission,
        paymentStatus: "verified",
        verifiedByAdmin: adminId,
        verifiedAt: new Date(),
      },
    },
    { new: true, runValidators: true },
  );
  if (!updatedPayment)
    throw conflict("Payment state changed before verification.");
  await syncBookingStatus(updatedPayment.bookingId, "verified");
  await Promise.all([
    notifyUser(updatedPayment.customerId, {
      type: "payment_updated",
      title: "Payment verified",
      message: "Your payment has been verified by the platform.",
      dedupeKey: `payment_updated:${updatedPayment._id}:verified:customer`,
    }),
    notifyUser(updatedPayment.providerId, {
      type: "payment_updated",
      title: "Payment verified",
      message: "Payment for your completed service booking has been verified.",
      dedupeKey: `payment_updated:${updatedPayment._id}:verified:provider`,
    }),
  ]);
  return paymentView(updatedPayment);
};
export const updateCommission = async (adminId, commissionPercentage) =>
  Settings.findOneAndUpdate(
    { key: commissionKey },
    {
      value: String(commissionPercentage),
      description: "Platform commission percentage",
      updatedBy: adminId,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
export const listSettlements = async ({ page, limit }) => {
  const filter = {
    paymentStatus: "verified",
    settlementStatus: { $ne: "settled" },
  };
  const [total, payments] = await Promise.all([
    Payment.countDocuments(filter),
    populatePayment(
      Payment.find(filter)
        .select(safeProjection)
        .sort({ verifiedAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ).lean(),
  ]);
  return {
    payments: payments.map(paymentView),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};
export const settlePayment = async (id, adminId, reference, notes) => {
  const payment = await Payment.findById(id);
  if (!payment) throw notFound("Payment not found.");
  if (payment.paymentStatus !== "verified")
    throw conflict("Only verified payments can be settled.");
  if (payment.settlementStatus === "settled")
    throw conflict("Payment is already settled.");
  const settledPayment = await Payment.findOneAndUpdate(
    { _id: id, paymentStatus: "verified", settlementStatus: "pending" },
    {
      $set: {
        settlementStatus: "settled",
        settledAt: new Date(),
        settledByAdmin: adminId,
        settlementReference: reference.trim(),
        settlementNotes: notes?.trim() || "",
      },
    },
    { new: true, runValidators: true },
  );
  if (!settledPayment)
    throw conflict("Payment state changed before settlement.");
  return paymentView(settledPayment);
};

const unboundGatewayIds = (eventPaymentId) =>
  eventPaymentId
    ? {
        $or: [
          { gatewayPaymentId: { $exists: false } },
          { gatewayPaymentId: null },
          { gatewayPaymentId: eventPaymentId },
        ],
      }
    : {};

export const handleWebhook = async (event) => {
  const paymentEntity = event.payload?.payment?.entity;
  const orderEntity = event.payload?.order?.entity;
  const eventOrderId = paymentEntity?.order_id || orderEntity?.id;
  const eventPaymentId = paymentEntity?.id || null;
  if (!eventOrderId) return;
  const payment = await Payment.findOne({ gatewayOrderId: eventOrderId });
  if (!payment) return;
  if (String(event.event || "").startsWith("payment.")) {
    if (!eventPaymentId) return;
    if (payment.gatewayPaymentId && payment.gatewayPaymentId !== eventPaymentId)
      return;
  }
  if (event.event === "payment.captured" || event.event === "order.paid") {
    if (!["paid", "verified"].includes(payment.paymentStatus)) {
      const commission = await calculateCommission(payment.amount);
      const updatedPayment = await Payment.findOneAndUpdate(
        {
          _id: payment._id,
          gatewayOrderId: eventOrderId,
          paymentStatus: "pending",
          ...unboundGatewayIds(eventPaymentId),
        },
        {
          $set: {
            ...commission,
            paymentStatus: "paid",
            paidAt: new Date(),
            ...(eventPaymentId ? { gatewayPaymentId: eventPaymentId } : {}),
          },
        },
        { new: true, runValidators: true },
      );
      if (!updatedPayment) return;
      await syncBookingStatus(updatedPayment.bookingId, "paid");
      await notifyUser(updatedPayment.providerId, {
        type: "payment_updated",
        title: "Payment received",
        message: "Payment has been received for a completed service booking.",
        dedupeKey: `payment_updated:${updatedPayment._id}:paid`,
      });
    }
  } else if (
    event.event === "payment.failed" &&
    payment.paymentStatus === "pending"
  ) {
    const updatedPayment = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        gatewayOrderId: eventOrderId,
        paymentStatus: "pending",
        ...unboundGatewayIds(eventPaymentId),
      },
      { $set: { paymentStatus: "failed" } },
      { new: true, runValidators: true },
    );
    if (!updatedPayment) return;
    await syncBookingStatus(updatedPayment.bookingId, "failed");
    await notifyUser(updatedPayment.customerId, {
      type: "payment_updated",
      title: "Payment failed",
      message: "Your online payment could not be completed.",
      dedupeKey: `payment_updated:${updatedPayment._id}:failed`,
    });
  }
};
