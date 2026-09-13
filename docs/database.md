# Database Design

Sukh Breeze uses MongoDB Atlas with Mongoose. Schemas are strict and use timestamps.

## Models and relationships

- `User`: authentication identity for customer, provider, and admin roles. Password is `select: false`.
- `ProviderProfile`: one profile per provider `User`, with category, service information, approval, availability, and aggregate rating data.
- `Category`: admin-managed service category referenced by provider profiles and bookings.
- `Booking`: customer request referencing customer/provider users and a category. Its address is a snapshot so later profile changes do not alter historical bookings.
- `Payment`: manual payment record associated one-to-one with a booking and referencing customer, provider, and verifying admin users.
- `Review`: customer review of a provider for a booking.
- `Notification`: lightweight user notification record.
- `Settings`: key/value platform configuration with the admin user who last updated it.

Authentication data stays in `User`; provider business data stays in `ProviderProfile`. Other models reference users with MongoDB ObjectIds and do not duplicate passwords or tokens.

## Status lifecycles

Booking statuses are `pending`, `accepted`, `rejected`, `in_progress`, `completed`, and `cancelled`. Payment statuses are `pending`, `paid`, `verified`, `refunded`, and `failed`.

Providers start with `approvalStatus=pending` and `availability=false`. Provider account status and user account status both support `active`, `blocked`, and `suspended`.

## Constraints and indexes

- Unique `User.mobile`.
- Unique `Category.name` and `Category.slug`.
- Unique `ProviderProfile.userId`.
- Unique human-readable `Booking.bookingId`.
- Unique `Payment.bookingId` for one payment record per booking.
- Unique compound `Review.bookingId + Review.customerId`.
- Unique `Settings.key`.
- Query indexes cover booking ownership/status/date, provider approval/category, notification unread feeds, and refresh-token expiry.

Mongoose validation enforces required values, controlled enums, non-negative monetary/count fields, rating bounds, and strict schemas. Unique indexes are database constraints and should be handled as `409` responses by future controllers.
