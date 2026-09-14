import autocannon from "autocannon";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../src/config/env.js";
import Category from "../src/models/Category.js";
import ProviderProfile from "../src/models/ProviderProfile.js";
import User from "../src/models/User.js";

const baseUrl = process.argv[2] || "http://127.0.0.1:5000";
const levels = [50, 200, 1000];
const password = "Load!234";
const marker = `__sb_load_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const mobile = `7${String(Date.now()).slice(-9)}`;
let category;
let customer;
let provider;
let customerToken;

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
};

const run = (url, connections, options) =>
  new Promise((resolve, reject) => {
    const timings = [];
    let serverErrors = 0;
    const instance = autocannon(
      {
        url,
        connections,
        duration: 30,
        ...options,
      },
      (error, result) => {
        if (error) return reject(error);
        const errors = (result.errors || 0) + (result.timeouts || 0);
        timings.sort((a, b) => a - b);
        const percentile = (p) =>
          timings.length
            ? timings[Math.min(timings.length - 1, Math.ceil(timings.length * p) - 1)]
            : 0;
        resolve({
          requestsPerSecond: result.requests.average,
          p95: percentile(0.95),
          p99: percentile(0.99),
          errorRate: ((errors + serverErrors) / Math.max(1, timings.length + errors)) * 100,
        });
      },
    );
    instance.on("response", (client, statusCode, length, duration) => {
      timings.push(duration);
      if (statusCode >= 500) serverErrors += 1;
    });
    instance.on("error", reject);
    setTimeout(() => instance.stop(), 31_000);
  });

const createFixture = async () => {
  await mongoose.connect(env.mongodbUri);
  category = await Category.create({
    name: `${marker} category`,
    slug: `${marker}-category`,
    description: "Temporary load fixture",
    isActive: true,
  });
  customer = await User.create({
    fullName: `${marker} customer`,
    mobile,
    password: await bcrypt.hash(password, 12),
    role: "customer",
    accountStatus: "active",
  });
  provider = await User.create({
    fullName: `${marker} provider`,
    mobile: `7${String(Date.now() + 1).slice(-9)}`,
    password: await bcrypt.hash(password, 12),
    role: "provider",
    accountStatus: "active",
  });
  await ProviderProfile.create({
    userId: provider._id,
    categoryIds: [category._id],
    experience: 4,
    address: "Temporary load address",
    approvalStatus: "approved",
    accountStatus: "active",
    availability: true,
    startingCharge: 500,
  });
  const login = await requestJson("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ mobile: customer.mobile, password }),
  });
  if (login.status !== 200) throw new Error(`Fixture login failed: ${JSON.stringify(login.body)}`);
  customerToken = login.body.data.accessToken;
};

const main = async () => {
  await createFixture();
  const endpoints = [
    ["GET /api/v1/categories", `${baseUrl}/api/v1/categories?page=1&limit=20`, undefined],
    ["POST /api/v1/bookings", `${baseUrl}/api/v1/bookings`, {
      method: "POST",
      headers: { authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        categoryId: category._id.toString(),
        providerId: provider._id.toString(),
        problemDescription: `${marker} booking`,
        address: { fullAddress: "Temporary load address", city: "Test", pincode: "110001" },
        serviceDate: new Date(Date.now() + 86400000).toISOString(),
        preferredTime: "10:00-12:00",
      }),
    }],
    ["POST /api/v1/auth/login", `${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      body: JSON.stringify({ mobile: customer.mobile, password }),
    }],
  ];
  for (const [name, url, options] of endpoints) {
    for (const connections of levels) {
      const result = await run(url, connections, options);
      console.log(JSON.stringify({ endpoint: name, connections, ...result }));
    }
  }
};

try {
  await main();
} finally {
  if (category || customer || provider) {
    await ProviderProfile.deleteMany({ userId: { $in: [customer?._id, provider?._id].filter(Boolean) } });
    await User.deleteMany({ _id: { $in: [customer?._id, provider?._id].filter(Boolean) } });
    if (category) await Category.deleteOne({ _id: category._id });
  }
  await mongoose.disconnect();
}
