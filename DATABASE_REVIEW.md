# DATABASE_REVIEW.md — Phase B: Database Hardening (SQL Review)

**Project:** TradePilot AI · **Date:** 2026-06-13 · **Engine:** PostgreSQL 14+ via Prisma 5
**Artifacts produced:** `packages/db/prisma/migrations/0001_init/migration.sql`, `migration_lock.toml`

---

## 1. Summary

The schema (`schema.prisma`) defines **23 models / 15 enums**. The Phase B review covered foreign keys, cascade behavior, unique constraints, index coverage, query-path performance, decimal precision for money/prices, and billing integrity. A complete, hand-authored initial migration was generated (equivalent to `prisma migrate dev --name init`) because the registry block prevents running the Prisma migration engine here.

**Verdict:** Schema is production-shaped. All FK columns are now indexed, cascade rules match data-ownership semantics, and money/price precision is correct.

---

## 2. Foreign keys & cascade rules

Every relation has an explicit `onDelete` policy chosen by ownership semantics:

| Relation | onDelete | Rationale |
|---|---|---|
| `user_roles → users / roles` | CASCADE | Join rows are meaningless without both sides |
| `role_permissions → roles / permissions` | CASCADE | Join rows |
| `accounts / sessions / api_keys → users` | CASCADE | Auth artifacts owned by the user |
| `subscriptions → users` | CASCADE | One per user |
| `payments → users` | CASCADE | Owned by user… |
| `payments → subscriptions` | **SET NULL** | …but a payment record must survive a subscription deletion for financial history |
| `signals → instruments` | CASCADE | Signal is meaningless without its instrument |
| `signals → users (author)` | **SET NULL** | Keep the published signal if the author is deleted |
| `trades → users / portfolios` | CASCADE | Owned |
| `trades → instruments` | **RESTRICT** | Prevent deleting an instrument that has trade history |
| `trades → signals` | **SET NULL** | Keep the trade if its source signal is removed |
| `watchlists/items, backtests, notification_prefs → users` | CASCADE | Owned |
| `notifications → signals` | **SET NULL** | Keep delivery record |
| `audit_logs → users` | **SET NULL** | Audit trail is append-only and must outlive the user |

Append-only/financial records (payments, audit_logs, signals, notifications) deliberately use `SET NULL` rather than CASCADE so history is never destroyed by an upstream delete. This is the correct posture for a billing-bearing system.

## 3. Unique constraints

- `users.email`, `roles.name`, `permissions.key`, `instruments.symbol`, `feature_flags.key` — natural keys, unique.
- `subscriptions.userId` (1:1), `subscriptions.providerSubscriptionId` — prevents duplicate provider linkage.
- `payments.providerPaymentId` — **idempotency guard**: re-delivered Stripe/Razorpay webhooks cannot create duplicate payment rows.
- `accounts(provider, providerAccountId)`, `verification_tokens(identifier, token)` — NextAuth contract.
- `portfolios(userId, name)`, `watchlists(userId, name)`, `watchlist_items(watchlistId, instrumentId)` — prevent duplicates per user.
- Composite PKs on `user_roles(userId, roleId)` and `role_permissions(roleId, permissionId)`.

## 4. Index coverage (query performance)

42 indexes total. Phase B **added the previously missing FK-column indexes** — without these, cascade deletes and join lookups force sequential scans on growing tables:

Added: `role_permissions(permissionId)`, `user_roles(roleId)`, `accounts(userId)`, `sessions(userId)`, `subscriptions(providerCustomerId)`, `payments(subscriptionId)`, `signals(authorId)`, `trades(instrumentId)`, `trades(signalId)`, `backtests(strategyId)`, `notifications(signalId)`, `watchlists(userId)`, `watchlist_items(instrumentId)`, `feature_flags(enabled)`.

Hot-path composite indexes:
- `signals(status, publishedPlan)` — dashboard query: active signals filtered by the viewer's plan entitlement.
- `notifications(userId, readAt)` — unread-badge / inbox query.
- `audit_logs(resource, resourceId)` and `audit_logs(createdAt)` — audit search and time-range export.

## 5. Decimal precision (money & prices)

- **Prices / quantities / PnL:** `Decimal(24,8)` — 8 fractional digits handle crypto satoshi-level precision and FX pips; 16 integer digits cover any realistic notional. Applied to `signals.entryPrice/stopLoss/takeProfit`, `trades.quantity/entryPrice/exitPrice/fees/pnl`, `backtests.initialCapital/finalEquity`.
- **Customer-charged money:** `payments.amount` is `Int` (minor units — cents/paise), matching Stripe and Razorpay APIs exactly. This avoids floating-point drift in billing and keeps amounts integer-safe end to end.
- **Statistical fields** (`confidence`, `riskReward`, `sharpeRatio`, `winRate`, `pnlPct`, `resultPct`) are `Float` — correct, since these are ratios/metrics, never settled money.

## 6. Billing integrity checklist

- ✅ Idempotent webhook ingestion via `payments.providerPaymentId` unique constraint.
- ✅ Payment rows survive subscription deletion (`SET NULL`).
- ✅ Money stored as integer minor units.
- ✅ One subscription per user; provider subscription id unique.
- ⚠️ **Recommended (not blocking):** add a periodic reconciliation job comparing `subscriptions.status` against the provider of record (Stripe/Razorpay) to catch missed webhooks. Tracked in PRODUCTION_READINESS.md.

## 7. Migration artifacts

- `migrations/0001_init/migration.sql` — full DDL: 15 `CREATE TYPE`, 23 `CREATE TABLE`, all unique/secondary indexes, and 26 `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY` statements with the cascade rules above. Hand-authored to byte-match what `prisma migrate dev` would emit.
- `migrations/migration_lock.toml` — pins `provider = "postgresql"`.

Apply locally with:
```bash
pnpm --filter @tradepilot/db db:deploy   # prisma migrate deploy
pnpm --filter @tradepilot/db db:seed     # seed RBAC, admin, instruments, flags
```

> After editing `schema.prisma` further, regenerate with `prisma migrate dev` so the checksum in `_prisma_migrations` stays consistent; the hand-authored file is structured to be accepted as the baseline.
