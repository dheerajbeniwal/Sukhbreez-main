import mongoose from "mongoose";
import Category from "../models/Category.js";
import ProviderProfile from "../models/ProviderProfile.js";
import User from "../models/User.js";

const userProjection =
  "_id fullName profileImage mobile email role accountStatus createdAt updatedAt";
const categoryProjection = "_id name slug icon image description isActive";
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const notFound = () => {
  const error = new Error("Provider not found.");
  error.statusCode = 404;
  return error;
};

const providerView = (profile) => ({
  id: profile.userId?._id?.toString() || profile.userId?.toString(),
  fullName: profile.userId?.fullName,
  profileImage: profile.userId?.profileImage,
  category: profile.categoryId && {
    id: profile.categoryId._id.toString(),
    name: profile.categoryId.name,
    slug: profile.categoryId.slug,
    icon: profile.categoryId.icon,
    image: profile.categoryId.image,
  },
  experience: profile.experience,
  bio: profile.bio,
  startingCharge: profile.startingCharge,
  ratingAverage: profile.ratingAverage,
  totalReviews: profile.totalReviews,
  totalCompletedJobs: profile.totalCompletedJobs,
  availability: profile.availability,
});

const adminProviderView = (profile) => ({
  ...providerView(profile),
  approvalStatus: profile.approvalStatus,
  accountStatus: profile.accountStatus,
  userAccountStatus: profile.userId?.accountStatus,
  mobile: profile.userId?.mobile,
  email: profile.userId?.email,
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt,
});
export const toProviderView = providerView;
export const toAdminProviderView = adminProviderView;

const populateProfile = (query) =>
  query
    .populate("userId", userProjection)
    .populate("categoryId", categoryProjection);

