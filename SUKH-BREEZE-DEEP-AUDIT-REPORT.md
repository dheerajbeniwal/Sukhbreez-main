# SUKH BREEZE - DEEP AUDIT REPORT

Date: 2026-09-13
Scope: Read-only backend + frontend audit

## Audit Status

The audit was performed against the current `server/` and `client/` source trees. No source code changes were made during the audit. The report file itself was created only after the later explicit request to provide the audit in a file.

## High Severity Findings

### 1. Admin can verify an unpaid online payment — FIXED

- **File + line reference:** `server/src/services/payment.service.js:353-371`
- **What's wrong:** Previously, `verifyAdminPayment()` accepted both `pending` and `paid` payments without checking `paymentMethod`. A pending Razorpay payment could therefore be moved directly to `verified` without successful Razorpay payment verification or webhook confirmation.
- **Why it matters:** Financial integrity risk. An unpaid online order can be treated as verified, the booking payment status becomes verified, commission is calculated, and settlement can proceed.
- **Severity:** High — fixed
- **Suggested fix:** Implemented a method-aware guard and atomic update condition. Pending manual payments remain eligible; pending online payments are rejected, while paid online payments remain eligible.
- **Evidence:** Before the fix, the update condition was `paymentStatus: { $in: ["pending", "paid"] }` with no payment-method restriction. After the fix, a live database probe returned HTTP/service status `409` with `Online payment must be paid before admin verification.` and the payment remained `pending`. Existing cash verification continued to return `200`.
- **Stage 1 validation:** `npm run test:integration` passed 8/8; `npm test` passed 59/59.

## Medium Severity Findings

### 2. Provider completed-job count is never incremented

- **File + line reference:** `server/src/services/booking.service.js:275-304`; `server/src/models/ProviderProfile.js:46`
- **What's wrong:** Provider booking transitions set the booking status to `completed`, but no code increments `ProviderProfile.totalCompletedJobs`.
- **Why it matters:** Provider profiles can permanently show stale or zero completed-job counts.
- **Severity:** Medium
- **Suggested fix:** Atomically increment `totalCompletedJobs` when a booking enters `completed`, including admin transitions, while preventing duplicate increments.

### 3. Provider registration accepts inactive or nonexistent categories — FIXED

- **File + line reference:** `server/src/services/auth.service.js:90-112`
- **What's wrong:** Previously, provider registration checked only that `categoryId` had a valid ObjectId format and did not verify that the category existed and was active before creating `ProviderProfile`.
- **Why it matters:** The database can contain provider profiles referencing invalid or inactive categories. Those providers may be impossible to discover through the public provider list.
- **Severity:** Medium — fixed
- **Suggested fix:** Implemented `Category.findOne({ _id: categoryId, isActive: true })` before user/profile creation and return `404 Active category not found.` when the check fails.
- **Evidence:** A live probe using an inactive temporary category returned `404 Active category not found.` and did not create the provider.

### 4. Past booking dates are accepted by the backend — FIXED

- **File + line reference:** `server/src/validators/booking.validator.js:48-70`
- **What's wrong:** Previously, `validateCreateBooking()` checked only whether `serviceDate` was parseable and did not reject dates before the current business date.
- **Why it matters:** A client can bypass the frontend date restriction and create appointments in the past.
- **Severity:** Medium — fixed
- **Suggested fix:** Implemented an explicit `Asia/Kolkata` business-calendar comparison and reject dates earlier than the current business calendar date.
- **Evidence:** A direct validator probe with `2000-01-01T10:00:00.000Z` returned `400 Invalid booking request.` and did not call `next()`.

### 5. Date-only frontend input can shift across timezones

- **File + line reference:** `client/src/pages/Pages.jsx:66`
- **What's wrong:** The booking form converts a date-only input with `new Date(form.serviceDate).toISOString()`. Date-only values can shift to a different calendar day depending on timezone.
- **Why it matters:** The displayed booking date and backend/admin date filtering can disagree.
- **Severity:** Medium
- **Suggested fix:** Send a date-only value or normalize date ranges consistently in the application timezone.

### 6. Already-reviewed bookings show the review form again after reload

- **File + line reference:** `client/src/pages/Pages.jsx:74`
- **What's wrong:** `BookingCard` keeps `reviewed` only in component-local state initialized to `false`. The frontend does not call the existing `GET /reviews/booking/:bookingId` endpoint.
- **Why it matters:** After reload, an already-reviewed booking displays the form again and the next submission returns `409`, creating a misleading UX and unnecessary failed request.
- **Severity:** Medium
- **Suggested fix:** Load the existing review for completed bookings before rendering the review form.

