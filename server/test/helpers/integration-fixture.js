import bcrypt from "bcryptjs";
import http from "node:http";
import mongoose from "mongoose";
import app from "../../src/app.js";
import { env } from "../../src/config/env.js";
import Booking from "../../src/models/Booking.js";
import Category from "../../src/models/Category.js";
import Notification from "../../src/models/Notification.js";
import Payment from "../../src/models/Payment.js";
import ProviderProfile from "../../src/models/ProviderProfile.js";
import RefreshToken from "../../src/models/RefreshToken.js";
import Review from "../../src/models/Review.js";
import User from "../../src/models/User.js";

const password = "Integration!234";

const json = async (response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
};

export const createHarness = async () => {
  if (!env.mongodbUri)
    throw new Error("MONGODB_URI is not configured; cannot run database-backed tests.");
  await mongoose.connect(env.mongodbUri);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      await mongoose.disconnect();
    },
  };
};

export const createFixture = async (baseUrl) => {
  const marker = `__sb_integration_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const created = { users: [], categories: [], bookings: [] };
  let sequence = 0;
  const mobile = () => {
    sequence += 1;
    return `7${String(Date.now()).slice(-7)}${String(sequence).padStart(2, "0")}`;
  };
  const request = async (method, path, { token, body } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await json(response) };
  };
  const createCategory = async (overrides = {}) => {
    const category = await Category.create({
      name: `${marker} category`,
      slug: `${marker}-category`,
      description: "Temporary integration category",
      isActive: true,
      ...overrides,
    });
    created.categories.push(category._id);
    return category;
  };
  const createUser = async (role, overrides = {}) => {
    const user = await User.create({
      fullName: `${marker} ${role}`,
      mobile: mobile(),
      password: await bcrypt.hash(password, 12),
      role,
      accountStatus: "active",
      ...overrides,
    });
    created.users.push(user._id);
    return user;
  };
  const createProvider = async (categoryId, overrides = {}) => {
    const user = await createUser("provider", overrides);
    await ProviderProfile.create({
      userId: user._id,
      categoryIds: [categoryId],
      experience: 4,
      address: "Temporary provider address",
      approvalStatus: "approved",
      accountStatus: "active",
      availability: true,
      startingCharge: 500,
    });
    return user;
  };
  const login = async (user, admin = false) => {
    const response = await request(
      "POST",
      admin ? "/api/v1/auth/admin/login" : "/api/v1/auth/login",
      { body: { mobile: user.mobile, password } },
    );
    if (response.status !== 200)
      throw new Error(`Login failed: ${JSON.stringify(response.body)}`);
    return response.body.data.accessToken;
  };
  const createBooking = async (customerToken, providerId, categoryId) => {
    const response = await request("POST", "/api/v1/bookings", {
      token: customerToken,
      body: {
        categoryId: categoryId.toString(),
        providerId: providerId.toString(),
        problemDescription: `${marker} booking`,
        address: { fullAddress: "Temporary booking address", city: "Test", pincode: "110001" },
        serviceDate: new Date(Date.now() + 86400000).toISOString(),
        preferredTime: "10:00-12:00",
      },
    });
    if (response.status !== 201)
      throw new Error(`Booking creation failed: ${JSON.stringify(response.body)}`);
    const bookingId = response.body.data.booking.id;
    created.bookings.push(new mongoose.Types.ObjectId(bookingId));
    return response.body.data.booking;
  };
  const completeBooking = async (providerToken, bookingId) => {
    for (const action of ["accept", "start", "complete"]) {
      const response = await request("PATCH", `/api/v1/bookings/${bookingId}/${action}`, {
        token: providerToken,
      });
      if (response.status !== 200)
        throw new Error(`Booking ${action} failed: ${JSON.stringify(response.body)}`);
    }
  };
  return {
    marker,
    password,
    request,
    createCategory,
    createUser,
    createProvider,
    login,
    createBooking,
    completeBooking,
    cleanup: async () => {
      const userIds = created.users;
      if (userIds.length) {
        await Promise.all([
          RefreshToken.deleteMany({ user: { $in: userIds } }),
          Notification.deleteMany({ userId: { $in: userIds } }),
          Review.deleteMany({
            $or: [{ customerId: { $in: userIds } }, { providerId: { $in: userIds } }],
          }),
          Payment.deleteMany({
            $or: [{ customerId: { $in: userIds } }, { providerId: { $in: userIds } }],
          }),
          Booking.deleteMany({
            $or: [{ customerId: { $in: userIds } }, { providerId: { $in: userIds } }],
          }),
          ProviderProfile.deleteMany({ userId: { $in: userIds } }),
          User.deleteMany({ _id: { $in: userIds } }),
        ]);
      }
      await Category.deleteMany({
        $or: [
          { _id: { $in: created.categories } },
          { name: { $regex: marker } },
        ],
      });
    },
  };
};
