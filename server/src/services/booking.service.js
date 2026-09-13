import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Category from "../models/Category.js";
import ProviderProfile from "../models/ProviderProfile.js";
import User from "../models/User.js";
import { notifyUser } from "./notification.service.js";

const statusTransitions = {
  pending: ["accepted", "rejected", "cancelled"],
  accepted: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  rejected: [],
  completed: [],
  cancelled: [],
};
const safeUser = "_id fullName mobile profileImage role accountStatus";
const safeCategory = "_id name slug description icon image isActive";
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const notFound = (message = "Booking not found.") => {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
};
const conflict = (message) => {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
};

const bookingEventDetails = {
  accepted: {
    type: "booking_accepted",
    title: "Booking accepted",
    message: "Your service booking has been accepted by the provider.",
  },
  rejected: {
    type: "booking_rejected",
    title: "Booking rejected",
    message: "Your service booking has been rejected by the provider.",
  },
  in_progress: {
    type: "booking_started",
    title: "Service started",
    message: "Your provider has started the service booking.",
  },
  completed: {
    type: "booking_completed",
    title: "Booking completed",
    message: "Your service booking has been completed.",
  },
  cancelled: {
    type: "booking_cancelled",
    title: "Booking cancelled",
    message: "Your service booking has been cancelled.",
  },
};

const notifyBookingStatus = async (booking, status) => {
  const details = bookingEventDetails[status];
  if (!details) return;
  const bookingKey = booking._id.toString();
  await notifyUser(booking.customerId, {
    ...details,
    dedupeKey: `${details.type}:customer:${bookingKey}`,
  });
  if (status === "cancelled" && booking.providerId)
    await notifyUser(booking.providerId, {
      ...details,
      message: "A service booking assigned to you has been cancelled.",
      dedupeKey: `${details.type}:provider:${bookingKey}`,
    });
};

const referenceId = (value) => value?._id?.toString() || value?.toString();

const bookingView = (booking) => ({
  id: booking._id.toString(),
  bookingId: booking.bookingId,
  customer: booking.customerId && {
    id: referenceId(booking.customerId),
    fullName: booking.customerId.fullName,
    mobile: booking.customerId.mobile,
    profileImage: booking.customerId.profileImage,
  },
  provider: booking.providerId && {
    id: referenceId(booking.providerId),
    fullName: booking.providerId.fullName,
    profileImage: booking.providerId.profileImage,
  },
  category: booking.categoryId && {
    id: referenceId(booking.categoryId),
    name: booking.categoryId.name,
    slug: booking.categoryId.slug,
    icon: booking.categoryId.icon,
    image: booking.categoryId.image,
  },
  problemDescription: booking.problemDescription,
  address: booking.address,
  serviceDate: booking.serviceDate,
  preferredTime: booking.preferredTime,
  amount: booking.amount,
  status: booking.status,
  paymentStatus: booking.paymentStatus,
  rejectionReason: booking.rejectionReason,
  cancellationReason: booking.cancellationReason,
  startedAt: booking.startedAt,
  completedAt: booking.completedAt,
  cancelledAt: booking.cancelledAt,
  createdAt: booking.createdAt,
  updatedAt: booking.updatedAt,
});

const populateBooking = (query) =>
  query
    .populate("customerId", safeUser)
    .populate("providerId", safeUser)
    .populate("categoryId", safeCategory);
const pageResult = (bookings, page, limit, total) => ({
  bookings: bookings.map(bookingView),
  pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
});

const verifyProvider = async (
  providerId,
  categoryId,
  requireAvailability = false,
) => {
  const user = await User.findOne({
    _id: providerId,
    role: "provider",
    accountStatus: "active",
  });
  if (!user) throw notFound("Provider not found.");
  const profile = await ProviderProfile.findOne({
    userId: providerId,
    categoryId,
    approvalStatus: "approved",
    accountStatus: "active",
  });
  if (!user || !profile || (requireAvailability && !profile.availability))
    throw conflict("Selected provider is not eligible for this booking.");
  return { user, profile };
};

