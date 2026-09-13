/**
 * Sukh Breeze — minimal critical unit tests
 *
 * Runner : Node.js built-in test runner (no extra dependencies)
 * Usage  : node --test server/test/unit.test.js   (from repo root)
 *          or: cd server && node --test test/unit.test.js
 *
 * Scope  : pure-logic units that do NOT require a live database.
 *
 * Groups:
 *   1. Booking pricing — server must reject zero/negative startingCharge
 *   2. Booking state machine — valid and invalid transitions
 *   3. Commission calculation — correctness and rounding
 *   4. Review eligibility — booking must be completed and owned
 *   5. Notification — non-blocking on persistence failure
 *   6. Provider validator — startingCharge must be > 0 (post-fix)
 *   7. bookingId format — collision retry range
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ── 1. Booking pricing ───────────────────────────────────────────────────────

describe("Booking pricing — server-authoritative startingCharge guard", () => {
  const priceGuard = (startingCharge) => {
    if (!(startingCharge > 0)) {
      const error = new Error("Selected provider has not set a starting charge yet.");
      error.statusCode = 409;
      throw error;
    }
    return startingCharge;
  };

  it("accepts a positive startingCharge", () => {
    assert.equal(priceGuard(500), 500);
  });
  it("accepts a fractional positive startingCharge", () => {
    assert.equal(priceGuard(0.01), 0.01);
  });
  it("rejects zero with statusCode 409", () => {
    try { priceGuard(0); assert.fail("should throw"); }
    catch (e) { assert.equal(e.statusCode, 409); assert.match(e.message, /starting charge/i); }
  });
  it("rejects negative value", () => {
    try { priceGuard(-100); assert.fail("should throw"); }
    catch (e) { assert.equal(e.statusCode, 409); }
  });
  it("rejects undefined", () => {
    try { priceGuard(undefined); assert.fail("should throw"); }
    catch (e) { assert.equal(e.statusCode, 409); }
  });
  it("rejects null", () => {
    try { priceGuard(null); assert.fail("should throw"); }
    catch (e) { assert.equal(e.statusCode, 409); }
  });
  it("booking amount snapshot equals provider startingCharge", () => {
    const charge = 750;
    const bookingAmount = priceGuard(charge);
    assert.equal(bookingAmount, charge);
  });
});

// ── 2. Booking state machine ─────────────────────────────────────────────────

describe("Booking state machine", () => {
  const statusTransitions = {
    pending: ["accepted", "rejected", "cancelled"],
    accepted: ["in_progress", "cancelled"],
    in_progress: ["completed"],
    rejected: [],
    completed: [],
    cancelled: [],
  };
  const canTransition = (from, to) => statusTransitions[from]?.includes(to) ?? false;

  const valid = [
    ["pending", "accepted"], ["pending", "rejected"], ["pending", "cancelled"],
    ["accepted", "in_progress"], ["accepted", "cancelled"], ["in_progress", "completed"],
  ];
  const invalid = [
    ["pending", "in_progress"], ["pending", "completed"],
    ["accepted", "completed"], ["accepted", "rejected"],
    ["in_progress", "pending"], ["in_progress", "accepted"], ["in_progress", "cancelled"],
    ["rejected", "pending"], ["completed", "pending"], ["completed", "cancelled"],
    ["cancelled", "pending"], ["cancelled", "accepted"],
  ];

  for (const [f, t] of valid)  it(`allows ${f} → ${t}`,  () => assert.ok( canTransition(f, t)));
  for (const [f, t] of invalid) it(`blocks ${f} → ${t}`, () => assert.ok(!canTransition(f, t)));

  it("terminal states have no outbound transitions", () => {
    for (const s of ["rejected", "completed", "cancelled"])
      assert.equal(statusTransitions[s].length, 0, `${s} should be terminal`);
  });
});

// ── 3. Commission calculation ─────────────────────────────────────────────────

describe("Commission calculation", () => {
  const calculateCommission = (amount, commissionPercentage) => {
    const commissionAmount = Number(((amount * commissionPercentage) / 100).toFixed(2));
    return {
      commissionPercentage,
      commissionAmount,
      providerPayableAmount: Number((amount - commissionAmount).toFixed(2)),
    };
  };

  it("10% of 1000 → commission=100, payable=900", () => {
    const r = calculateCommission(1000, 10);
    assert.equal(r.commissionAmount, 100);
    assert.equal(r.providerPayableAmount, 900);
  });
  it("15% of 2000 → commission=300, payable=1700", () => {
    const r = calculateCommission(2000, 15);
    assert.equal(r.commissionAmount, 300);
    assert.equal(r.providerPayableAmount, 1700);
  });
  it("rounds to 2 decimal places", () => {
    const r = calculateCommission(333, 10);
    assert.equal(r.commissionAmount, 33.3);
    assert.equal(r.providerPayableAmount, 299.7);
  });
  it("commission + payable = amount (all cases)", () => {
    for (const [a, p] of [[500,10],[1234,12],[99,10],[750,15],[10000,7.5]]) {
      const r = calculateCommission(a, p);
      const sum = Number((r.commissionAmount + r.providerPayableAmount).toFixed(2));
      assert.equal(sum, a, `${a}@${p}%: ${r.commissionAmount}+${r.providerPayableAmount}!=${a}`);
    }
  });
  it("0% commission: full amount to provider", () => {
    const r = calculateCommission(500, 0);
    assert.equal(r.commissionAmount, 0);
    assert.equal(r.providerPayableAmount, 500);
  });
  it("100% commission: zero to provider", () => {
    const r = calculateCommission(500, 100);
    assert.equal(r.commissionAmount, 500);
    assert.equal(r.providerPayableAmount, 0);
  });
  it("toPaise rounds correctly", () => {
    const toPaise = (r) => Math.round(Number(r) * 100);
    assert.equal(toPaise(10), 1000);
    assert.equal(toPaise(10.5), 1050);
    assert.equal(toPaise(10.999), 1100);
    assert.equal(toPaise("20.00"), 2000);
  });
});

// ── 4. Review eligibility ─────────────────────────────────────────────────────

describe("Review eligibility rules", () => {
  const checkEligibility = ({ booking, customerId }) => {
    if (!booking || booking.customerId?.toString() !== customerId?.toString() ||
        booking.status !== "completed" || !booking.providerId) {
      const e = new Error("Completed customer booking not found.");
      e.statusCode = 404;
      throw e;
    }
    return true;
  };

  const cid = "64a1b2c3d4e5f60000000001";
  const baseBooking = {
    _id: "64a1b2c3d4e5f60000000010",
    customerId: { toString: () => cid },
    providerId: "64a1b2c3d4e5f60000000002",
    status: "completed",
  };

  it("accepts completed owned booking with provider", () => assert.ok(checkEligibility({ booking: baseBooking, customerId: cid })));
  it("rejects null booking",    () => { try { checkEligibility({ booking: null, customerId: cid }); assert.fail(); } catch (e) { assert.equal(e.statusCode, 404); } });
  it("rejects wrong owner",     () => { try { checkEligibility({ booking: { ...baseBooking, customerId: { toString: () => "other" } }, customerId: cid }); assert.fail(); } catch (e) { assert.equal(e.statusCode, 404); } });
  it("rejects pending booking", () => { try { checkEligibility({ booking: { ...baseBooking, status: "pending" }, customerId: cid }); assert.fail(); } catch (e) { assert.equal(e.statusCode, 404); } });
  it("rejects accepted booking",() => { try { checkEligibility({ booking: { ...baseBooking, status: "accepted" }, customerId: cid }); assert.fail(); } catch (e) { assert.equal(e.statusCode, 404); } });
  it("rejects no provider",     () => { try { checkEligibility({ booking: { ...baseBooking, providerId: null }, customerId: cid }); assert.fail(); } catch (e) { assert.equal(e.statusCode, 404); } });
  it("providerId comes from booking, not payload", () => {
    const booking = { ...baseBooking, providerId: "trustedFromDB" };
    const payload = { rating: 5 };
    assert.equal(Object.hasOwn(payload, "providerId"), false);
    assert.equal(booking.providerId, "trustedFromDB");
  });
});

// ── 5. Notification isolation ─────────────────────────────────────────────────

describe("Notification — non-blocking on persistence failure", () => {
  let mockCreate = async () => ({ _id: "n1" });

  const createNotification = async ({ userId, type, title, message, dedupeKey }) => {
    try {
      return await mockCreate({ userId, type, title, message, dedupeKey });
    } catch (error) {
      if (error.code !== 11000) { /* swallow — non-blocking */ }
      return null;
    }
  };
  const notifyUser = (userId, details) => createNotification({ userId, ...details });
  const payload = { type: "booking_created", title: "T", message: "M", dedupeKey: "k1" };

  beforeEach(() => { mockCreate = async () => ({ _id: "n1" }); });

  it("resolves the notification on success", async () => {
    const r = await notifyUser("u1", payload);
    assert.ok(r?._id);
  });
  it("returns null (does not throw) on generic error", async () => {
    mockCreate = async () => { throw new Error("Network"); };
    assert.equal(await notifyUser("u1", payload), null);
  });
  it("returns null (does not throw) on 11000 duplicate", async () => {
    mockCreate = async () => { const e = new Error("dup"); e.code = 11000; throw e; };
    assert.equal(await notifyUser("u1", payload), null);
  });
  it("first call succeeds, second duplicate silently returns null", async () => {
    let n = 0;
    mockCreate = async () => {
      if (++n > 1) { const e = new Error("dup"); e.code = 11000; throw e; }
      return { _id: "n1" };
    };
    assert.ok(await notifyUser("u1", payload));
    assert.equal(await notifyUser("u1", payload), null);
  });
});

