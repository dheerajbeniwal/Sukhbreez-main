import Booking from "../models/Booking.js";
import Category from "../models/Category.js";
import ProviderProfile from "../models/ProviderProfile.js";

const categoryView = (category) => ({
  id: category._id.toString(),
  name: category.name,
  slug: category.slug,
  description: category.description,
  icon: category.icon,
  image: category.image,
  isActive: category.isActive,
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
});

const slugify = (name) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const notFound = () => {
  const error = new Error("Category not found.");
  error.statusCode = 404;
  return error;
};
const conflict = (message) => {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
};

const defaultCategories = [
  ["Water Supplier", "water-supplier"],
  ["Plumber", "plumber"],
  ["Electrician", "electrician"],
  ["Carpenter", "carpenter"],
  ["Home Cleaner", "home-cleaner"],
  ["AC Repair", "ac-repair"],
  ["Painter", "painter"],
  ["Appliance Repair", "appliance-repair"],
];

export const seedDefaultCategories = async () => {
  await Promise.all(
    defaultCategories.map(([name, slug]) =>
      Category.updateOne(
        { slug },
        {
          $setOnInsert: {
            name,
            slug,
            description: `${name} home service`,
            isActive: true,
          },
        },
        { upsert: true },
      ),
    ),
  );
};

export const toCategoryView = categoryView;

export const createCategory = async (payload) => {
  const name = payload.name.trim();
  const slug = slugify(name);
  if (await Category.exists({ $or: [{ name }, { slug }] }))
    throw conflict("A category with this name or slug already exists.");
  return Category.create({
    name,
    slug,
    description: payload.description?.trim(),
    icon: payload.icon?.trim(),
    image: payload.image?.trim(),
  });
};

export const listCategories = async (includeInactive = false) => {
  const filter = includeInactive ? {} : { isActive: true };
  return Category.find(filter).sort({ name: 1 }).lean();
};

export const updateCategory = async (id, payload) => {
  const category = await Category.findById(id);
  if (!category) throw notFound();
  if (Object.hasOwn(payload, "name")) {
    const name = payload.name.trim();
    const slug = slugify(name);
    const duplicate = await Category.exists({
      _id: { $ne: id },
      $or: [{ name }, { slug }],
    });
    if (duplicate)
      throw conflict("A category with this name or slug already exists.");
    category.name = name;
    category.slug = slug;
  }
  for (const field of ["description", "icon", "image"])
    if (Object.hasOwn(payload, field))
      category[field] = payload[field]?.trim() || "";
  await category.save();
  return category;
};

export const updateCategoryStatus = async (id, isActive) => {
  const category = await Category.findByIdAndUpdate(
    id,
    { isActive },
    { new: true, runValidators: true },
  );
  if (!category) throw notFound();
  return category;
};

export const deleteCategory = async (id) => {
  const category = await Category.findById(id);
  if (!category) throw notFound();
  const [providerUse, bookingUse] = await Promise.all([
    ProviderProfile.exists({ categoryIds: id }),
    Booking.exists({ categoryId: id }),
  ]);
  if (providerUse || bookingUse)
    throw conflict(
      "Category is in use and cannot be deleted. Disable it instead.",
    );
  await category.deleteOne();
};