const generateBookingId = () => {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const sequence = Math.floor(100000 + Math.random() * 900000);
  return `SB-${date}-${sequence}`;
};

export const createBooking = async (customerId, payload) => {
  const customer = await User.findOne({
    _id: customerId,
    role: "customer",
    accountStatus: "active",
  });
  if (!customer) throw conflict("Customer account is not active.");
  const category = await Category.findOne({
    _id: payload.categoryId,
    isActive: true,
  });
  if (!category) throw notFound("Active category not found.");
  const { profile: providerProfile } = await verifyProvider(
    payload.providerId,
    payload.categoryId,
    true,
  );
  if (!(providerProfile.startingCharge > 0))
    throw conflict("Selected provider has not set a starting charge yet.");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const booking = await Booking.create({
        bookingId: generateBookingId(),
        customerId,
        providerId: payload.providerId,
        categoryId: payload.categoryId,
        problemDescription: payload.problemDescription.trim(),
        address: {
          fullAddress: payload.address.fullAddress.trim(),
          city: payload.address.city?.trim() || "",
          pincode: payload.address.pincode?.trim() || "",
        },
        serviceDate: new Date(payload.serviceDate),
        preferredTime: payload.preferredTime.trim(),
        amount: providerProfile.startingCharge,
        status: "pending",
        paymentStatus: "pending",
      });
      await notifyUser(booking.providerId, {
        type: "booking_created",
        title: "New booking request",
        message: "You have received a new service booking request.",
        dedupeKey: `booking_created:${booking._id}`,
      });
      return booking;
    } catch (error) {
      if (error.code !== 11000 || attempt === 2) throw error;
    }
  }
};

export const listCustomerBookings = async (
  customerId,
  { page, limit, status },
) => {
  const filter = { customerId };
  if (status) filter.status = status;
  const [total, bookings] = await Promise.all([
    Booking.countDocuments(filter),
    populateBooking(
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ).lean(),
  ]);
  return pageResult(bookings, page, limit, total);
};

export const getBooking = async (id, user) => {
  const booking = await populateBooking(Booking.findById(id)).lean();
  if (!booking) throw notFound();
  const userId = user._id.toString();
  const allowed =
    user.role === "admin" ||
    booking.customerId?._id.toString() === userId ||
    booking.providerId?._id.toString() === userId;
  if (!allowed) throw notFound();
  return bookingView(booking);
};

const getOwnedBooking = async (id, userId) => {
  const booking = await Booking.findOne({ _id: id, providerId: userId });
  if (!booking) throw notFound();
  return booking;
};
const assertTransition = (booking, nextStatus) => {
  if (!statusTransitions[booking.status].includes(nextStatus))
    throw conflict(
      `Invalid booking status transition: ${booking.status} to ${nextStatus}.`,
    );
};
const assertProviderOperational = async (userId, categoryId) =>
  verifyProvider(userId, categoryId, false);

export const cancelBooking = async (id, customerId, reason) => {
  const booking = await Booking.findOne({ _id: id, customerId });
  if (!booking) throw notFound();
  assertTransition(booking, "cancelled");
  booking.status = "cancelled";
  booking.cancellationReason = reason.trim();
  booking.cancelledAt = new Date();
  await booking.save();
  await notifyBookingStatus(booking, "cancelled");
  return booking;
};

export const listProviderBookings = async (
  providerId,
  { page, limit, status, mode },
) => {
  if (
    mode === "history" &&
    status &&
    !["completed", "rejected", "cancelled"].includes(status)
  ) {
    const error = new Error("Invalid history status.");
    error.statusCode = 400;
    throw error;
  }
  const filter = { providerId };
  if (mode === "requests") filter.status = "pending";
  if (mode === "active") filter.status = { $in: ["accepted", "in_progress"] };
  if (mode === "history")
    filter.status = status
      ? status
      : { $in: ["completed", "rejected", "cancelled"] };
  if (status && mode !== "requests" && mode !== "active")
    filter.status = status;
  const [total, bookings] = await Promise.all([
    Booking.countDocuments(filter),
    populateBooking(
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ).lean(),
  ]);
  return pageResult(bookings, page, limit, total);
};

