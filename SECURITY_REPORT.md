# SECURITY_REPORT.md — Phase C: Security Review

**Project:** TradePilot AI · **Date:** 2026-06-13 · **Auditor:** Staff Engineer / Security Engineer

---

## 1. Executive summary

The authentication, RBAC, audit, and webhook layers are well structured. Phase C found **2 timing-side-channel issues** in signature/token comparison (both **fixed automatically**) and a set of **operational hardening recommendations** (secrets, 2FA enforcement, reconciliation) that are not code-blocking. No critical authentication-bypass or injection vulnerability was found.

| Severity | Count | Status |
|---|---|---|
| Critical | 0 | — |
| High | 1 (Edge-runtime auth crash, found in Phase A) | ✅ fixed |
| Medium | 2 (timing-unsafe comparisons) | ✅ fixed |
| Low / hardening | 5 | documented |

---

## 2. Findings & fixes

### 2.1 Authentication
- **JWT session strategy** (`session.strategy = 'jwt'`, 7-day maxAge). Roles are resolved **once at sign-in** in the Node `jwt` callback (`getUserRoles`) and carried in the token; the `session` callback re-exposes `id` + `roles`. ✅ Sound.
- **Credentials provider** uses `bcrypt.compare` (cost 12) and **rejects `BANNED`/`SUSPENDED`** users before issuing a session. ✅
- **Seeded admin** now stores a bcrypt hash (Phase A fix) so it can authenticate — previously a sha256 hash made admin login impossible. ✅
- ⚠️ **Hardening:** `twoFactorEnabled`/`twoFactorSecret` columns exist but no TOTP enforcement path is wired. For an admin panel controlling billing, enforce 2FA on `ADMIN` accounts before public launch (Low/operational).

### 2.2 Session & JWT security
- Tokens signed with `AUTH_SECRET` (NextAuth). Ensure it is a 32+ byte random value in production.
- `trustHost: true` is set — correct for Vercel/proxied deploys, but means `AUTH_URL` should be pinned in production to avoid host-header trust issues.
- No session data is persisted to `localStorage` (server-set httpOnly cookie via NextAuth). ✅

### 2.3 CSRF
- NextAuth provides built-in CSRF tokens for its credential/oauth POST flows. ✅
- State-changing API routes are authenticated via the session cookie **and** require either a permission check or a signed webhook/bearer secret, limiting CSRF blast radius. The `register` route is rate-limited and idempotent.
- ⚠️ **Hardening:** for any future browser-form POST that mutates state outside NextAuth, add an explicit CSRF token or require `SameSite=Lax`/`Strict` cookies (NextAuth default is `Lax`).

### 2.4 XSS
- No `dangerouslySetInnerHTML` in the audited surface; React auto-escapes output. ✅
- **CSP** added in `next.config.js`: `default-src 'self'`, scripts limited to self + TradingView, connections limited to self + OpenAI + Stripe, `frame-ancestors 'none'`. This is a meaningful XSS/clickjacking mitigation.
- ⚠️ Note: CSP includes `'unsafe-inline'` for scripts/styles (required by Next.js inline runtime + Tailwind). Tightening to nonces is a future improvement.

### 2.5 Input validation
- All mutating routes (`signals` POST, `backtest` POST, `auth/register`) validate input with **zod `safeParse`** and return `400` with a flattened error on failure. ✅
- `confidence` is bounded `0..1`; `initialCapital` must be positive. ✅

### 2.6 RBAC enforcement
- Central guard `requirePermission(userId, key)` throws `ForbiddenError` → `403`. Permissions are cached in Redis for 5 minutes (`rbac:perms:*`). ✅
- `admin:access` acts as a super-permission in `hasPermission`. ✅
- ⚠️ **Cache-invalidation gap (Low):** revoking a role does not proactively bust `rbac:perms:<userId>`; a revoked permission persists up to 5 minutes. Recommend deleting the cache key on any role/permission change. Documented for Phase E.

### 2.7 Admin routes
- `middleware.ts` (via `authConfig.authorized`) blocks `/admin/*` for non-authenticated users and **redirects non-`ADMIN` users to `/dashboard`**. ✅ Defense-in-depth: admin API handlers must still call `requirePermission(..., 'admin:access')` server-side (middleware alone is not authz).

### 2.8 Webhook verification
- **Stripe:** `stripe.webhooks.constructEvent` verifies the signature against `STRIPE_WEBHOOK_SECRET`; invalid → `400`. Raw body read via `req.text()` (correct — no JSON pre-parse). ✅
- **Razorpay (FIXED):** signature was compared with `expected === signature` (timing-unsafe, could leak the HMAC byte-by-byte). **Replaced** with `crypto.timingSafeEqual` + length guard + empty-secret/empty-sig rejection. ✅
- Both webhook handlers record a `BILLING_EVENT` audit entry. ✅

### 2.9 Cron / internal endpoint (FIXED)
- `/api/cron` bearer check used `auth !== \`Bearer ${CRON_SECRET}\`` (timing-unsafe). **Replaced** with a constant-time `timingSafeEqual` comparison that also rejects an empty secret. ✅

### 2.10 Rate limiting
- Redis fixed-window limiter (`lib/rate-limit.ts`) applied to: `signals` GET (per-user), `backtest` POST (10/hour), `auth/register` (5/min per IP). ✅
- ⚠️ **Gap (Low):** `portfolio` GET and the `signals` POST path are not rate-limited. Add a default per-user limit on all authenticated reads/writes. Documented for Phase D/E.

---

## 3. Security headers (added in `next.config.js`)

`X-Frame-Options: DENY` · `X-Content-Type-Options: nosniff` · `Referrer-Policy: strict-origin-when-cross-origin` · `Permissions-Policy: camera=(), microphone=(), geolocation=()` · `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` · `Content-Security-Policy` (see §2.4).

---

## 4. Secrets management

All secrets are read from environment variables (`STRIPE_*`, `RAZORPAY_*`, `AUTH_SECRET`, `CRON_SECRET`, `OPENAI_API_KEY`, `DATABASE_URL`, `REDIS_URL`). No secret is hardcoded in source. ✅
**Action for the user before launch:**
- Rotate the seed admin password (`ADMIN_SEED_PASSWORD`, default `ChangeMe!123` is a placeholder).
- Generate a strong `AUTH_SECRET` and `CRON_SECRET`.
- Set all webhook secrets to the values from the Stripe/Razorpay dashboards.

---

## 5. Fixes applied in Phase C

| # | File | Fix | Severity |
|---|---|---|---|
| 1 | `apps/web/src/lib/razorpay.ts` | Constant-time HMAC comparison (`timingSafeEqual`) + length/empty guards | Medium |
| 2 | `apps/web/src/app/api/cron/route.ts` | Constant-time bearer-token comparison | Medium |

(The Phase A Edge-runtime auth split and security headers also count as security hardening; see BUILD_REPORT.md.)

## 6. Outstanding (non-blocking) recommendations

1. Enforce 2FA for `ADMIN` accounts.
2. Bust `rbac:perms:<userId>` cache on role/permission change.
3. Rate-limit all authenticated routes by default.
4. Add a billing reconciliation job (missed-webhook recovery).
5. Move CSP toward nonce-based scripts to drop `'unsafe-inline'`.
