import crypto from "node:crypto";
import * as paymentService from "../services/payment.service.js";
import { env } from "../config/env.js";

export const createOrder = async (request, response) => {
  const data = await paymentService.createOrder(
    request.user._id,
    request.body.bookingId,
  );
  response
    .status(200)
    .json({
      success: true,
      message: "Payment order created successfully.",
      data,
    });
};

export const verify = async (request, response) => {
  const payment = await paymentService.verifyPayment(
    request.user._id,
    request.body,
  );
  response.json({
    success: true,
    message: "Payment verified successfully.",
    data: { payment },
  });
};

export const cashReceived = async (request, response) => {
  const payment = await paymentService.receiveCash(
    request.user._id,
    request.body.bookingId,
  );
  response.json({
    success: true,
    message: "Cash receipt reported. Admin verification is still required.",
    data: { payment },
  });
};

export const adminList = async (request, response) => {
  const data = await paymentService.listPayments({
    ...request.query,
    ...request.pagination,
  });
  response.json({
    success: true,
    message: "Payments fetched successfully.",
    data,
  });
};

export const adminDetails = async (request, response) => {
  const payment = await paymentService.getPayment(request.params.id);
  response.json({
    success: true,
    message: "Payment details fetched successfully.",
    data: { payment },
  });
};

export const adminVerify = async (request, response) => {
  const payment = await paymentService.verifyAdminPayment(
    request.params.id,
    request.user._id,
  );
  response.json({
    success: true,
    message: "Payment verified by admin successfully.",
    data: { payment },
  });
};

export const getCommission = async (request, response) => {
  const commissionPercentage = await paymentService.getCommissionPercentage();
  response.json({
    success: true,
    message: "Commission setting fetched successfully.",
    data: { commissionPercentage },
  });
};

export const updateCommission = async (request, response) => {
  const setting = await paymentService.updateCommission(
    request.user._id,
    request.body.commissionPercentage,
  );
  response.json({
    success: true,
    message: "Commission setting updated successfully.",
    data: { commissionPercentage: Number(setting.value) },
  });
};

export const settlements = async (request, response) => {
  const data = await paymentService.listSettlements(request.pagination);
  response.json({
    success: true,
    message: "Pending settlements fetched successfully.",
    data,
  });
};

export const settle = async (request, response) => {
  const payment = await paymentService.settlePayment(
    request.params.id,
    request.user._id,
    request.body.settlementReference,
    request.body.settlementNotes,
  );
  response.json({
    success: true,
    message: "Provider settlement recorded successfully.",
    data: { payment },
  });
};

export const razorpayWebhook = async (request, response) => {
  if (!env.razorpayWebhookSecret)
    return response
      .status(503)
      .json({ success: false, message: "Payment webhook is not configured." });
  const signature = request.headers["x-razorpay-signature"];
  const rawBody = request.rawBody;
  if (typeof signature !== "string" || !Buffer.isBuffer(rawBody))
    return response
      .status(400)
      .json({ success: false, message: "Invalid webhook request." });
  const expected = crypto
    .createHmac("sha256", env.razorpayWebhookSecret)
    .update(rawBody)
    .digest("hex");
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  )
    return response
      .status(400)
      .json({ success: false, message: "Invalid webhook signature." });
  try {
    const event = JSON.parse(rawBody.toString("utf8"));
    await paymentService.handleWebhook(event);
    response.json({
      success: true,
      message: "Webhook processed successfully.",
    });
  } catch {
    response
      .status(400)
      .json({ success: false, message: "Invalid webhook payload." });
  }
};
