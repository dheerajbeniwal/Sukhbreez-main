export const notFoundHandler = (request, response) => {
  response.status(404).json({
    success: false,
    message: `Route not found: ${request.method} ${request.originalUrl}`,
  });
};

export const errorHandler = (error, request, response, next) => {
  if (response.headersSent) return next(error);

  const statusCode =
    error.statusCode ||
    (error.code === 11000 ? 409 : error.name === "ValidationError" ? 400 : 500);
  response.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? "Internal server error"
        : statusCode === 409 && error.code === 11000
          ? "A resource with these details already exists."
          : error.message,
    ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
  });
};
