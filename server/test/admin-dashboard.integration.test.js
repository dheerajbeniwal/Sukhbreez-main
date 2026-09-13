import { after, before, afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import Payment from "../src/models/Payment.js";
import ProviderProfile from "../src/models/ProviderProfile.js";
import { createFixture, createHarness } from "./helpers/integration-fixture.js";

describe("admin dashboard integration", () => {
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
    const admin = await fixture.createUser("admin");
    const adminToken = await fixture.login(admin, true);
    return { category, adminToken };
  };

  it("creates, edits, and toggles category status as admin", async () => {
    const { adminToken } = await setup();
    const created = await fixture.request("POST", "/api/v1/categories", {
      token: adminToken,
      body: { name: `${fixture.marker} created`, description: "Created by test" },
    });
    assert.equal(created.status, 201);
    const categoryId = created.body.data.category.id;
    const edited = await fixture.request(`PATCH`, `/api/v1/categories/${categoryId}`, {
      token: adminToken,
      body: { name: `${fixture.marker} edited` },
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.data.category.name, `${fixture.marker} edited`);
    const toggled = await fixture.request("PATCH", `/api/v1/categories/${categoryId}/status`, {
      token: adminToken,
      body: { isActive: false },
    });
    assert.equal(toggled.status, 200);
    assert.equal(toggled.body.data.category.isActive, false);
  });

  it("approves and rejects providers as admin", async () => {
    const { category, adminToken } = await setup();
    const pending = await fixture.createProvider(category._id, { fullName: `${fixture.marker} pending` });
    const rejected = await fixture.createProvider(category._id, { fullName: `${fixture.marker} rejected` });
    await ProviderProfile.updateMany(
      { userId: { $in: [pending._id, rejected._id] } },
      { $set: { approvalStatus: "pending" } },
    );
    const approvedResponse = await fixture.request("PATCH", `/api/v1/providers/admin/${pending._id}/approval`, {
      token: adminToken,
      body: { approvalStatus: "approved" },
    });
    assert.equal(approvedResponse.status, 200);
    assert.equal(approvedResponse.body.data.provider.approvalStatus, "approved");
    const rejectedResponse = await fixture.request("PATCH", `/api/v1/providers/admin/${rejected._id}/approval`, {
      token: adminToken,
      body: { approvalStatus: "rejected" },
    });
    assert.equal(rejectedResponse.status, 200);
    assert.equal(rejectedResponse.body.data.provider.approvalStatus, "rejected");
  });

  it("lists and filters bookings, then reassigns the provider", async () => {
    const { category, adminToken } = await setup();
    const customer = await fixture.createUser("customer");
    const provider = await fixture.createProvider(category._id);
    const replacement = await fixture.createProvider(category._id);
    const customerToken = await fixture.login(customer);
    const booking = await fixture.createBooking(customerToken, provider._id, category._id);
    const listed = await fixture.request("GET", `/api/v1/bookings/admin?providerId=${provider._id}`, {
      token: adminToken,
    });
    assert.equal(listed.status, 200);
    assert.ok(listed.body.data.bookings.some((item) => item.id === booking.id));
    const reassigned = await fixture.request("PATCH", `/api/v1/bookings/admin/${booking.id}/reassign-provider`, {
      token: adminToken,
      body: { providerId: replacement._id.toString() },
    });
    assert.equal(reassigned.status, 200);
    assert.equal(reassigned.body.data.booking.provider.id, replacement._id.toString());
  });

  it("verifies and settles a cash payment as admin", async () => {
    const { category, adminToken } = await setup();
    const customer = await fixture.createUser("customer");
    const provider = await fixture.createProvider(category._id);
    const customerToken = await fixture.login(customer);
    const providerToken = await fixture.login(provider);
    const booking = await fixture.createBooking(customerToken, provider._id, category._id);
    await fixture.completeBooking(providerToken, booking.id);
    const received = await fixture.request("POST", "/api/v1/payments/cash/received", {
      token: providerToken,
      body: { bookingId: booking.id },
    });
    assert.equal(received.status, 200);
    assert.equal(received.body.data.payment.paymentStatus, "pending");
    const paymentId = received.body.data.payment.id;
    const verified = await fixture.request("PATCH", `/api/v1/payments/admin/${paymentId}/verify`, {
      token: adminToken,
      body: {},
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.data.payment.paymentStatus, "verified");
    const settled = await fixture.request("PATCH", `/api/v1/payments/admin/${paymentId}/settle`, {
      token: adminToken,
      body: { settlementReference: `${fixture.marker}-settlement`, settlementNotes: "Test settlement" },
    });
    assert.equal(settled.status, 200);
    assert.equal(settled.body.data.payment.settlementStatus, "settled");
    assert.equal((await Payment.findById(paymentId)).settlementStatus, "settled");
  });

  it("deletes a customer review as admin", async () => {
    const { category, adminToken } = await setup();
    const customer = await fixture.createUser("customer");
    const provider = await fixture.createProvider(category._id);
    const customerToken = await fixture.login(customer);
    const providerToken = await fixture.login(provider);
    const booking = await fixture.createBooking(customerToken, provider._id, category._id);
    await fixture.completeBooking(providerToken, booking.id);
    const created = await fixture.request("POST", "/api/v1/reviews", {
      token: customerToken,
      body: { bookingId: booking.id, rating: 5, comment: "Excellent" },
    });
    assert.equal(created.status, 201);
    const deleted = await fixture.request("DELETE", `/api/v1/reviews/admin/${created.body.data.review.id}`, {
      token: adminToken,
    });
    assert.equal(deleted.status, 200);
    const details = await fixture.request("GET", `/api/v1/reviews/admin/${created.body.data.review.id}`, {
      token: adminToken,
    });
    assert.equal(details.status, 404);
  });
});
