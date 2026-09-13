import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100,
    },
    value: { type: String, required: true, trim: true, maxlength: 2000 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true, strict: true },
);

export default mongoose.model("Settings", settingsSchema);