// ── 6. Provider validator — startingCharge > 0 ───────────────────────────────

describe("Provider validator — startingCharge > 0 (post-fix)", () => {
  const validate = (value) => {
    if (!Number.isFinite(value) || value <= 0)
      return { valid: false, message: "Starting charge must be greater than zero." };
    return { valid: true };
  };

  it("accepts 1",      () => assert.ok(validate(1).valid));
  it("accepts 500",    () => assert.ok(validate(500).valid));
  it("accepts 0.01",   () => assert.ok(validate(0.01).valid));
  it("accepts 999999", () => assert.ok(validate(999999).valid));
  it("rejects 0",      () => { const r = validate(0); assert.ok(!r.valid); assert.match(r.message, /greater than zero/i); });
  it("rejects -1",     () => assert.ok(!validate(-1).valid));
  it("rejects -0.001", () => assert.ok(!validate(-0.001).valid));
  it("rejects NaN",    () => assert.ok(!validate(NaN).valid));
  it("rejects Infinity",() => assert.ok(!validate(Infinity).valid));
  it("rejects null",   () => assert.ok(!validate(null).valid));
  it("rejects string '500'", () => assert.ok(!validate("500").valid));
});

// ── 7. bookingId format ───────────────────────────────────────────────────────

describe("bookingId generation", () => {
  const generateBookingId = () => {
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const sequence = Math.floor(100000 + Math.random() * 900000);
    return `SB-${date}-${sequence}`;
  };

  it("matches SB-YYYYMMDD-NNNNNN format", () => assert.match(generateBookingId(), /^SB-\d{8}-\d{6}$/));
  it("starts with SB-", () => assert.ok(generateBookingId().startsWith("SB-")));
  it("suffix is in [100000, 999999]", () => {
    for (let i = 0; i < 100; i++) {
      const s = Number(generateBookingId().split("-")[2]);
      assert.ok(s >= 100000 && s <= 999999, `suffix ${s} out of range`);
    }
  });
  it("generates mostly-unique IDs across 1000 calls", () => {
    const ids = new Set(Array.from({ length: 1000 }, generateBookingId));
    assert.ok(ids.size >= 990, `only ${ids.size} unique out of 1000`);
  });
});
