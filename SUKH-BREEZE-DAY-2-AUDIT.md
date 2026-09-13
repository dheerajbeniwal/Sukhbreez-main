# SUKH BREEZE

## DAY 2 - COMPLETE PROJECT AUDIT REPORT

Audit date: 2026-09-05  
Scope: Existing repository only. Phase 7 was not implemented.

Verification labels:

- **VERIFIED**: directly confirmed by source inspection or an executed check.
- **IMPLEMENTED BUT NOT RUNTIME TESTED**: code exists, but requires MongoDB, credentials, or data fixtures not available for this audit.
- **NOT IMPLEMENTED**: no implementation was found.
- **RECOMMENDED FOR FUTURE**: proposed work, not a current capability.

## 1. PROJECT OVERVIEW

Sukh Breeze is a two-package home-service marketplace repository. The backend has a substantial Express/Mongoose implementation for authentication, categories, providers, bookings, payments, commission, and manual settlement. The frontend is a React/Vite foundation shell only.

The requested Routes -> Middleware -> Controllers -> Services -> Models architecture is present. No new feature was started. One confirmed provider-search defect was fixed during this audit; pricing integrity and payment hardening issues remain recommendations because their safe resolution requires product and concurrency design decisions.

## 2. CURRENT PROJECT STATUS

| Phase | Module                          | Status                           | Production Readiness          | Notes                                                                        |
| ----- | ------------------------------- | -------------------------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| 1     | Express and MongoDB foundation  | Implemented                      | Partially ready               | Health and middleware verified; database connection not tested               |
| 2     | Authentication                  | Implemented in code              | Not runtime-certified         | DB, cookie, refresh, and account lifecycle flows not exercised               |
| 3     | Database models                 | Implemented in code              | Needs hardening               | Schemas and indexes inspected; cross-document invariants are service-level   |
| 4     | Category API                    | Implemented in code              | Ready for integration testing | Admin protection and reference checks present                                |
| 4     | Provider API                    | Implemented; search defect fixed | Needs regression tests        | Search fix lint/import verified; DB query not run                            |
| 5     | Booking API                     | Implemented in code              | Not production-ready          | Customer-controlled amount is a financial-integrity blocker                  |
| 6     | Payment, commission, settlement | Implemented in code              | Not live-ready                | Razorpay not credential-tested; concurrency and webhook binding debt remains |
| 7     | Frontend workflows              | Not started                      | Not ready                     | Only static React shell exists                                               |

## 3. PROJECT ARCHITECTURE REVIEW

**VERIFIED:** Backend routes mount validators and auth middleware before controllers; controllers delegate to services; services use Mongoose models. Error handling is centralized. The client has Vite, React 19, and a single wildcard route.

The repository has separate `client` and `server` packages, with no root package or CI workflow. Empty feature directories are placeholders. `multer` is declared but no upload route or active usage was found.

## 4. PHASE 1 REVIEW

**VERIFIED:** Express setup, Helmet, CORS with credentials, Morgan, cookie-parser, JSON and URL-encoded parsing, global rate limiting, static `/uploads`, health route, 404 handling, global error handling, and raw webhook body capture are present.

`GET /api/health` returned HTTP 200 from an ephemeral listener. The server can intentionally start without MongoDB in development, so this does not prove Atlas connectivity. Production startup validates `MONGODB_URI` and JWT secrets, but not Razorpay variables because online payment configuration is optional.

## 5. PHASE 2 REVIEW

**VERIFIED in source:** Customer/provider registration, customer/provider login, admin login, bcrypt hashing, `password: select:false`, access and refresh JWTs, hashed persisted refresh tokens, rotation, revocation, logout, password change, current-user endpoint, role authorization, blocked/suspended checks, provider approval checks, and authentication rate limiting.

**IMPLEMENTED BUT NOT RUNTIME TESTED:** MongoDB-backed registration/login/refresh/logout, browser cookie behavior, refresh races, and account-state transitions.

Development fallback JWT secrets exist. They are acceptable only for controlled development; production-like deployments must fail closed rather than accidentally use defaults.

Admin registration is not public.

## 6. PHASE 3 DATABASE REVIEW

All requested models exist: `User`, `ProviderProfile`, `Category`, `Booking`, `Payment`, `Review`, `Notification`, `Settings`, and `RefreshToken`.

**VERIFIED:** Required fields, enums, ObjectId references, timestamps, strict schemas on business models, safe password/signature selection, unique constraints, and relevant status/ownership indexes are present. The requested relationships are represented. `Payment.bookingId` is unique, and review uniqueness is constrained by booking/customer.

