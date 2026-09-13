# Sukh Breeze Current State Report

Inspection date: 2026-09-13

This is a read-only ground-truth inspection of the current project. No application
code was changed. The only file created by this inspection is this report.

## Status table

| Item | Status | Evidence |
|---|---|---|
| ProviderProfile.totalCompletedJobs increments when a booking becomes completed | DONE | `server/src/services/booking.service.js:377-395` sets `booking.status = "completed"` and uses `ProviderProfile.findOneAndUpdate(..., { $inc: { totalCompletedJobs: 1 } })` in the same transaction. |
| Booking form sends a date-only serviceDate | DONE | `client/src/pages/Pages.jsx:98-100` posts `serviceDate: form.serviceDate`; the date input at the same location is `type="date"`, and there is no `.toISOString()` conversion in the submitted value. |
| Review UI checks GET `/reviews/booking/:bookingId` before showing the form | DONE | `client/src/pages/Pages.jsx:113` calls `api.get(\`/reviews/booking/${booking.id}\`)` for completed bookings, shows `Checking review...` while loading, and only renders the form when no existing review is returned. The route is implemented in `server/src/routes/review.routes.js:25-30`. |
| Frontend validates mobile, password length, and password confirmation before submit | DONE | `client/src/pages/Pages.jsx:22-47` validates the 10-digit mobile pattern and minimum 8-character password. Registration also compares `form.password !== form.confirmPassword` at line 43. `submit` returns before API calls when validation fails at lines 58 and 69. |
| Access token is memory-only with silent refresh on app load | NOT DONE | `client/src/services/api.js:9` reads `localStorage`; `setAccessToken` at lines 13-17 writes/removes `sukh_breeze_access_token` in Local Storage. `client/src/context/AuthContext.jsx:17-24` checks Local Storage and calls `/auth/me`; it does not explicitly call `/auth/refresh` on app load. The Axios 401 interceptor in `api.js:31-55` does refresh using the HTTP-only cookie after a 401. |
| Browser Local Storage observation | UNKNOWN for an already-authenticated user; fresh runtime observation was empty | At `http://127.0.0.1:5173/`, browser evaluation returned `{"localStorage":{},"sessionStorage":{},"cookies":""}`. This was a fresh unauthenticated browser context; source code nevertheless persists the token in Local Storage after login. |
| Password show/hide toggle on Login and Register, both roles | DONE | `client/src/components/Shared.jsx:34-36` implements reusable `PasswordField` with a visibility toggle. `client/src/pages/Pages.jsx:60` uses it on Login; line 70 uses it for both registration password fields. Login and registration share the role switch, so the toggle is present for customer/provider flows; admin login uses the same Login page role switch. |
| Git repository, history, tags, and remote | DONE / PARTIAL | Project-local `.git` exists. `git log` and `git remote -v` output is included below. No tags were reported. The remote is the requested repository. The local merge commit exists, but the push was not successful because GitHub returned HTTP 403. |
| Razorpay configuration | NOT DONE | `server/.env` inspection reported `RAZORPAY_KEY_ID=empty`, `RAZORPAY_KEY_SECRET=empty`, and `RAZORPAY_WEBHOOK_SECRET=empty`. |
| Current MongoDB database name | UNKNOWN | The current `MONGODB_URI` value did not expose a database path/query database name to the inspection parser; output was `MONGODB_URI database=NOT_DETECTABLE_FROM_CURRENT_VALUE`. Credentials were not printed. |

## Exact code evidence

### Completed-job counter

From `server/src/services/booking.service.js`:

```js
const booking = await Booking.findOne({
  _id: id,
  ...(admin ? {} : { providerId }),
}).session(session);
if (!booking) throw notFound();
if (!admin) await assertProviderOperational(providerId, booking.categoryId);
assertTransition(booking, "completed");
booking.status = "completed";
booking.completedAt = new Date();
await booking.save({ session });
const profile = await ProviderProfile.findOneAndUpdate(
  { userId: booking.providerId },
  { $inc: { totalCompletedJobs: 1 } },
  { new: true, session, runValidators: true },
);
if (!profile) throw notFound("Provider profile not found.");
completedBooking = booking;
```

