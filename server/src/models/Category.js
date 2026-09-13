import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    icon: { type: String, trim: true, maxlength: 200, default: "" },
    image: { type: String, trim: true, maxlength: 500, default: "" },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, strict: true },
);

export default mongoose.model("Category", categorySchema);
