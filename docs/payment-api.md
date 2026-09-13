# Payment, Commission, and Settlement API

Phase 6 supports Razorpay test/live integration, cash receipt reporting, server-side commission snapshots, and admin-recorded manual settlements. It does not implement automatic payouts, Razorpay Route, refunds, wallets, or card storage.

## Environment

Configure these server variables for online payment and webhook processing:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_TIMEOUT_MS` (optional, default `10000`)

Use Razorpay TEST credentials for development and separate LIVE credentials in production. Secrets never appear in API responses. Development can run without credentials; online order and webhook routes return a configuration error.

## Endpoints

Customer:

- `POST /api/v1/payments/create-order` with `{ "bookingId": "..." }`
- `POST /api/v1/payments/verify` with booking ID and Razorpay order/payment/signature values

Provider:

- `POST /api/v1/payments/cash/received` with `{ "bookingId": "..." }`

Admin:

- `GET /api/v1/payments/admin`
- `GET /api/v1/payments/admin/:id`
- `PATCH /api/v1/payments/admin/:id/verify`
- `GET /api/v1/payments/admin/commission`
- `PATCH /api/v1/payments/admin/commission` with `{ "commissionPercentage": 10 }`
- `GET /api/v1/payments/admin/settlements`
- `PATCH /api/v1/payments/admin/:id/settle` with `settlementReference` and optional notes

Webhook:

- `POST /api/v1/payments/webhook/razorpay`

The webhook does not use JWT. It verifies `x-razorpay-signature` against the exact raw request body using `RAZORPAY_WEBHOOK_SECRET`.

## Lifecycle

Online payment creates a Razorpay INR order using `Booking.amount` converted to paise. The customer verification endpoint checks booking ownership, local order identity, and the HMAC signature. Valid verification marks the local Payment `paid`, stores gateway references, snapshots commission, and synchronizes `Booking.paymentStatus`.

Razorpay `payment.captured` and `order.paid` events are looked up by stored `gatewayOrderId` (not booking notes). Payment events require the event payment id and reject a mismatched stored `gatewayPaymentId`. These paths are idempotent. `payment.failed` marks a pending payment failed only when identity matches. Repeated events do not recalculate or duplicate accounting.

Cash receipt is provider-reported only for the provider's own completed booking. It remains `pending` until an admin verifies it. Providers cannot verify payments or settle providers.

## Cash versus online payment policy

A booking has at most one Payment document (`bookingId` is unique). The first method that successfully creates that document wins.

- Online: customer `create-order` creates or reuses an `online` payment and attaches a Razorpay order. Repeated create-order calls return the same stored `gatewayOrderId`.
- Cash: provider `cash/received` creates a `cash` payment only when no Payment exists yet. Repeated cash reports for the same pending cash payment are idempotent.
- If an online payment already exists, cash reporting returns `409`. Gateway identifiers are never copied onto a cash record and are never cleared to switch methods.
- If a cash payment already exists, create-order returns `409`.
- Paid, verified, or settled payments cannot change method.
- Webhooks bind to the stored `gatewayOrderId`. Payment events also bind to `gatewayPaymentId` when one is already stored. Order events do not write an order ID into `gatewayPaymentId`.

## Commission and settlement

The commission setting is stored in `Settings` under `platform_commission_percentage`. Default is `10`, and only admins can change it. For each finalized payment:

```text
commissionAmount = amount * commissionPercentage / 100
providerPayableAmount = amount - commissionAmount
```

Values are rounded to two rupees decimals and stored on Payment. Existing commission snapshots are preserved when the setting changes later. Online payments may be `paid` before admin verification; cash payments move from `pending` to `verified` after admin verification. Verification does not mean the provider has been paid.

Manual settlement requires a verified payment and a non-empty settlement reference. It records `settledAt`, `settledByAdmin`, reference, notes, and changes `settlementStatus` to `settled`. Duplicate settlement is rejected.

## Security and limitations

Payment amount comes from the Booking, never the payment request. Commission and payable values are server-calculated. Passwords, JWTs, refresh tokens, Razorpay secrets, webhook secrets, and card data are never stored or returned. Payment status is independent from Booking service status. Automatic payouts, refunds, dynamic pricing, and gateway refund APIs are future work.