### Date-only booking value

From `client/src/pages/Pages.jsx`:

```jsx
serviceDate: form.serviceDate
```

The corresponding input is:

```jsx
<input required type="date" min={new Date().toISOString().slice(0, 10)}
  value={form.serviceDate}
  onChange={(e) => setForm({ ...form, serviceDate: e.target.value })} />
```

The `.toISOString()` call is used only for the minimum-date constraint, not for
the submitted `serviceDate`.

### Review pre-check

From `client/src/pages/Pages.jsx`:

```jsx
useEffect(() => {
  if (booking.status !== "completed") return undefined;
  let active = true;
  api.get(`/reviews/booking/${booking.id}`)
    .then(({ data }) => {
      if (active) setExistingReview(data.data.review);
    })
    .catch((error) => {
      if (active && error.response?.status !== 404) setReviewError(error);
    })
    .finally(() => {
      if (active) setReviewLoading(false);
    });
  return () => { active = false; };
}, [booking.id, booking.status]);
```

The UI renders `Checking review...` during the request and uses the existing
review state before rendering the review form.

### Authentication validation and token storage

From `client/src/pages/Pages.jsx`:

```js
const mobilePattern = /^[6-9]\d{9}$/;

const validateLoginForm = (form) => {
  const errors = {};
  if (!mobilePattern.test(form.mobile))
    errors.mobile = "A valid 10-digit Indian mobile number is required.";
  if (typeof form.password !== "string" || form.password.length < 8)
    errors.password = "Password must be at least 8 characters.";
  return Object.keys(errors).length ? validationError(errors) : null;
};

const validateRegistrationForm = (form, role) => {
  const errors = {};
  if (!mobilePattern.test(form.mobile))
    errors.mobile = "A valid 10-digit Indian mobile number is required.";
  if (form.password.length < 8)
    errors.password = "Password must be at least 8 characters.";
  if (form.password !== form.confirmPassword)
    errors.confirmPassword = "Passwords do not match.";
  return Object.keys(errors).length ? validationError(errors) : null;
};
```

From `client/src/services/api.js`:

```js
let accessToken = localStorage.getItem("sukh_breeze_access_token");

export const setAccessToken = (token) => {
  accessToken = token;
  if (token) localStorage.setItem("sukh_breeze_access_token", token);
  else localStorage.removeItem("sukh_breeze_access_token");
};
```

From `client/src/context/AuthContext.jsx`:

```js
const token = localStorage.getItem("sukh_breeze_access_token");
if (!token) {
  setLoading(false);
  return undefined;
}
api.get("/auth/me")
```

Therefore the implementation is not memory-only. Refresh does use the
HTTP-only cookie in the Axios 401 interceptor:

```js
axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true })
```

## Git command output

Command:

```text
git status --short --branch
git log --oneline -10
git tag
git remote -v
```

Actual output:

```text
## main
ce389c0 Merge remote-tracking branch 'origin/main'
1d6f897 Update project
4af38ec Initial commit
origin  https://github.com/bairwadheeraj492-tech/subhbreez-main.git (fetch)
origin  https://github.com/bairwadheeraj492-tech/subhbreez-main.git (push)
```

`git tag` produced no output.

The prior push attempt was not successful:

```text
remote: Permission to bairwadheeraj492-tech/subhbreez-main.git denied to dheerajbeniwal.
fatal: unable to access 'https://github.com/bairwadheeraj492-tech/subhbreez-main.git/': The requested URL returned error: 403
PUSH_EXIT=128
```

## Environment command output

The inspection intentionally printed only configuration status, not secrets:

```text
MONGODB_URI=<no database name detected>
RAZORPAY_KEY_ID=empty
RAZORPAY_KEY_SECRET=empty
RAZORPAY_WEBHOOK_SECRET=empty
```

## Browser Local Storage output

At `http://127.0.0.1:5173/`, the browser runtime check returned:

```json
{"localStorage":{},"sessionStorage":{},"cookies":""}
```

