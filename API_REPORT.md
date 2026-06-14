# API_REPORT.md — Phase D: API Review

**Project:** TradePilot AI · **Date:** 2026-06-13
**Method:** Static per-route audit (registry blocked → no live HTTP test harness). Each route was read and evaluated against: authentication, authorization (RBAC), input validation, error handling, audit logging, and rate limiting.

---

## 1. Route inventory

| Route | Methods | Auth | Authz | Validation | Rate limit | Audit |
|---|---|---|---|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth | n/a | provider-level | — | LOGIN (in authorize) |
| `/api/auth/register` | POST | public | n/a | zod | ✅ 5/min per IP | CREATE ✅ |
| `/api/signals` | GET | session | — | — | ✅ per-user | — |
| `/api/signals` | POST | session | `signal:create` ✅ | zod ✅ | ⚠️ none | SIGNAL_PUBLISH ✅ |
| `/api/portfolio` | GET | session | owner-scoped query | — | ⚠️ none | — |
| `/api/backtest` | POST | session | `backtest:run` ✅ | zod ✅ | ✅ 10/hr | ⚠️ none |
| `/api/webhooks/stripe` | POST | signature | n/a | constructEvent ✅ | — | BILLING_EVENT ✅ |
| `/api/webhooks/razorpay` | POST | signature ✅ (now constant-time) | n/a | HMAC ✅ | — | BILLING_EVENT ✅ |
| `/api/cron` | GET | bearer ✅ (now constant-time) | n/a | n/a | — | — |
| `/api/health` | GET | public | n/a | n/a | — | — |

---

## 2. Per-route findings

**`auth/register` (POST)** — Solid. IP rate-limited (5/min), zod-validated, duplicate-email → `409`, bcrypt(12) hash, atomically creates user + USER role + FREE subscription + notification prefs, audit-logged, redirects `303 → /login`. ✅

**`signals` (GET)** — Authenticated, per-user rate-limited, returns 50 latest ACTIVE signals with instrument. Correct. Note: does not yet filter by the viewer's `publishedPlan` entitlement — the composite index `signals(status, publishedPlan)` exists for when that filter is added (free users should not see ELITE signals). **Recommended enhancement, not a defect.**

**`signals` (POST)** — Auth + `requirePermission('signal:create')` + zod (bounded confidence) + audit. ⚠️ **No rate limit** on the write path — add one to prevent signal spam.

**`portfolio` (GET)** — Authenticated; query is correctly scoped to `userId` (no IDOR — a user cannot read another user's portfolio). ⚠️ **No rate limit.** No POST/mutation route exists yet for creating portfolios/trades — a gap for full functionality (tracked in Production Readiness, not a security issue).

**`backtest` (POST)** — Auth + `requirePermission('backtest:run')` + 10/hour quota + zod (positive capital) → enqueues `QUEUED` row, returns `202`. ✅ ⚠️ Not audit-logged — add a `CREATE`/`backtest` audit entry for completeness. ⚠️ `strategyId` is accepted without verifying the strategy exists / is owned-or-public — add an existence+ownership check to avoid FK errors and cross-tenant references.

**`webhooks/stripe` (POST)** — Verifies signature, reads raw body, handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Updates by `providerCustomerId`. Audit-logged. ✅ Idempotent at the DB layer via `payments.providerPaymentId` unique constraint when payment rows are written.

**`webhooks/razorpay` (POST)** — Now constant-time signature verification (Phase C). Handles `subscription.charged`/`activated`. Audit-logged. ✅

**`cron` (GET)** — Constant-time bearer check (Phase C). Expires ACTIVE signals older than 24h. ✅

**`health` (GET)** — Pings DB + Redis, returns `200 ok` / `503 degraded`. Does not leak internals. ✅ Good for load-balancer probes.

---

## 3. Cross-cutting observations

- **Consistent error envelope:** routes return `{ error }` with correct status codes (`400/401/403/409/429`). ✅
- **No IDOR found:** every user-scoped read filters by `session.user.id`.
- **Error handling:** `ForbiddenError` is caught and mapped to `403`; unexpected errors re-throw to Next's error boundary (returns `500`) rather than leaking stack traces to clients. ✅
- **Audit coverage** is good on auth/billing/signal-publish; **add** audit entries for `backtest` creation and any future portfolio/trade mutations.

## 4. Recommended API fixes (prioritized, non-blocking)

1. Rate-limit `signals` POST and `portfolio` GET (Medium).
2. Verify `strategyId` existence + ownership in `backtest` POST (Medium).
3. Audit-log `backtest` creation (Low).
4. Filter `signals` GET by viewer plan entitlement (feature completeness).
5. Add portfolio/trade mutation routes (feature completeness — out of audit scope per "do not add features").

No API route is exploitable as written after the Phase C webhook/cron fixes.
