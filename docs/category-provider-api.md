# Category and Provider API

All endpoints are mounted under `/api/v1`. Responses use `{ success, message, data }`. Protected endpoints require `Authorization: Bearer <accessToken>`.

## Categories

| Method | Endpoint                 | Access                   |
| ------ | ------------------------ | ------------------------ |
| GET    | `/categories`            | Public active categories |
| GET    | `/categories/admin`      | Admin                    |
| POST   | `/categories`            | Admin                    |
| PATCH  | `/categories/:id`        | Admin                    |
| PATCH  | `/categories/:id/status` | Admin                    |
| DELETE | `/categories/:id`        | Admin                    |

Create and update accept `name`, `description`, `icon`, and `image`. Slugs are generated from names. Status accepts only `{ "isActive": true|false }`. A category referenced by a provider or booking cannot be deleted; disable it instead. Disabling never deletes related data.

## Providers

| Method | Endpoint                        | Access            |
| ------ | ------------------------------- | ----------------- |
| GET    | `/providers`                    | Customer          |
| GET    | `/providers/:id`                | Customer          |
| GET    | `/providers/me`                 | Approved provider |
| PATCH  | `/providers/me`                 | Approved provider |
| PATCH  | `/providers/me/availability`    | Approved provider |
| GET    | `/providers/admin`              | Admin             |
| GET    | `/providers/admin/:id`          | Admin             |
| PATCH  | `/providers/admin/:id/approval` | Admin             |
| PATCH  | `/providers/admin/:id/status`   | Admin             |

Customer provider discovery requires an approved, active, available provider and an active category. Pending, rejected, blocked, suspended, or unavailable providers return no public result. Provider details use safe projections and never expose passwords or tokens.

Provider listing supports `categoryId`, `available`, `search`, `page`, and `limit`. Customer search matches provider name. Admin listing additionally supports `approvalStatus` and `accountStatus`, and can inspect all provider states. Page defaults to `1`, limit defaults to `10`, and limit is capped at `50`.

Providers can update only `fullName`, `profileImage`, `categoryId`, `experience`, `address`, `bio`, and `startingCharge`. They cannot change role, account status, approval, rating counters, or authentication credentials. Category changes require an active category. Admin approval accepts `approved` or `rejected`; admin status accepts `active`, `blocked`, or `suspended`, and synchronizes User and ProviderProfile status. Blocked or suspended providers are made unavailable.

## Example

```json
{
  "success": true,
  "message": "Providers fetched successfully.",
  "data": {
    "providers": [],
    "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
  }
}
```

Booking, payment, review, notification, and frontend APIs are intentionally outside this phase.