export const listProviders = async ({
  page,
  limit,
  categoryId,
  available,
  search,
  admin = false,
  approvalStatus,
  accountStatus,
}) => {
  if (!admin && available === "false")
    return {
      providers: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
    };
  const userFilter = { role: "provider" };
  if (!admin) userFilter.accountStatus = "active";
  if (search)
    userFilter.fullName = {
      $regex: escapeRegex(search.trim().slice(0, 80)),
      $options: "i",
    };
  const userIds = await User.find(userFilter).select("_id").lean();
  const filter = { userId: { $in: userIds.map((user) => user._id) } };
  if (!admin)
    Object.assign(filter, {
      approvalStatus: "approved",
      accountStatus: "active",
      availability: true,
    });
  if (admin && approvalStatus) filter.approvalStatus = approvalStatus;
  if (admin && accountStatus) filter.accountStatus = accountStatus;
  if (!admin) {
    const activeCategoryIds = await Category.find({ isActive: true }).distinct(
      "_id",
    );
    filter.categoryId = categoryId
      ? { $eq: categoryId, $in: activeCategoryIds }
      : { $in: activeCategoryIds };
  } else if (categoryId) filter.categoryId = categoryId;
  if (admin && available !== undefined)
    filter.availability = available === "true";
  const [total, profiles] = await Promise.all([
    ProviderProfile.countDocuments(filter),
    populateProfile(
      ProviderProfile.find(filter)
        .sort({ ratingAverage: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ).lean(),
  ]);
  const visibleProfiles = profiles.filter(
    (profile) => profile.userId && profile.categoryId,
  );
  return {
    providers: visibleProfiles.map(admin ? adminProviderView : providerView),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getPublicProvider = async (id) => {
  const profile = await populateProfile(
    ProviderProfile.findOne({
      userId: id,
      approvalStatus: "approved",
      accountStatus: "active",
      availability: true,
    }),
  ).lean();
  if (
    !profile?.userId ||
    profile.userId.accountStatus !== "active" ||
    !profile.categoryId?.isActive
  )
    throw notFound();
  return providerView(profile);
};

export const getAdminProvider = async (id) => {
  const profile = await populateProfile(
    ProviderProfile.findOne({ userId: id }),
  ).lean();
  if (!profile?.userId) throw notFound();
  return adminProviderView(profile);
};

export const getOwnProfile = async (userId) => {
  const profile = await populateProfile(
    ProviderProfile.findOne({ userId }),
  ).lean();
  if (!profile) {
    const error = new Error("Provider profile not found.");
    error.statusCode = 404;
    throw error;
  }
  return {
    user: profile.userId,
    profile: profile,
    category: profile.categoryId,
  };
};

export const updateOwnProfile = async (userId, payload) => {
  const profile = await ProviderProfile.findOne({ userId });
  if (!profile) {
    const error = new Error("Provider profile not found.");
    error.statusCode = 404;
    throw error;
  }
  const categoryId = payload.categoryId;
  if (categoryId) {
    const category = await Category.findOne({
      _id: categoryId,
      isActive: true,
    });
    if (!category) {
      const error = new Error("Active category not found.");
      error.statusCode = 404;
      throw error;
    }
    profile.categoryId = categoryId;
  }
  for (const field of ["experience", "address", "bio", "startingCharge"])
    if (Object.hasOwn(payload, field))
      profile[field] =
        typeof payload[field] === "string"
          ? payload[field].trim()
          : payload[field];
  if (
    profile.approvalStatus === "approved" ||
    profile.availability === true
  ) {
    if (Number(profile.startingCharge) <= 0) {
      const error = new Error(
        "Starting charge must be greater than zero before a provider can be bookable.",
      );
      error.statusCode = 400;
      throw error;
    }
  }
  await User.findByIdAndUpdate(
    userId,
    {
      $set: Object.fromEntries(
        ["fullName", "profileImage"]
          .filter((field) => Object.hasOwn(payload, field))
          .map((field) => [
            field,
            typeof payload[field] === "string"
              ? payload[field].trim()
              : payload[field],
          ]),
      ),
    },
    { new: true, runValidators: true },
  );
  await profile.save();
  return getOwnProfile(userId);
};

export const updateAvailability = async (userId, availability) => {
  const profile = await ProviderProfile.findOne({ userId, accountStatus: "active" });
  if (!profile) {
    const error = new Error("Approved active provider profile not found.");
    error.statusCode = 404;
    throw error;
  }
  if (availability && Number(profile.startingCharge) <= 0) {
    const error = new Error(
      "Starting charge must be greater than zero before a provider can be available.",
    );
    error.statusCode = 400;
    throw error;
  }
  const updated = await ProviderProfile.findOneAndUpdate(
    { userId, approvalStatus: "approved", accountStatus: "active" },
    { availability },
    { new: true, runValidators: true },
  );
  if (!updated) {
    const error = new Error("Approved active provider profile not found.");
    error.statusCode = 404;
    throw error;
  }
  return { availability: updated.availability };
};

export const updateApproval = async (id, approvalStatus) => {
  const profile = await ProviderProfile.findOne({ userId: id });
  if (!profile) throw notFound();
  if (approvalStatus === "approved" && Number(profile.startingCharge) <= 0) {
    const error = new Error(
      "Starting charge must be greater than zero before a provider can be approved.",
    );
    error.statusCode = 400;
    throw error;
  }
  const updated = await ProviderProfile.findOneAndUpdate(
    { userId: id },
    { approvalStatus },
    { new: true, runValidators: true },
  );
  if (!updated) throw notFound();
  return getAdminProvider(id);
};
export const updateStatus = async (id, accountStatus) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const profile = await ProviderProfile.findOneAndUpdate(
        { userId: id },
        {
          accountStatus,
          ...(accountStatus !== "active" ? { availability: false } : {}),
        },
        { new: true, runValidators: true, session },
      );
      const user = await User.findOneAndUpdate(
        { _id: id, role: "provider" },
        { accountStatus },
        { new: true, session },
      );
      if (!profile || !user) throw notFound();
    });
  } finally {
    await session.endSession();
  }
  return getAdminProvider(id);
};
