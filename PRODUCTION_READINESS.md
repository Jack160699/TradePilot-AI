# PRODUCTION_READINESS.md — Phase E

**Project:** TradePilot AI · **Date:** 2026-06-13 · **Auditor:** Staff Engineer

---

## 1. Readiness score

### **78 / 100 — "Conditionally ready: green static audit, pending one local build pass."**

The architecture, schema, auth, RBAC, billing, and security layers are production-shaped and all statically-detectable blockers have been fixed. The score is held below 90 by one hard gate that this environment **cannot** clear (a live `pnpm install && build && test` could not run because the npm registry is network-blocked here) plus a short list of operational items.

| Dimension | Score | Note |
|---|---|---|
| Architecture & structure | 9/10 | Clean Turborepo, 7 packages, separation of concerns |
| Database schema & migrations | 9/10 | Hardened, indexed, migration authored |
| Authentication & RBAC | 8/10 | Solid; 2FA enforcement + cache-bust pending |
| Security | 8/10 | Headers + signature fixes done; 2FA/CSP-nonce pending |
| API design | 7/10 | Authz/validation good; rate-limit + audit gaps |
| Build verifiability | 5/10 | Cannot prove green here (registry blocked) |
| Billing integrity | 8/10 | Idempotent; reconciliation job pending |
| Observability/DevOps | 8/10 | Health check, Docker, CI/CD, CodeQL present |

---

## 2. Critical blockers (must clear before launch)

1. **Run a clean local build with registry access.** This is the single gating item. Execute:
   ```bash
   pnpm install
   pnpm --filter @tradepilot/db db:generate
   pnpm -w typecheck && pnpm -w lint && pnpm -w test
   pnpm --filter web build
   ```
   Static analysis predicts all pass; this must be **confirmed**, not assumed.
2. **Provision real secrets.** Rotate `ADMIN_SEED_PASSWORD`, generate `AUTH_SECRET`/`CRON_SECRET`, set `STRIPE_WEBHOOK_SECRET` and `RAZORPAY_WEBHOOK_SECRET` from the dashboards. The app will not authenticate or verify webhooks correctly until these are set.
3. **Apply migrations against the production database** (`prisma migrate deploy`) and run the seed.

## 3. High-priority fixes (before or at launch)

1. Enforce 2FA on `ADMIN` accounts (schema columns already exist).
2. Bust `rbac:perms:<userId>` Redis cache on any role/permission change (currently up to 5-min stale).
3. Rate-limit `signals` POST and `portfolio` GET.
4. Verify `strategyId` existence + ownership in `backtest` POST.

## 4. Medium-priority fixes (first week post-launch)

1. Billing reconciliation cron (recover missed Stripe/Razorpay webhooks).
2. Audit-log `backtest` creation and future portfolio/trade mutations.
3. Filter `signals` GET by the viewer's plan entitlement.
4. Tighten CSP toward nonce-based scripts (drop `'unsafe-inline'`).
5. Add portfolio/trade mutation API routes for full Portfolio Tracker functionality.

## 5. Recommended launch sequence

1. **Local verification** — run the §2.1 command block; fix anything the live build surfaces.
2. **Provision infra** — Postgres (with `DIRECT_URL` pooler), Redis, set all env vars in Vercel.
3. **DB bring-up** — `prisma migrate deploy` → `db:seed`; confirm admin can log in; rotate admin password.
4. **Webhooks** — register Stripe + Razorpay webhook endpoints, paste signing secrets, send a test event, confirm `BILLING_EVENT` audit rows appear.
5. **Smoke test** — register a user, hit `/api/health` (expect `200`), create a signal as admin, run a backtest, verify rate limits return `429` past quota.
6. **Security pass** — enable 2FA for admins, confirm security headers via `curl -I`, verify `/admin` redirects non-admins.
7. **Go live** behind the CDN; watch the health endpoint and audit logs for the first 24h.
8. **Week 1** — land the Medium-priority list.

---

## 6. What was fixed during this audit

NextAuth Edge-runtime split-config (critical), seed admin bcrypt hash, standalone monorepo file tracing, Stripe apiVersion type mismatch, full security-header set, Razorpay constant-time signature verification, cron constant-time bearer check, 14 added database indexes, and a complete hand-authored initial migration. Details in BUILD_REPORT.md, DATABASE_REVIEW.md, SECURITY_REPORT.md, and API_REPORT.md.