export const transitionProviderBooking = async (
  id,
  providerId,
  nextStatus,
  reason,
) => {
  if (nextStatus === "completed")
    return completeBooking(id, providerId, false);
  const booking = await getOwnedBooking(id, providerId);
  await assertProviderOperational(providerId, booking.categoryId);
  assertTransition(booking, nextStatus);
  booking.status = nextStatus;
  if (nextStatus === "rejected") booking.rejectionReason = reason.trim();
  if (nextStatus === "in_progress") booking.startedAt = new Date();
  if (nextStatus === "completed") booking.completedAt = new Date();
  await booking.save();
  await notifyBookingStatus(booking, nextStatus);
  return booking;
};

export const listAdminBookings = async ({
  page,
  limit,
  status,
  paymentStatus,
  categoryId,
  providerId,
  customerId,
  serviceDate,
  search,
}) => {
  const filter = {};
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (categoryId) filter.categoryId = categoryId;
  if (providerId) filter.providerId = providerId;
  if (customerId) filter.customerId = customerId;
  if (serviceDate) {
    const start = new Date(serviceDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    filter.serviceDate = { $gte: start, $lt: end };
  }
  if (search)
    filter.bookingId = {
      $regex: escapeRegex(search.trim().slice(0, 80)),
      $options: "i",
    };
  const [total, bookings] = await Promise.all([
    Booking.countDocuments(filter),
    populateBooking(
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ).lean(),
  ]);
  return pageResult(bookings, page, limit, total);
};

export const adminTransition = async (id, status, reasons = {}) => {
  if (status === "completed") return completeBooking(id, null, true);
  const booking = await Booking.findById(id);
  if (!booking) throw notFound();
  assertTransition(booking, status);
  booking.status = status;
  if (status === "rejected")
    booking.rejectionReason = reasons.rejectionReason.trim();
  if (status === "cancelled")
    booking.cancellationReason = reasons.cancellationReason.trim();
  if (status === "in_progress" && !booking.startedAt)
    booking.startedAt = new Date();
  if (status === "completed" && !booking.completedAt)
    booking.completedAt = new Date();
  if (status === "cancelled" && !booking.cancelledAt)
    booking.cancelledAt = new Date();
  await booking.save();
  await notifyBookingStatus(booking, status);
  return booking;
};

const completeBooking = async (id, providerId, admin) => {
  const session = await mongoose.startSession();
  let completedBooking;
  try {
    await session.withTransaction(async () => {
      const booking = await Booking.findOne({
        _id: id,
        ...(admin ? {} : { providerId }),
      }).session(session);
      if (!booking) throw notFound();
      if (!admin) await assertProviderOperational(providerId, booking.categoryId);
      assertTransition(booking, "completed");
      booking.status = "completed";
      booking.completedAt = new Date();
      await booking.save({ session });
      const profile = await ProviderProfile.findOneAndUpdate(
        { userId: booking.providerId },
        { $inc: { totalCompletedJobs: 1 } },
        { new: true, session, runValidators: true },
      );
      if (!profile) throw notFound("Provider profile not found.");
      completedBooking = booking;
    });
  } finally {
    await session.endSession();
  }
  await notifyBookingStatus(completedBooking, "completed");
  return completedBooking;
};

export const reassignProvider = async (id, providerId) => {
  const booking = await Booking.findById(id);
  if (!booking) throw notFound();
  await verifyProvider(providerId, booking.categoryId, true);
  booking.providerId = providerId;
  booking.status = "pending";
  await booking.save();
  await notifyUser(providerId, {
    type: "booking_created",
    title: "New booking request",
    message: "You have received a reassigned service booking request.",
    dedupeKey: `booking_created:${booking._id}:${providerId}`,
  });
  return booking;
};

export { bookingView };