`RefreshToken` has one explicit TTL index on `expiresAt`; its `unique` plus `index` declarations on `tokenHash` are redundant index declarations and should be simplified during a deliberate schema cleanup.

Review and Notification models have no active route/service implementation.

## 7. PHASE 4 CATEGORY REVIEW

**VERIFIED in source:** Public active listing; admin list, create, update, status, and delete routes; admin authentication/authorization; validation; duplicate name/slug protection; slug generation; active/inactive handling; mass-assignment allowlists; and deletion checks for provider and booking references.

**IMPLEMENTED BUT NOT RUNTIME TESTED:** Database uniqueness races, populated-reference behavior, and actual HTTP responses against Atlas.

## 8. PHASE 4 PROVIDER REVIEW

**VERIFIED in source:** Public discovery/details, provider self profile/update/availability, admin list/details/approval/status, pagination, category and availability filtering, ownership protection, and safe projections. Public visibility requires approved/active profile, active user, availability, and active category.

**FIXED DURING AUDIT:** `server/src/services/provider.service.js` referenced `escapeRegex` before its `const` initialization. Any non-empty provider `search` query could throw `ReferenceError`. The helper was moved before first use. Backend lint and module import passed afterward. A database-backed search request remains untested.

## 9. PHASE 5 BOOKING REVIEW

**VERIFIED in source:** Customer create/list/detail/cancel; provider requests, active, history, accept, reject, start, complete; admin list/status/reassignment; ownership checks; provider/category/approval/account/availability checks; pagination; escaped search; ID validation; state transition rules; booking ID collision retry; and separation of booking status from payment status.

State machine verified: `pending -> accepted -> in_progress -> completed`, with `pending -> rejected`, `pending -> cancelled`, and `accepted -> cancelled`. Invalid transitions return conflict errors.

**HIGH DEFECT:** Booking creation accepts `amount` from the customer and stores it directly. The stored value later controls Razorpay amount, commission, and provider payable amount. There is no server-side quote or immutable catalog price snapshot. This must be resolved before production.

## 10. PHASE 6 PAYMENT REVIEW

**VERIFIED in source:** Online order creation, customer ownership checks, rupee-to-paise conversion, payment signature verification, cash reporting by assigned provider, admin verification, server-side commission calculation, historical commission snapshots, manual settlement, duplicate payment record protection, and Booking.paymentStatus synchronization without changing Booking.status.

Default commission is 10%; calculation is `amount * percentage / 100`, with two-decimal rounding for commission and provider payable amounts.

Remaining risks: read-then-write verification/settlement races; cash reporting can conflict with an existing pending online payment; and webhook reconciliation uses booking notes without fully matching stored gateway order/payment identifiers. These are not safe to redesign without an explicit payment-state policy and tests.

## 11. RAZORPAY READINESS REVIEW

### Code implementation status

**IMPLEMENTED BUT NOT RUNTIME TESTED:** SDK construction, key/secret configuration, timeout, order creation, INR paise conversion, HMAC payment signature verification, raw-body webhook capture, webhook signature verification, `payment.captured`, `payment.failed`, `order.paid`, and repeated-success protection.

### Test environment readiness

The code supports missing online credentials by returning a configuration error. No Razorpay test credentials were used, no real payment was created, and no webhook was sent.

### Live production readiness

**NOT READY:** Live readiness requires test-mode integration evidence, gateway identifier binding, replay/concurrency tests, production secret validation, and a server-authoritative booking price.

## 12. DATABASE AND INDEX REVIEW

Important indexes exist for user identity/status, provider category/status, booking ownership/provider/category/status/date, payment booking/order/payment/status/settlement, category activity, settings key, and refresh-token expiry.

No index was added during this audit. The main index note is the redundant `tokenHash` declaration in `RefreshToken`; it is low risk but should be cleaned up with a migration-aware change. Actual query plans and Atlas index state were not inspected because no database session was used.

## 13. SECURITY AUDIT RESULTS

**VERIFIED protections:** authentication and role guards on protected routes; booking customer/provider ownership checks; admin-only operations; allowlisted updates; safe populated fields; hidden password and gateway signature; escaped user search regexes where execution reaches them; ObjectId validation; and no public admin registration.

**Findings:**

- High: customer-controlled booking amount enables price and settlement manipulation.
- Medium: payment verification and settlement are not atomic conditional state transitions.
- Medium: webhook events are not fully bound to stored gateway identifiers.
- Medium: provider User/Profile status synchronization is multi-document and non-transactional.
- Medium: pending online and cash payment methods can conflict.
- Low: predictable development JWT fallbacks are dangerous if deployment mode is misconfigured.

