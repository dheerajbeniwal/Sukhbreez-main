import * as categoryService from "../services/category.service.js";

const listResponse = (categories) =>
  categories.map(categoryService.toCategoryView);

export const create = async (request, response) => {
  const category = await categoryService.createCategory(request.body);
  response
    .status(201)
    .json({
      success: true,
      message: "Category created successfully.",
      data: { category: categoryService.toCategoryView(category) },
    });
};

export const listPublic = async (request, response) => {
  const categories = await categoryService.listCategories();
  response.json({
    success: true,
    message: "Categories fetched successfully.",
    data: { categories: listResponse(categories) },
  });
};

export const listAdmin = async (request, response) => {
  const categories = await categoryService.listCategories(true);
  response.json({
    success: true,
    message: "Categories fetched successfully.",
    data: { categories: listResponse(categories) },
  });
};

export const update = async (request, response) => {
  const category = await categoryService.updateCategory(
    request.params.id,
    request.body,
  );
  response.json({
    success: true,
    message: "Category updated successfully.",
    data: { category: categoryService.toCategoryView(category) },
  });
};

export const updateStatus = async (request, response) => {
  const category = await categoryService.updateCategoryStatus(
    request.params.id,
    request.body.isActive,
  );
  response.json({
    success: true,
    message: "Category status updated successfully.",
    data: { category: categoryService.toCategoryView(category) },
  });
};

export const remove = async (request, response) => {
  await categoryService.deleteCategory(request.params.id);
  response.json({ success: true, message: "Category deleted successfully." });
};
