import * as bookingService from "../services/booking.service.js";

export const create = async (request, response) => {
  const booking = await bookingService.createBooking(
    request.user._id,
    request.body,
  );
  response
    .status(201)
    .json({
      success: true,
      message: "Booking created successfully.",
      data: { booking: bookingService.bookingView(booking) },
    });
};

export const myBookings = async (request, response) => {
  const data = await bookingService.listCustomerBookings(request.user._id, {
    ...request.query,
    ...request.pagination,
  });
  response.json({
    success: true,
    message: "Bookings fetched successfully.",
    data,
  });
};

export const details = async (request, response) => {
  const booking = await bookingService.getBooking(
    request.params.id,
    request.user,
  );
  response.json({
    success: true,
    message: "Booking details fetched successfully.",
    data: { booking },
  });
};

export const cancel = async (request, response) => {
  const booking = await bookingService.cancelBooking(
    request.params.id,
    request.user._id,
    request.body.cancellationReason,
  );
  response.json({
    success: true,
    message: "Booking cancelled successfully.",
    data: { booking: bookingService.bookingView(booking) },
  });
};

export const providerRequests = async (request, response) => {
  const data = await bookingService.listProviderBookings(request.user._id, {
    ...request.query,
    ...request.pagination,
    mode: "requests",
  });
  response.json({
    success: true,
    message: "Booking requests fetched successfully.",
    data,
  });
};

export const providerActive = async (request, response) => {
  const data = await bookingService.listProviderBookings(request.user._id, {
    ...request.query,
    ...request.pagination,
    mode: "active",
  });
  response.json({
    success: true,
    message: "Active bookings fetched successfully.",
    data,
  });
};

export const providerHistory = async (request, response) => {
  const data = await bookingService.listProviderBookings(request.user._id, {
    ...request.query,
    ...request.pagination,
    mode: "history",
  });
  response.json({
    success: true,
    message: "Booking history fetched successfully.",
    data,
  });
};

export const accept = async (request, response) =>
  response.json({
    success: true,
    message: "Booking accepted successfully.",
    data: {
      booking: bookingService.bookingView(
        await bookingService.transitionProviderBooking(
          request.params.id,
          request.user._id,
          "accepted",
        ),
      ),
    },
  });
export const reject = async (request, response) =>
  response.json({
    success: true,
    message: "Booking rejected successfully.",
    data: {
      booking: bookingService.bookingView(
        await bookingService.transitionProviderBooking(
          request.params.id,
          request.user._id,
          "rejected",
          request.body.rejectionReason,
        ),
      ),
    },
  });
export const start = async (request, response) =>
  response.json({
    success: true,
    message: "Booking started successfully.",
    data: {
      booking: bookingService.bookingView(
        await bookingService.transitionProviderBooking(
          request.params.id,
          request.user._id,
          "in_progress",
        ),
      ),
    },
  });
export const complete = async (request, response) =>
  response.json({
    success: true,
    message: "Booking completed successfully.",
    data: {
      booking: bookingService.bookingView(
        await bookingService.transitionProviderBooking(
          request.params.id,
          request.user._id,
          "completed",
        ),
      ),
    },
  });

export const adminList = async (request, response) => {
  const data = await bookingService.listAdminBookings({
    ...request.query,
    ...request.pagination,
  });
  response.json({
    success: true,
    message: "Bookings fetched successfully.",
    data,
  });
};

export const adminStatus = async (request, response) => {
  const booking = await bookingService.adminTransition(
    request.params.id,
    request.body.status,
    request.body,
  );
  response.json({
    success: true,
    message: "Booking status updated successfully.",
    data: { booking: bookingService.bookingView(booking) },
  });
};

export const reassignProvider = async (request, response) => {
  const booking = await bookingService.reassignProvider(
    request.params.id,
    request.body.providerId,
  );
  response.json({
    success: true,
    message: "Provider reassigned successfully.",
    data: { booking: bookingService.bookingView(booking) },
  });
};
