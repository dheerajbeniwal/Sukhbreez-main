/**
 * Isolated database-backed regression for backend stabilization.
 * Creates only `__sb_stab_*` records and deletes them after the run.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import app from "../src/app.js";
import { env } from "../src/config/env.js";
import Booking from "../src/models/Booking.js";
import Category from "../src/models/Category.js";
import Notification from "../src/models/Notification.js";
import Payment from "../src/models/Payment.js";
import ProviderProfile from "../src/models/ProviderProfile.js";
import RefreshToken from "../src/models/RefreshToken.js";
import Review from "../src/models/Review.js";
import User from "../src/models/User.js";

const stamp = `${Date.now()}`.slice(-8);
const marker = `__sb_stab_${stamp}`;
const password = "StabTest!234";
const results = [];
const ids = {
  users: [],
  category: null,
  bookings: [],
  payments: [],
  reviews: [],
};

const record = (name, status, body) => {
  results.push({
    name,
    status,
    success: body?.success,
    message: body?.message,
  });
  return body;
};

const json = async (response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
};

describe("SUKH BREEZE database-backed stabilization", () => {
  let server;
  let baseUrl;
  let customerToken;
  let otherCustomerToken;
  let providerToken;
  let adminToken;
  let customerId;
  let otherCustomerId;
  let providerId;
  let adminId;
  let categoryId;
  let bookingId;
  let cashBookingId;
  let webhookBookingId;
  let webhookPaymentId;
  let reviewId;
  let notificationId;
  const startingCharge = 500;

  const request = async (method, path, { token, body, headers } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body:
        body === undefined
          ? undefined
          : Buffer.isBuffer(body)
            ? body
            : JSON.stringify(body),
    });
    const parsed = await json(response);
    return { status: response.status, body: parsed };
  };

  const completeBooking = async (id) => {
    const accept = await request("PATCH", `/api/v1/bookings/${id}/accept`, {
      token: providerToken,
    });
    assert.equal(accept.status, 200, JSON.stringify(accept.body));
    const start = await request("PATCH", `/api/v1/bookings/${id}/start`, {
      token: providerToken,
    });
    assert.equal(start.status, 200, JSON.stringify(start.body));
    const complete = await request("PATCH", `/api/v1/bookings/${id}/complete`, {
      token: providerToken,
    });
    assert.equal(complete.status, 200, JSON.stringify(complete.body));
  };

  const createBooking = async (token, extra = {}) => {
    const serviceDate = new Date(Date.now() + 86400000).toISOString();
    return request("POST", "/api/v1/bookings", {
      token,
      body: {
        categoryId,
        providerId,
        problemDescription: `${marker} leaking tap`,
        address: { fullAddress: "12 Test Street", city: "TestCity", pincode: "110001" },
        serviceDate,
        preferredTime: "10:00-12:00",
        ...extra,
      },
    });
  };

  before(async () => {
    if (!env.mongodbUri) {
      throw new Error("MONGODB_URI is not configured; cannot run database-backed tests.");
    }
    await mongoose.connect(env.mongodbUri);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    try {
      const userIds = ids.users.filter(Boolean);
      if (userIds.length) {
        await Promise.all([
          RefreshToken.deleteMany({ user: { $in: userIds } }),
          Notification.deleteMany({ userId: { $in: userIds } }),
          Review.deleteMany({
            $or: [
              { customerId: { $in: userIds } },
              { providerId: { $in: userIds } },
            ],
          }),
          Payment.deleteMany({
            $or: [
              { customerId: { $in: userIds } },
              { providerId: { $in: userIds } },
            ],
          }),
          Booking.deleteMany({
            $or: [
              { customerId: { $in: userIds } },
              { providerId: { $in: userIds } },
            ],
          }),
          ProviderProfile.deleteMany({ userId: { $in: userIds } }),
          User.deleteMany({ _id: { $in: userIds } }),
        ]);
      }
      if (ids.category) await Category.deleteOne({ _id: ids.category });
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await mongoose.disconnect();
      console.log("STABILIZATION_TEST_RESULTS", JSON.stringify(results, null, 2));
    }
  });

  it("connects to MongoDB and serves health", async () => {
    assert.equal(mongoose.connection.readyState, 1);
    const { status, body } = await request("GET", "/api/health");
    record("GET /api/health", status, body);
    assert.equal(status, 200);
    assert.equal(body.success, true);
  });

  it("registers users and enforces authz", async () => {
    const category = await Category.create({
      name: `${marker}-plumbing`,
      slug: `${marker}-plumbing`,
      description: "Temporary stabilization category",
      isActive: true,
    });
    ids.category = category._id;
    categoryId = category._id.toString();

    const customerMobile = `91${stamp}`;
    const otherMobile = `92${stamp}`;
    const providerMobile = `93${stamp}`;
    const adminMobile = `94${stamp}`;

    const customerReg = await request("POST", "/api/v1/auth/register/customer", {
      body: {
        fullName: `${marker} Customer`,
        mobile: customerMobile,
        password,
        confirmPassword: password,
      },
    });
    record("POST /api/v1/auth/register/customer", customerReg.status, customerReg.body);
    assert.equal(customerReg.status, 201);
    customerId = customerReg.body.data.user.id;
    ids.users.push(customerId);

    const otherReg = await request("POST", "/api/v1/auth/register/customer", {
      body: {
        fullName: `${marker} Other`,
        mobile: otherMobile,
        password,
        confirmPassword: password,
      },
    });
    record("POST /api/v1/auth/register/customer (other)", otherReg.status, otherReg.body);
    assert.equal(otherReg.status, 201);
    otherCustomerId = otherReg.body.data.user.id;
    ids.users.push(otherCustomerId);

    const providerReg = await request("POST", "/api/v1/auth/register/provider", {
      body: {
        fullName: `${marker} Provider`,
        mobile: providerMobile,
        password,
        confirmPassword: password,
        categoryId,
        experience: 4,
        address: "Provider test address",
      },
    });
    record("POST /api/v1/auth/register/provider", providerReg.status, providerReg.body);
    assert.equal(providerReg.status, 201);
    providerId = providerReg.body.data.user.id;
    ids.users.push(providerId);

    const pendingLogin = await request("POST", "/api/v1/auth/login", {
      body: { mobile: providerMobile, password },
    });
    record("POST /api/v1/auth/login (unapproved provider)", pendingLogin.status, pendingLogin.body);
    assert.equal(pendingLogin.status, 403);

    await ProviderProfile.updateOne(
      { userId: providerId },
      {
        $set: {
          approvalStatus: "approved",
          accountStatus: "active",
          availability: true,
          startingCharge,
        },
      },
    );

    const admin = await User.create({
      fullName: `${marker} Admin`,
      mobile: adminMobile,
      password: await bcrypt.hash(password, 12),
      role: "admin",
      accountStatus: "active",
    });
    adminId = admin._id.toString();
    ids.users.push(adminId);

    const customerLogin = await request("POST", "/api/v1/auth/login", {
      body: { mobile: customerMobile, password },
    });
    record("POST /api/v1/auth/login (customer)", customerLogin.status, customerLogin.body);
    assert.equal(customerLogin.status, 200);
    customerToken = customerLogin.body.data.accessToken;

    const otherLogin = await request("POST", "/api/v1/auth/login", {
      body: { mobile: otherMobile, password },
    });
    record("POST /api/v1/auth/login (other customer)", otherLogin.status, otherLogin.body);
    assert.equal(otherLogin.status, 200);
    otherCustomerToken = otherLogin.body.data.accessToken;

    const providerLogin = await request("POST", "/api/v1/auth/login", {
      body: { mobile: providerMobile, password },
    });
    record("POST /api/v1/auth/login (provider)", providerLogin.status, providerLogin.body);
    assert.equal(providerLogin.status, 200);
    providerToken = providerLogin.body.data.accessToken;

    const adminLogin = await request("POST", "/api/v1/auth/admin/login", {
      body: { mobile: adminMobile, password },
    });
    record("POST /api/v1/auth/admin/login", adminLogin.status, adminLogin.body);
    assert.equal(adminLogin.status, 200);
    adminToken = adminLogin.body.data.accessToken;

    const me = await request("GET", " /api/v1/auth/me".trim(), { token: customerToken });
    record("GET /api/v1/auth/me", me.status, me.body);
    assert.equal(me.status, 200);

    const providerOnCustomer = await request("GET", "/api/v1/bookings/provider/requests", {
      token: customerToken,
    });
    record("GET /api/v1/bookings/provider/requests (customer)", providerOnCustomer.status, providerOnCustomer.body);
    assert.equal(providerOnCustomer.status, 403);

    const adminOnCustomer = await request("GET", "/api/v1/payments/admin", {
      token: customerToken,
    });
    record("GET /api/v1/payments/admin (customer)", adminOnCustomer.status, adminOnCustomer.body);
    assert.equal(adminOnCustomer.status, 403);
  });

  it("creates a server-priced booking and rejects client amount", async () => {
    const created = await createBooking(customerToken);
    record("POST /api/v1/bookings", created.status, created.body);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    bookingId = created.body.data.booking.id;
    ids.bookings.push(bookingId);
    assert.equal(created.body.data.booking.amount, startingCharge);

    const manipulated = await createBooking(customerToken, { amount: 1 });
    record("POST /api/v1/bookings (client amount)", manipulated.status, manipulated.body);
    assert.equal(manipulated.status, 400);

    const foreign = await request("GET", `/api/v1/bookings/${bookingId}`, {
      token: otherCustomerToken,
    });
    record("GET /api/v1/bookings/:id (other customer)", foreign.status, foreign.body);
    assert.equal(foreign.status, 404);

    const owner = await request("GET", `/api/v1/bookings/${bookingId}`, {
      token: customerToken,
    });
    record("GET /api/v1/bookings/:id (owner)", owner.status, owner.body);
    assert.equal(owner.status, 200);
    assert.equal(owner.body.data.booking.amount, startingCharge);
  });

  it("enforces booking transitions", async () => {
    const invalidComplete = await request("PATCH", `/api/v1/bookings/${bookingId}/complete`, {
      token: providerToken,
    });
    record("PATCH /api/v1/bookings/:id/complete (from pending)", invalidComplete.status, invalidComplete.body);
    assert.equal(invalidComplete.status, 409);

    await completeBooking(bookingId);
    record("provider accept/start/complete", 200, { success: true, message: "valid transitions" });

    const afterComplete = await request("PATCH", `/api/v1/bookings/${bookingId}/cancel`, {
      token: customerToken,
      body: { cancellationReason: "too late" },
    });
    record("PATCH /api/v1/bookings/:id/cancel (completed)", afterComplete.status, afterComplete.body);
    assert.equal(afterComplete.status, 409);

    const cancelable = await createBooking(customerToken);
    assert.equal(cancelable.status, 201, JSON.stringify(cancelable.body));
    const cancelId = cancelable.body.data.booking.id;
    ids.bookings.push(cancelId);
    const cancelled = await request("PATCH", `/api/v1/bookings/${cancelId}/cancel`, {
      token: customerToken,
      body: { cancellationReason: "changed plans" },
    });
    record("PATCH /api/v1/bookings/:id/cancel (pending)", cancelled.status, cancelled.body);
    assert.equal(cancelled.status, 200);
  });

  it("covers payment, cash/online conflict, commission, and settlement", async () => {
    const cashCreated = await createBooking(customerToken);
    assert.equal(cashCreated.status, 201, JSON.stringify(cashCreated.body));
    cashBookingId = cashCreated.body.data.booking.id;
    ids.bookings.push(cashBookingId);
    await completeBooking(cashBookingId);

    const order = await request("POST", "/api/v1/payments/create-order", {
      token: customerToken,
      body: { bookingId },
    });
    record("POST /api/v1/payments/create-order", order.status, order.body);
    if (order.status === 200) {
      assert.equal(order.body.data.amount, startingCharge * 100);
      const duplicate = await request("POST", "/api/v1/payments/create-order", {
        token: customerToken,
        body: { bookingId },
      });
      record("POST /api/v1/payments/create-order (duplicate)", duplicate.status, duplicate.body);
      assert.equal(duplicate.status, 200);
      assert.equal(duplicate.body.data.orderId, order.body.data.orderId);
    } else {
      assert.ok([503, 500].includes(order.status));
    }

    let gatewayOrderId = order.body?.data?.orderId;
    if (!gatewayOrderId) {
      gatewayOrderId = `order_${marker}_local`;
      await Payment.findOneAndUpdate(
        { bookingId },
        {
          $setOnInsert: {
            bookingId,
            customerId,
            providerId,
            amount: startingCharge,
            paymentMethod: "online",
            paymentStatus: "pending",
            settlementStatus: "pending",
          },
          $set: { gateway: "razorpay", gatewayOrderId },
        },
        { upsert: true, new: true },
      );
    }

    const signature = crypto
      .createHmac("sha256", env.razorpayKeySecret || "test-razorpay-secret")
      .update(`${gatewayOrderId}|pay_${marker}`)
      .digest("hex");
    if (!env.razorpayKeySecret) {
      record("POST /api/v1/payments/verify", 0, {
        success: false,
        message: "BLOCKED BY CONFIGURATION: RAZORPAY_KEY_SECRET missing",
      });
    } else {
      const verify = await request("POST", "/api/v1/payments/verify", {
        token: customerToken,
        body: {
          bookingId,
          razorpay_order_id: gatewayOrderId,
          razorpay_payment_id: `pay_${marker}`,
          razorpay_signature: signature,
        },
      });
      record("POST /api/v1/payments/verify", verify.status, verify.body);
      assert.equal(verify.status, 200, JSON.stringify(verify.body));
      assert.equal(verify.body.data.payment.amount, startingCharge);
      assert.equal(verify.body.data.payment.commissionPercentage, 10);
      assert.equal(verify.body.data.payment.commissionAmount, 50);
      assert.equal(verify.body.data.payment.providerPayableAmount, 450);

      const verifyAgain = await request("POST", "/api/v1/payments/verify", {
        token: customerToken,
        body: {
          bookingId,
          razorpay_order_id: gatewayOrderId,
          razorpay_payment_id: `pay_${marker}`,
          razorpay_signature: signature,
        },
      });
      record("POST /api/v1/payments/verify (repeat)", verifyAgain.status, verifyAgain.body);
      assert.equal(verifyAgain.status, 200);
      assert.equal(verifyAgain.body.data.payment.paymentStatus, "paid");

      const cashOnOnline = await request("POST", "/api/v1/payments/cash/received", {
        token: providerToken,
        body: { bookingId },
      });
      record("POST /api/v1/payments/cash/received (online exists)", cashOnOnline.status, cashOnOnline.body);
      assert.equal(cashOnOnline.status, 409);
    }

    const cash = await request("POST", "/api/v1/payments/cash/received", {
      token: providerToken,
      body: { bookingId: cashBookingId },
    });
    record("POST /api/v1/payments/cash/received", cash.status, cash.body);
    assert.equal(cash.status, 200, JSON.stringify(cash.body));
    const cashRepeat = await request("POST", "/api/v1/payments/cash/received", {
      token: providerToken,
      body: { bookingId: cashBookingId },
    });
    record("POST /api/v1/payments/cash/received (repeat)", cashRepeat.status, cashRepeat.body);
    assert.equal(cashRepeat.status, 200);

    const onlineOnCash = await request("POST", "/api/v1/payments/create-order", {
      token: customerToken,
      body: { bookingId: cashBookingId },
    });
    record("POST /api/v1/payments/create-order (cash exists)", onlineOnCash.status, onlineOnCash.body);
    assert.ok([409, 503].includes(onlineOnCash.status));
    if (onlineOnCash.status === 409) assert.equal(onlineOnCash.body.success, false);

    const cashPaymentId = cash.body.data.payment.id;
    ids.payments.push(cashPaymentId);
    const adminVerify = await request("PATCH", `/api/v1/payments/admin/${cashPaymentId}/verify`, {
      token: adminToken,
    });
    record("PATCH /api/v1/payments/admin/:id/verify", adminVerify.status, adminVerify.body);
    assert.equal(adminVerify.status, 200);
    assert.equal(adminVerify.body.data.payment.commissionAmount, 50);
    assert.equal(adminVerify.body.data.payment.providerPayableAmount, 450);

    const adminVerifyAgain = await request(
      "PATCH",
      `/api/v1/payments/admin/${cashPaymentId}/verify`,
      { token: adminToken },
    );
    record("PATCH /api/v1/payments/admin/:id/verify (repeat)", adminVerifyAgain.status, adminVerifyAgain.body);
    assert.equal(adminVerifyAgain.status, 409);

    const settle = await request("PATCH", `/api/v1/payments/admin/${cashPaymentId}/settle`, {
      token: adminToken,
      body: { settlementReference: `${marker}-settle` },
    });
    record("PATCH /api/v1/payments/admin/:id/settle", settle.status, settle.body);
    assert.equal(settle.status, 200);
    const settleAgain = await request("PATCH", `/api/v1/payments/admin/${cashPaymentId}/settle`, {
      token: adminToken,
      body: { settlementReference: `${marker}-settle-2` },
    });
    record("PATCH /api/v1/payments/admin/:id/settle (repeat)", settleAgain.status, settleAgain.body);
    assert.equal(settleAgain.status, 409);
  });

  it("binds Razorpay webhooks to stored gateway identifiers", async () => {
    const webhookBooking = await createBooking(customerToken);
    assert.equal(webhookBooking.status, 201, JSON.stringify(webhookBooking.body));
    webhookBookingId = webhookBooking.body.data.booking.id;
    ids.bookings.push(webhookBookingId);
    await completeBooking(webhookBookingId);

    const payment = await Payment.create({
      bookingId: webhookBookingId,
      customerId,
      providerId,
      amount: startingCharge,
      paymentMethod: "online",
      paymentStatus: "pending",
      gateway: "razorpay",
      gatewayOrderId: `order_${marker}_wh`,
      gatewayPaymentId: `pay_${marker}_wh`,
    });
    webhookPaymentId = payment._id.toString();
    ids.payments.push(webhookPaymentId);

    const invalid = await request("POST", "/api/v1/payments/webhook/razorpay", {
      body: { event: "payment.captured" },
      headers: { "x-razorpay-signature": "invalid" },
    });
    record("POST webhook invalid signature", invalid.status, invalid.body);
    if (!env.razorpayWebhookSecret) {
      assert.equal(invalid.status, 503);
    } else {
      assert.equal(invalid.status, 400);

      const payload = Buffer.from(
        JSON.stringify({
          event: "payment.captured",
          payload: {
            payment: {
              entity: {
                id: "pay_unrelated",
                order_id: `order_${marker}_wh`,
              },
            },
          },
        }),
      );
      const signature = crypto
        .createHmac("sha256", env.razorpayWebhookSecret)
        .update(payload)
        .digest("hex");
      const mismatched = await request("POST", "/api/v1/payments/webhook/razorpay", {
        body: payload,
        headers: {
          "content-type": "application/json",
          "x-razorpay-signature": signature,
        },
      });
      record("POST webhook mismatched gatewayPaymentId", mismatched.status, mismatched.body);
      assert.equal(mismatched.status, 200);
      const unchanged = await Payment.findById(webhookPaymentId);
      assert.equal(unchanged.paymentStatus, "pending");

      const validPayload = Buffer.from(
        JSON.stringify({
          event: "payment.captured",
          payload: {
            payment: {
              entity: {
                id: `pay_${marker}_wh`,
                order_id: `order_${marker}_wh`,
              },
            },
          },
        }),
      );
      const validSignature = crypto
        .createHmac("sha256", env.razorpayWebhookSecret)
        .update(validPayload)
        .digest("hex");
      const valid = await request("POST", "/api/v1/payments/webhook/razorpay", {
        body: validPayload,
        headers: {
          "content-type": "application/json",
          "x-razorpay-signature": validSignature,
        },
      });
      record("POST webhook valid captured", valid.status, valid.body);
      assert.equal(valid.status, 200);
      const captured = await Payment.findById(webhookPaymentId);
      assert.equal(captured.paymentStatus, "paid");

      const repeat = await request("POST", "/api/v1/payments/webhook/razorpay", {
        body: validPayload,
        headers: {
          "content-type": "application/json",
          "x-razorpay-signature": validSignature,
        },
      });
      record("POST webhook repeated captured", repeat.status, repeat.body);
      assert.equal(repeat.status, 200);
      const afterRepeat = await Payment.findById(webhookPaymentId);
      assert.equal(afterRepeat.paymentStatus, "paid");
      assert.equal(afterRepeat.commissionAmount, captured.commissionAmount);
    }
  });

  it("enforces review rules and rating recalculation", async () => {
    const unauthorized = await request("POST", "/api/v1/reviews", {
      token: otherCustomerToken,
      body: { bookingId, rating: 5, comment: "not mine" },
    });
    record("POST /api/v1/reviews (unauthorized)", unauthorized.status, unauthorized.body);
    assert.equal(unauthorized.status, 404);

    const pendingReviewBooking = await createBooking(customerToken);
    assert.equal(pendingReviewBooking.status, 201);
    ids.bookings.push(pendingReviewBooking.body.data.booking.id);
    const notCompleted = await request("POST", "/api/v1/reviews", {
      token: customerToken,
      body: { bookingId: pendingReviewBooking.body.data.booking.id, rating: 5 },
    });
    record("POST /api/v1/reviews (not completed)", notCompleted.status, notCompleted.body);
    assert.equal(notCompleted.status, 404);

    const created = await request("POST", "/api/v1/reviews", {
      token: customerToken,
      body: { bookingId, rating: 5, comment: `${marker} excellent` },
    });
    record("POST /api/v1/reviews", created.status, created.body);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    reviewId = created.body.data.review.id;
    ids.reviews.push(reviewId);

    const duplicate = await request("POST", "/api/v1/reviews", {
      token: customerToken,
      body: { bookingId, rating: 4 },
    });
    record("POST /api/v1/reviews (duplicate)", duplicate.status, duplicate.body);
    assert.equal(duplicate.status, 409);

    const profile = await ProviderProfile.findOne({ userId: providerId }).lean();
    assert.equal(profile.totalReviews, 1);
    assert.equal(profile.ratingAverage, 5);

    const deleted = await request("DELETE", `/api/v1/reviews/admin/${reviewId}`, {
      token: adminToken,
    });
    record("DELETE /api/v1/reviews/admin/:id", deleted.status, deleted.body);
    assert.equal(deleted.status, 200);
    const afterDelete = await ProviderProfile.findOne({ userId: providerId }).lean();
    assert.equal(afterDelete.totalReviews, 0);
    assert.equal(afterDelete.ratingAverage, 0);
  });

  it("protects notifications and deduplicates events", async () => {
    const list = await request("GET", "/api/v1/notifications?page=1&limit=10", {
      token: customerToken,
    });
    record("GET /api/v1/notifications", list.status, list.body);
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.body.data.notifications));
    notificationId = list.body.data.notifications[0]?.id;
    assert.ok(notificationId);

    const unread = await request("GET", "/api/v1/notifications/unread-count", {
      token: customerToken,
    });
    record("GET /api/v1/notifications/unread-count", unread.status, unread.body);
    assert.equal(unread.status, 200);
    assert.ok(unread.body.data.count >= 1);

    const foreign = await request("PATCH", `/api/v1/notifications/${notificationId}/read`, {
      token: otherCustomerToken,
    });
    record("PATCH /api/v1/notifications/:id/read (other user)", foreign.status, foreign.body);
    assert.equal(foreign.status, 404);

    const mark = await request("PATCH", `/api/v1/notifications/${notificationId}/read`, {
      token: customerToken,
    });
    record("PATCH /api/v1/notifications/:id/read", mark.status, mark.body);
    assert.equal(mark.status, 200);

    const completedEvents = await Notification.countDocuments({
      userId: customerId,
      type: "booking_completed",
      dedupeKey: `booking_completed:customer:${bookingId}`,
    });
    assert.equal(completedEvents, 1);
  });
});
