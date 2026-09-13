import { after, before, afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import Booking from "../src/models/Booking.js";
import Payment from "../src/models/Payment.js";
import { createFixture, createHarness } from "./helpers/integration-fixture.js";

describe("provider booking lifecycle integration", () => {
  let harness;
  let fixture;

  before(async () => {
    harness = await createHarness();
  });

  afterEach(async () => {
    if (fixture) await fixture.cleanup();
    fixture = null;
  });

  after(async () => {
    await harness.close();
  });

  const setup = async () => {
    fixture = await createFixture(harness.baseUrl);
    const category = await fixture.createCategory();
    const customer = await fixture.createUser("customer");
    const provider = await fixture.createProvider(category._id);
    const otherProvider = await fixture.createProvider(category._id);
    return {
      category,
      customer,
      provider,
      otherProvider,
      customerToken: await fixture.login(customer),
      providerToken: await fixture.login(provider),
      otherProviderToken: await fixture.login(otherProvider),
    };
  };

  it("completes pending to accepted to in_progress to completed", async () => {
    const { category, provider, customerToken, providerToken } = await setup();
    const booking = await fixture.createBooking(customerToken, provider._id, category._id);
    for (const [action, expected] of [["accept", "accepted"], ["start", "in_progress"], ["complete", "completed"]]) {
      const response = await fixture.request("PATCH", `/api/v1/bookings/${booking.id}/${action}`, {
        token: providerToken,
      });
      assert.equal(response.status, 200);
      assert.equal(response.body.data.booking.status, expected);
    }
  });

  it("rejects another provider acting on the booking", async () => {
    const { category, provider, otherProviderToken, customerToken } = await setup();
    const booking = await fixture.createBooking(customerToken, provider._id, category._id);
    const response = await fixture.request("PATCH", `/api/v1/bookings/${booking.id}/accept`, {
      token: otherProviderToken,
    });
    assert.equal(response.status, 404);
  });

  it("rejects an out-of-order completion", async () => {
    const { category, provider, customerToken, providerToken } = await setup();
    const booking = await fixture.createBooking(customerToken, provider._id, category._id);
    const response = await fixture.request("PATCH", `/api/v1/bookings/${booking.id}/complete`, {
      token: providerToken,
    });
    assert.equal(response.status, 409);
    assert.match(response.body.message, /Invalid booking status transition/);
  });

  it("reports, verifies, and settles cash payment with status assertions", async () => {
    const { category, provider, customerToken, providerToken } = await setup();
    const admin = await fixture.createUser("admin");
    const adminToken = await fixture.login(admin, true);
    const booking = await fixture.createBooking(customerToken, provider._id, category._id);
    await fixture.completeBooking(providerToken, booking.id);
    const received = await fixture.request("POST", "/api/v1/payments/cash/received", {
      token: providerToken,
      body: { bookingId: booking.id },
    });
    assert.equal(received.status, 200);
    assert.equal(received.body.data.payment.paymentStatus, "pending");
    assert.equal((await Booking.findById(booking.id)).paymentStatus, "pending");
    const paymentId = received.body.data.payment.id;
    const verified = await fixture.request("PATCH", `/api/v1/payments/admin/${paymentId}/verify`, {
      token: adminToken,
      body: {},
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.data.payment.paymentStatus, "verified");
    assert.equal((await Booking.findById(booking.id)).paymentStatus, "verified");
    const settled = await fixture.request("PATCH", `/api/v1/payments/admin/${paymentId}/settle`, {
      token: adminToken,
      body: { settlementReference: `${fixture.marker}-settled` },
    });
    assert.equal(settled.status, 200);
    assert.equal(settled.body.data.payment.settlementStatus, "settled");
    assert.equal((await Payment.findById(paymentId)).settlementStatus, "settled");
  });

  it("creates a customer review and deletes it as admin", async () => {
    const { category, provider, customerToken, providerToken } = await setup();
    const admin = await fixture.createUser("admin");
    const adminToken = await fixture.login(admin, true);
    const booking = await fixture.createBooking(customerToken, provider._id, category._id);
    await fixture.completeBooking(providerToken, booking.id);
    const created = await fixture.request("POST", "/api/v1/reviews", {
      token: customerToken,
      body: { bookingId: booking.id, rating: 4, comment: "Good service" },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.review.rating, 4);
    const deleted = await fixture.request("DELETE", `/api/v1/reviews/admin/${created.body.data.review.id}`, {
      token: adminToken,
    });
    assert.equal(deleted.status, 200);
  });
});
