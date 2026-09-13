# Review and Rating API

Phase 7 reviews are in-app marketplace reviews tied to completed bookings. Protected requests use `Authorization: Bearer <accessToken>`.

## Endpoints

Customer:

- `POST /api/v1/reviews`
- `GET /api/v1/reviews/my?page=1&limit=10`
- `GET /api/v1/reviews/booking/:bookingId`

Provider:

- `GET /api/v1/reviews/provider/me?page=1&limit=10`

Public:

- `GET /api/v1/reviews/provider/:providerId?page=1&limit=10`

Admin:

- `GET /api/v1/reviews/admin?page=1&limit=10&providerId=...&customerId=...&rating=5`
- `GET /api/v1/reviews/admin/:id`
- `DELETE /api/v1/reviews/admin/:id`

All list endpoints return `data.reviews` and `data.pagination`, sorted newest first. Pagination limits are 1-50.

## Create review

`POST /api/v1/reviews` requires a customer and accepts only:

```json
{
  "bookingId": "BOOKING_OBJECT_ID",
  "rating": 5,
  "comment": "Excellent service."
}
```

`customerId` and `providerId` are always derived server-side. Rating is an integer from 1 to 5. Comment is optional and capped at 2,000 characters. Unexpected fields and protected-field injection are rejected with `400`.

## Eligibility and ownership

A review can be created only when the booking exists, belongs to the authenticated customer, is `completed`, and has an assigned provider. Missing or inaccessible bookings return `404`. The unique `(bookingId, customerId)` constraint prevents duplicate reviews; duplicate attempts return `409`.

`GET /booking/:bookingId` also requires customer ownership of the booking. Providers can only access their own review list through `/provider/me`. Public provider reviews expose only safe customer/provider identity fields: ID, full name, and profile image.

## Rating synchronization

After creation or admin deletion, the service aggregates actual Review records for the provider and updates `ProviderProfile.ratingAverage` and `ProviderProfile.totalReviews`. The client cannot submit or modify either statistic. A provider with no reviews is reset to average `0` and total `0`.

Creating a review also creates a deduplicated `review_received` notification for the provider.

## Status codes

- `201`: review created
- `200`: successful read or deletion
- `400`: invalid body, query, rating, or identifier
- `401`: authentication required
- `403`: role is not allowed
- `404`: missing or inaccessible booking/review
- `409`: duplicate review or business conflict

## Current limitations

Rating refresh and review writes are separate database operations because the existing project does not establish a transaction abstraction. Review creation compensates by removing the newly created review if provider-stat refresh fails. Database-backed concurrency tests remain required before live production use.
