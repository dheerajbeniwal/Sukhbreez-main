# In-App Notification API

Phase 7 notifications are server-created in-app notifications. Push, email, SMS, Firebase, WebSockets, and Socket.IO are out of scope.

All endpoints require `Authorization: Bearer <accessToken>`. Every query and update is scoped to the authenticated user.

## Endpoints

- `GET /api/v1/notifications?page=1&limit=10&isRead=false`
- `GET /api/v1/notifications/unread-count`
- `PATCH /api/v1/notifications/:id/read` with an empty body
- `PATCH /api/v1/notifications/read-all` with an empty body

List responses include `data.notifications` and `data.pagination`, sorted newest first. Pagination limits are 1-50. `isRead` accepts only `true` or `false`.

Unread count response:

```json
{
  "success": true,
  "data": { "count": 5 }
}
```

Marking a notification read returns the safe notification object. Read-all returns `data.updatedCount`.

## Event types

The server supports:

- `booking_created`
- `booking_accepted`
- `booking_rejected`
- `booking_started`
- `booking_completed`
- `booking_cancelled`
- `payment_updated`
- `review_received`
- `system`

Booking events are emitted from booking service transitions. Payment events are emitted from online verification, cash reporting, admin verification, and supported webhook status changes. Review creation emits `review_received` for the reviewed provider.

Notification failures are isolated from the primary booking, payment, or review operation. Duplicate event attempts use an optional unique deduplication key and do not create a second record.

## Security and ownership

Clients cannot create arbitrary notifications or provide `userId`. The notification service is internal-only. A user can list, count, or mark read only their own notifications. Invalid or foreign notification IDs return `404`; invalid IDs are rejected with `400` before database access. Notification responses do not expose secrets, signatures, password fields, or internal account data.

## Status codes

- `200`: successful read or update
- `400`: invalid identifier, query, or non-empty update body
- `401`: authentication required
- `403`: reserved for role authorization failures on future admin operations
- `404`: notification does not exist for the authenticated user
- `500`: unexpected internal error

## Current limitations

Notifications are persisted in MongoDB and require the database connection. Delivery is in-app only; there is no real-time push channel. Notification creation is best-effort so a notification persistence issue cannot fail the core business operation.
