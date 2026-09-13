# Booking API

Routes are mounted under `/api/v1/bookings`. Protected requests use `Authorization: Bearer <accessToken>`. Controllers delegate business rules to `booking.service.js`; Payment and automatic provider assignment remain separate modules. Completed bookings can be reviewed through the Review API, and booking transitions create in-app notifications.

## Customer routes

- `POST /` creates a booking. The authenticated customer selects `categoryId` and `providerId`. The category must be active; the provider must be an active, approved, available provider whose profile category matches. Server-controlled status, payment status, customer identity, timestamps, and reason fields are rejected. A `booking_created` notification is sent to the assigned provider.
- `GET /my?page=1&limit=10&status=pending` lists only the authenticated customer's bookings. Limit is capped at 50.
- `GET /:id` returns a booking only to its customer, assigned provider, or an admin.
- `PATCH /:id/cancel` accepts `{ "cancellationReason": "..." }`. Customers can cancel only `pending` or `accepted` bookings. Payment status is unchanged.

## Provider routes

- `GET /provider/requests` lists only assigned `pending` bookings.
- `PATCH /:id/accept` transitions `pending` to `accepted`.
- `PATCH /:id/reject` accepts `{ "rejectionReason": "..." }` and transitions `pending` to `rejected`.
- `PATCH /:id/start` transitions `accepted` to `in_progress` and sets `startedAt`.
- `PATCH /:id/complete` transitions `in_progress` to `completed` and sets `completedAt`.
- `GET /provider/active` lists `accepted` and `in_progress` bookings.
- `GET /provider/history` lists `completed`, `rejected`, and `cancelled` bookings.

Provider actions require the authenticated provider to remain active and approved. Ownership is checked in the service layer; client-supplied provider IDs are not trusted for provider actions.

## Admin routes

- `GET /admin` lists all bookings with optional `status`, `paymentStatus`, `categoryId`, `providerId`, `customerId`, `serviceDate`, and `search` booking ID filters.
- `PATCH /admin/:id/status` accepts controlled status updates and optional rejection/cancellation reasons. It uses the same state-transition matrix as normal flow. It sets `startedAt`, `completedAt`, or `cancelledAt` only when the destination requires it and the timestamp is missing. It never changes payment status.
- `PATCH /admin/:id/reassign-provider` accepts `{ "providerId": "..." }`. The target must be an active, approved, available provider in the booking category. Reassignment sets status back to `pending` and preserves historical timestamps/reasons.

## State machine

```text
pending -> accepted -> in_progress -> completed
pending -> rejected
pending -> cancelled
accepted -> cancelled
```

Terminal states cannot transition further. Invalid transitions return `409`. Customer cancellation requires a reason; provider rejection requires a reason; admin status changes to `rejected` or `cancelled` also require the corresponding reason.

## Responses and safety

Responses use `{ success, message, data }`. Lists include `bookings` and `pagination` with `page`, `limit`, `total`, and `totalPages`. Populated customer/provider/category fields are projected to safe fields. Passwords, JWTs, refresh tokens, and other authentication secrets are never returned.

Booking addresses are snapshots (`fullAddress`, `city`, `pincode`). Booking IDs use `SB-YYYYMMDD-XXXXXX`; creation retries limited times on a unique-ID collision. The booking amount is server-authoritative: the customer cannot submit `amount`, and the service snapshots the approved provider profile's positive `startingCharge` into `Booking.amount`. Payment and commission calculations use that stored booking amount.