This was a fresh unauthenticated browser context. It does not override the
source-code evidence that login persists the access token in Local Storage.

## General health-check command output

### Client lint

Command: `cd client; npm run lint`

```text
> sukh-breeze-client@0.0.0 lint
> eslint .
```

Exit status: 0.

### Server lint

Command: `cd server; npm run lint`

```text
> sukh-breeze-server@1.0.0 lint
> eslint src
```

Exit status: 0.

### Backend unit tests

Command: `cd server; npm test`

```text
> sukh-breeze-server@1.0.0 test
> node --test test/unit.test.js

▶ Booking pricing — server-authoritative startingCharge guard
  ✔ accepts a positive startingCharge
  ✔ accepts a fractional positive startingCharge
  ✔ rejects zero with statusCode 409
  ✔ rejects negative value
  ✔ rejects undefined
  ✔ rejects null
  ✔ booking amount snapshot equals provider startingCharge
✔ Booking pricing — server-authoritative startingCharge guard
▶ Booking state machine
  ✔ allows pending → accepted
  ✔ allows pending → rejected
  ✔ allows pending → cancelled
  ✔ allows accepted → in_progress
  ✔ allows accepted → cancelled
  ✔ allows in_progress → completed
  ✔ blocks pending → in_progress
  ✔ blocks pending → completed
  ✔ blocks accepted → completed
  ✔ blocks accepted → rejected
  ✔ blocks in_progress → pending
  ✔ blocks in_progress → accepted
  ✔ blocks in_progress → cancelled
  ✔ blocks rejected → pending
  ✔ blocks completed → pending
  ✔ blocks completed → cancelled
  ✔ blocks cancelled → pending
  ✔ blocks cancelled → accepted
  ✔ terminal states have no outbound transitions
✔ Booking state machine
▶ Commission calculation
  ✔ 10% of 1000 → commission=100, payable=900
  ✔ 15% of 2000 → commission=300, payable=1700
  ✔ rounds to 2 decimal places
  ✔ commission + payable = amount (all cases)
  ✔ 0% commission: full amount to provider
  ✔ 100% commission: zero to provider
  ✔ toPaise rounds correctly
✔ Commission calculation
▶ Review eligibility rules
  ✔ accepts completed owned booking with provider
  ✔ rejects null booking
  ✔ rejects wrong owner
  ✔ rejects pending booking
  ✔ rejects accepted booking
  ✔ rejects no provider
  ✔ providerId comes from booking, not payload
✔ Review eligibility rules
▶ Notification — non-blocking on persistence failure
  ✔ resolves the notification on success
  ✔ returns null (does not throw) on generic error
  ✔ returns null (does not throw) on 11000 duplicate
  ✔ first call succeeds, second duplicate silently returns null
✔ Notification — non-blocking on persistence failure
▶ Provider validator — startingCharge > 0 (post-fix)
  ✔ accepts 1
  ✔ accepts 500
  ✔ accepts 0.01
  ✔ accepts 999999
  ✔ rejects 0
  ✔ rejects -1
  ✔ rejects -0.001
  ✔ rejects NaN
  ✔ rejects Infinity
  ✔ rejects null
  ✔ rejects string '500'
✔ Provider validator — startingCharge > 0 (post-fix)
▶ bookingId generation
  ✔ matches SB-YYYYMMDD-NNNNNN format
  ✔ starts with SB-
  ✔ suffix is in [100000, 999999]
  ✔ generates mostly-unique IDs across 1000 calls
✔ bookingId generation
ℹ tests 59
ℹ suites 7
ℹ pass 59
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Exit status: 0. The test run reported 59 passing tests and 0 failures.

### Backend integration tests

Command: `cd server; npm run test:integration`

```text
> sukh-breeze-server@1.0.0 test:integration
> node --test --test-timeout=120000 test/stabilization.integration.test.js

◇ injected env (15) from .env
GET /api/health 200
▶ SUKH BREEZE database-backed stabilization
  ✔ connects to MongoDB and serves health