No evidence was found of password, refresh token, Razorpay secret, or webhook secret exposure through reviewed responses.

## 14. API ROUTE INVENTORY

### Health

- `GET /api/health`

### Authentication

- `POST /api/v1/auth/register/customer`
- `POST /api/v1/auth/register/provider`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/admin/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `PATCH /api/v1/auth/change-password`

### Categories

- `GET /api/v1/categories`
- `GET /api/v1/categories/admin`
- `POST /api/v1/categories`
- `PATCH /api/v1/categories/:id`
- `PATCH /api/v1/categories/:id/status`
- `DELETE /api/v1/categories/:id`

### Providers

- `GET /api/v1/providers`
- `GET /api/v1/providers/:id`
- `GET /api/v1/providers/me`
- `PATCH /api/v1/providers/me`
- `PATCH /api/v1/providers/me/availability`
- `GET /api/v1/providers/admin`
- `GET /api/v1/providers/admin/:id`
- `PATCH /api/v1/providers/admin/:id/approval`
- `PATCH /api/v1/providers/admin/:id/status`

### Bookings

- `POST /api/v1/bookings`
- `GET /api/v1/bookings/my`
- `GET /api/v1/bookings/:id`
- `PATCH /api/v1/bookings/:id/cancel`
- `GET /api/v1/bookings/provider/requests`
- `GET /api/v1/bookings/provider/active`
- `GET /api/v1/bookings/provider/history`
- `PATCH /api/v1/bookings/:id/accept`
- `PATCH /api/v1/bookings/:id/reject`
- `PATCH /api/v1/bookings/:id/start`
- `PATCH /api/v1/bookings/:id/complete`
- `GET /api/v1/bookings/admin`
- `PATCH /api/v1/bookings/admin/:id/status`
- `PATCH /api/v1/bookings/admin/:id/reassign-provider`

### Payments

- `POST /api/v1/payments/create-order`
- `POST /api/v1/payments/verify`
- `POST /api/v1/payments/cash/received`
- `POST /api/v1/payments/webhook/razorpay`
- `GET /api/v1/payments/admin`
- `GET /api/v1/payments/admin/:id`
- `PATCH /api/v1/payments/admin/:id/verify`
- `GET /api/v1/payments/admin/commission`
- `PATCH /api/v1/payments/admin/commission`
- `GET /api/v1/payments/admin/settlements`
- `PATCH /api/v1/payments/admin/:id/settle`

### Development-only

- `/api/v1/dev-auth/*` is mounted outside production; its route inventory is development support only and is not a production API.

## 15. VALIDATION AND ERROR HANDLING REVIEW

**VERIFIED:** Validators reject unexpected fields in key write requests, validate ObjectIds, constrain pagination, validate enums and reasons, and prevent common mass assignment. Controllers delegate errors to the global handler. Duplicate keys map to HTTP 409, validation errors to 400, and unexpected production errors hide stack traces.

The default Express JSON parser accepts 1 MB, and a global rate limiter is configured. No automated contract tests exist. Some cross-document and state invariants are validated only through service read-then-write sequences.

## 16. TESTING AND RUNTIME VERIFICATION RESULTS

| Check                                        | Result                                              |
| -------------------------------------------- | --------------------------------------------------- |
| Server ESLint                                | VERIFIED: passed                                    |
| Client ESLint                                | VERIFIED: passed                                    |
| Client Vite build                            | VERIFIED: passed; Tailwind at-rule warnings emitted |
| Express app import/start                     | VERIFIED: ephemeral listener started                |
| `GET /api/health`                            | VERIFIED: HTTP 200                                  |
| Protected booking request without auth       | VERIFIED: HTTP 401                                  |
| Protected admin payment request without auth | VERIFIED: HTTP 401                                  |
| MongoDB Atlas connection and CRUD            | NOT RUNTIME TESTED                                  |
| Authenticated role/ownership flows           | NOT RUNTIME TESTED                                  |
| Razorpay test gateway/webhooks               | NOT RUNTIME TESTED                                  |
| Concurrency behavior                         | NOT RUNTIME TESTED                                  |
| Automated tests                              | NOT IMPLEMENTED; no test suite found                |

No permanent test data or real financial transaction was created.

## 17. BUGS OR DEFECTS FOUND

### 1. Customer controls booking amount

- Severity: High
- Description: `validateCreateBooking` accepts `amount`; `createBooking` persists it without a server-authoritative quote.
- Affected files: `server/src/validators/booking.validator.js`, `server/src/services/booking.service.js`, `server/src/services/payment.service.js`
- Production impact: Customer can influence payment, commission, and provider payable amounts.
- Status: Not Fixed; requires pricing/product decision and focused tests.