### 7. Frontend auth validation does not fully match backend rules

- **File + line reference:** `client/src/pages/Pages.jsx:18-20`; `server/src/validators/auth.validator.js:3-18`
- **What's wrong:** Login does not enforce the backend's ten-digit mobile format. Password confirmation matching is also delegated to the API instead of being checked before submission.
- **Why it matters:** Users receive avoidable API validation failures instead of immediate form feedback.
- **Severity:** Medium
- **Suggested fix:** Add frontend validation matching the backend: valid ten-digit mobile, minimum password length, and matching confirmation password.

## Low Severity Findings

### 8. Static upload path depends on the process working directory — FIXED

- **File + line reference:** `server/src/app.js:54`
- **What's wrong:** Previously, `express.static("src/uploads")` resolved relative to the process working directory.
- **Why it matters:** Starting the server from another directory can make uploads unavailable or resolve the static path incorrectly.
- **Severity:** Low — fixed
- **Suggested fix:** Implemented `fileURLToPath(new URL("./uploads", import.meta.url))` and pass the resulting absolute path to `express.static()`.
- **Evidence:** Backend lint, unit tests, integration tests, and source diagnostics all pass after the module-relative path change.

### 9. Access token is persisted in localStorage

- **File + line reference:** `client/src/services/api.js:5-18`
- **What's wrong:** The access token is stored in `localStorage` and restored on startup.
- **Why it matters:** If an XSS vulnerability occurs, JavaScript can read the token and impersonate the user until token expiry.
- **Severity:** Low
- **Suggested fix:** Prefer a short-lived in-memory access token with the existing HTTP-only refresh cookie, together with a strong CSP and XSS controls.

## Verified Safe Areas

- Booking amount is server-authoritative and client-supplied `amount` is rejected.
- Customer, provider, and admin route authorization is enforced server-side.
- Frontend protected routes redirect unauthenticated or wrong-role users.
- Provider approval and account status are checked before provider access.
- Review ownership and completed-booking requirements are enforced.
- Notification reads are scoped to the authenticated user.
- Payment amounts are immutable.
- Razorpay webhook signatures use the raw request body and timing-safe comparison.
- Razorpay webhook records are bound to stored gateway identifiers.
- Passwords and gateway signatures are excluded from normal responses.
- Production JWT secret checks are present.
- Environment loading uses a stable absolute path based on `import.meta.url`.

## Cross-Cutting Contract Review

The main current frontend/backend response contracts match for authentication, categories, providers, bookings, payments, reviews, and notifications. The previously observed category issue was caused by local CORS/origin mismatch and empty test data, not by a response-shape mismatch. The current registration payload separates customer fields from provider-only fields.

## Rate Limiting, CORS, and Helmet

- Global rate limiting is configured at 100 requests per 15 minutes.
- Authentication has a stricter 10-attempt limit per 15 minutes.
- CORS is restricted to the configured `CLIENT_URL` and credentials are enabled.
- Helmet is enabled with its default middleware configuration.
- The observed local `429` was consistent with repeated requests from multiple open browser tabs exhausting the global limiter; it was not evidence of an authorization bypass.

## Deferred Items

- Booking ID collision risk remains deferred.
- Razorpay TEST/live verification remains pending because credentials are not configured.
- Tailwind `@theme` and `@tailwind` build warnings remain unchanged.
- The `Pages.jsx` monolith remains existing technical debt.
- The full admin frontend dashboard is intentionally outside the completed Phase 8 scope.

## Verification Results

- Backend lint: passed after Stage 2.
- Backend unit tests: 59 passed, 0 failed after Stage 1 and Stage 2.
- Backend integration tests: 8 passed, 0 failed after Stage 1 and Stage 2.
- Client lint: passed.
- Client build: passed.
- Client build continues to emit the known Tailwind warnings.
- Workspace diagnostics reported no source errors during the audit.

## Overall Verdict

SUKH BREEZE is safe to continue building on for normal development. The unpaid online-payment verification path, inactive-category registration gap, past-date acceptance, and working-directory upload-path issue identified in this audit are now fixed and verified. The remaining findings are limited to frontend date handling, review reload UX, frontend validation parity, and access-token storage; those should be addressed before calling the platform production-ready.