POST /api/v1/auth/register/customer 201
POST /api/v1/auth/register/customer 201
POST /api/v1/auth/register/provider 201
POST /api/v1/auth/login 403
POST /api/v1/auth/login 200
POST /api/v1/auth/login 200
POST /api/v1/auth/login 200
POST /api/v1/auth/admin/login 200
GET /api/v1/auth/me 200
GET /api/v1/bookings/provider/requests 403
GET /api/v1/payments/admin 403
  ✔ registers users and enforces authz
POST /api/v1/bookings 201
POST /api/v1/bookings 400
GET /api/v1/bookings/:id 404
GET /api/v1/bookings/:id 200
  ✔ creates a server-priced booking and rejects client amount
PATCH /api/v1/bookings/:id/complete 409
PATCH /api/v1/bookings/:id/accept 200
PATCH /api/v1/bookings/:id/start 200
PATCH /api/v1/bookings/:id/complete 200
PATCH /api/v1/bookings/:id/cancel 409
POST /api/v1/bookings 201
PATCH /api/v1/bookings/:id/cancel 200
  ✔ enforces booking transitions
POST /api/v1/bookings 201
PATCH /api/v1/bookings/:id/accept 200
PATCH /api/v1/bookings/:id/start 200
PATCH /api/v1/bookings/:id/complete 200
POST /api/v1/payments/create-order 503
POST /api/v1/payments/cash/received 200
POST /api/v1/payments/cash/received 200
POST /api/v1/payments/create-order 409
PATCH /api/v1/payments/admin/:id/verify 200
PATCH /api/v1/payments/admin/:id/verify 409
PATCH /api/v1/payments/admin/:id/settle 200
PATCH /api/v1/payments/admin/:id/settle 409
  ✔ covers payment, cash/online conflict, commission, and settlement
POST /api/v1/bookings 201
PATCH /api/v1/bookings/:id/accept 200
PATCH /api/v1/bookings/:id/start 200
PATCH /api/v1/bookings/:id/complete 200
POST /api/v1/payments/webhook/razorpay 503
  ✔ binds Razorpay webhooks to stored gateway identifiers
POST /api/v1/reviews 404
POST /api/v1/bookings 201
POST /api/v1/reviews 404
POST /api/v1/reviews 201
POST /api/v1/reviews 409
DELETE /api/v1/reviews/admin/:id 200
  ✔ enforces review rules and rating recalculation
GET /api/v1/notifications 200
GET /api/v1/notifications/unread-count 200
PATCH /api/v1/notifications/:id/read 404
PATCH /api/v1/notifications/:id/read 200
  ✔ protects notifications and deduplicates events
ℹ tests 8
ℹ suites 1
ℹ pass 8
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
```

Exit status: 0. The integration run reported 8 passing tests and 0 failures.

### Client build

Command: `cd client; npm run build`

```text
> sukh-breeze-client@0.0.0 build
> vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 87 modules transformed.
[lightningcss minify] Unknown at rule: @theme
[lightningcss minify] Unknown at rule: @theme
[lightningcss minify] Unknown at rule: @tailwind
rendering chunks...
computing gzip size...
dist/index.html                   0.45 kB │ gzip: 0.29 kB
dist/assets/index-BwPwmPJk.css   32.13 kB │ gzip: 8.81 kB
dist/assets/index-Cak_ryc6.js   307.81 kB │ gzip: 99.28 kB

✓ built in 3.39s
```

Exit status: 0. The build completed with CSS at-rule warnings.

## Anything that changed since the last known state that wasn't asked for

Observable repository-state changes relative to the earlier project inspection:

- A project-local `.git` directory now exists, separate from the parent
  `C:\Users\dheer` repository.
- The project has local commits `1d6f897` (`Update project`) and `ce389c0`
  (merge of the remote initial commit).
- The requested GitHub remote is configured as `origin`.
- A normal push was attempted but was rejected by GitHub with HTTP 403 because
  the authenticated account `dheerajbeniwal` does not have permission to push
  to `bairwadheeraj492-tech/subhbreez-main`.
- No application source files were changed during this status inspection.
