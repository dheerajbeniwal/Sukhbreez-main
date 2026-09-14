<<<<<<< HEAD
# Sukh Breeze

Sukh Breeze is a production-oriented local service marketplace foundation. Customers will be able to hire providers, providers will manage jobs, and administrators will operate the platform.

## Stack

- Client: React 19, Vite, Tailwind CSS, React Router, Axios, React Hook Form, Context API
- Server: Node.js, Express, MongoDB Atlas, Mongoose
- Security and operations: Helmet, CORS, cookie-parser, rate limiting, Morgan, dotenv, Multer, Validator, ESLint, Prettier, Nodemon

## Run locally

```powershell
cd client
npm run dev
```

```powershell
cd server
Copy-Item .env.example .env
npm run dev
```

The API health check is available at `http://localhost:5000/api/health` and returns a success payload. Configure `MONGODB_URI` before using authentication.

## Authentication

Authentication uses one `User` model for `customer`, `provider`, and `admin` roles. Provider-specific data lives in `ProviderProfile`; new providers begin with `approvalStatus=pending` and cannot log in until approved. Passwords are bcrypt-hashed and never returned. Refresh tokens are stored as hashes, rotated on refresh, and sent using an HTTP-only cookie.

Required server variables:

- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN` (for example, `15m`)
- `JWT_REFRESH_EXPIRES_IN` (for example, `7d`)
- `CLIENT_URL`, `PORT`, and `NODE_ENV`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` for online payments. These may remain empty in development; online payment endpoints then return a configuration error.
- `RAZORPAY_TIMEOUT_MS` is optional and defaults to `10000`.

Optional controlled admin seed variables are `ADMIN_SEED_MOBILE`, `ADMIN_SEED_PASSWORD`, and `ADMIN_SEED_FULL_NAME`. There is no public admin registration endpoint.

Available endpoints are documented in [docs/authentication.md](docs/authentication.md). Use `Authorization: Bearer <accessToken>` for protected requests.

Payment, commission, and manual settlement endpoints are documented in [docs/payment-api.md](docs/payment-api.md). Booking, reviews, notifications, and frontend business UI remain separate modules.

Review and in-app notification endpoints are documented in [docs/review-api.md](docs/review-api.md) and [docs/notification-api.md](docs/notification-api.md). Reviews require completed customer-owned bookings; notifications are server-created and ownership-scoped.
=======
# Sukhbreez-main
>>>>>>> 96fe19e6f995d82260bfc1214ccbd1ea2ddc94d4
