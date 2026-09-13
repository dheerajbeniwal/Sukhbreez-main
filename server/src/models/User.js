import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: { type: String, trim: true, lowercase: true, sparse: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["customer", "provider", "admin"],
      required: true,
      index: true,
    },
    profileImage: { type: String, default: null },
    accountStatus: {
      type: String,
      enum: ["active", "blocked", "suspended"],
      default: "active",
      index: true,
    },
    isMobileVerified: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    fullName: this.fullName,
    mobile: this.mobile,
    email: this.email,
    role: this.role,
    profileImage: this.profileImage,
    accountStatus: this.accountStatus,
    isMobileVerified: this.isMobileVerified,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.model("User", userSchema);
