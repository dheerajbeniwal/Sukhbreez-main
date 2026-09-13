# Authentication

## Roles

- `customer`: self-registers and uses customer functionality.
- `provider`: self-registers with a provider profile; access is blocked until approval.
- `admin`: created only by the controlled environment-based seed mechanism; there is no public registration route.

## Endpoints

- `POST /api/v1/auth/register/customer`
- `POST /api/v1/auth/register/provider`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/admin/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `PATCH /api/v1/auth/change-password`

Development-only role probes are available at `/api/v1/dev-auth/customer`, `/provider`, and `/admin` to verify `authorize` behavior. They are not mounted in production.

Registration validates Indian mobile numbers, password length, confirmation, and provider profile fields. Duplicate mobiles return `409`. Login returns a short-lived access token and sets a refresh token in an HTTP-only cookie. Login errors do not identify whether the mobile or password was wrong.

## Token flow

Access JWTs contain only `userId` and `role`. The refresh JWT is validated against a hashed, persisted session. Refresh rotates and revokes the old session. Logout revokes the current session and clears the cookie. Changing a password revokes all active refresh sessions.

`authenticate` verifies the access token, loads the current user, and rejects missing, invalid, blocked, suspended, or pending-provider access. `authorize(...roles)` returns `403` when an authenticated user has insufficient role permissions. Missing or invalid credentials return `401`.

## Account status

Only active accounts authenticate. Blocked and suspended accounts remain stored for audit and cannot authenticate or access protected routes. Providers additionally require an approved `ProviderProfile`.

## Local verification

1. Copy `.env.example` to `.env` and set MongoDB and JWT values.
2. Start with `npm run dev` from `server`.
3. Check `GET /api/health`.
4. Register a customer, then log in and call `/me` with its access token.
5. Register a provider and verify login is rejected while approval is pending.
6. Verify duplicate registration, invalid login, missing/invalid token, refresh rotation, logout, and password change behavior.