### 2. Payment state transitions are non-atomic

- Severity: Medium
- Description: Verification and settlement use read-check-save sequences.
- Affected file: `server/src/services/payment.service.js`
- Production impact: Concurrent requests may duplicate state-side effects or produce inconsistent records.
- Status: Recommendation.

### 3. Webhook gateway identity binding is incomplete

- Severity: Medium
- Description: Webhooks locate a payment from booking notes but do not fully compare event order/payment IDs with stored gateway IDs.
- Affected file: `server/src/services/payment.service.js`
- Production impact: Incorrect reconciliation is possible if a signed but mismatched event reaches the endpoint.
- Status: Recommendation.

### 4. Payment method conflict

- Severity: Medium
- Description: Cash reporting can change an existing pending online payment to cash while retaining gateway identifiers.
- Affected file: `server/src/services/payment.service.js`
- Production impact: Cash and online flows can compete for one booking payment.
- Status: Recommendation.

### 5. Provider/User status synchronization is non-transactional

- Severity: Medium
- Description: Provider status changes update two documents without a transaction.
- Affected files: provider service and provider/user models
- Production impact: Partial failure can leave authorization and profile visibility inconsistent.
- Status: Recommendation.

### 6. Tailwind build warnings

- Severity: Low
- Description: Vite build succeeds but lightningcss reports unknown `@theme` and `@tailwind` at-rules.
- Affected files: client CSS/build pipeline
- Production impact: CSS processing should be confirmed before relying on Tailwind utilities.
- Status: Recommendation.

## 18. FILES MODIFIED DURING THIS AUDIT

- `server/src/services/provider.service.js`: moved `escapeRegex` before its first use, fixing provider search failure.
- `SUKH-BREEZE-DAY-2-AUDIT.md`: updated this report to reflect the current verified state.

No Phase 7 feature files were added or modified.

## 19. CURRENT TECHNICAL DEBT

- No automated backend or frontend test suite.
- No root workspace scripts or CI pipeline.
- No server-authoritative pricing/quote model.
- Non-atomic payment, settlement, booking, and multi-document status transitions.
- Razorpay integration lacks credentialed integration tests.
- Architecture and some payment documentation need synchronization with current implementation.
- Frontend API configuration, auth state, routes, and business workflows are absent.
- Unused upload dependency and Tailwind build warnings require cleanup when those areas are next developed.

## 20. WHAT IS FULLY COMPLETE

The Express foundation, route composition, basic middleware, health endpoint, authentication source implementation, category source implementation, provider source implementation after the search fix, booking lifecycle source implementation, and payment/commission/settlement source implementation are present. Static linting passes for both packages, and the client production build completes.

## 21. WHAT IS NOT YET IMPLEMENTED

Reviews API, Notifications API, uploads workflow, automatic provider assignment, frontend authentication and dashboards, frontend booking/payment workflows, automated tests, CI, live Razorpay verification, and production-safe server-authoritative pricing are not complete.

## 22. PHASE 7 RECOMMENDATION

Do not begin Phase 7 feature development until the booking price is server-authoritative and payment state/reconciliation tests exist. Based on the actual repository state, Phase 7 should begin with frontend foundation integration: API client, environment configuration, authentication state and refresh handling, role-aware routing, and customer/provider/admin workflows. This is a recommendation only; Phase 7 was not implemented during this audit.

## 23. FINAL PROJECT STATUS

```text
PROJECT FOUNDATION: COMPLETE IN CODE; DATABASE RUNTIME UNVERIFIED
AUTHENTICATION: IMPLEMENTED IN CODE; RUNTIME UNVERIFIED
DATABASE MODELS: IMPLEMENTED IN CODE
CATEGORY & PROVIDER MODULE: IMPLEMENTED; PROVIDER SEARCH FIXED DURING AUDIT
BOOKING MODULE: IMPLEMENTED; HIGH PRICING-INTEGRITY ISSUE REMAINS
PAYMENT & COMMISSION MODULE: IMPLEMENTED; RUNTIME AND CONCURRENCY HARDENING REMAIN
CURRENT AUDIT: PASSED WITH ISSUES
NEXT PHASE: PHASE 7, AFTER BACKEND STABILIZATION
```

Overall result: **ISSUES FOUND**. The backend is a substantial MVP foundation, but it is not production-ready until authoritative pricing and payment integrity hardening are addressed and database-backed regression tests are run.
