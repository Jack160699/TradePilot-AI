# BUILD_REPORT.md — Phase A: Build Verification

**Project:** TradePilot AI
**Audit date:** 2026-06-13
**Auditor role:** Staff Engineer (production-readiness audit)
**Scope:** Static build verification of the Turborepo monorepo (`apps/web` + 7 workspace packages).

---

## 0. Environment caveat (read first)

The audit sandbox has the **npm/pnpm registry network-blocked** (`registry.npmjs.org` returns `403 Forbidden`). As a direct consequence, the following commands **cannot be executed in this environment**:

- `pnpm install`
- `prisma generate` (downloads the query-engine binary)
- `prisma migrate deploy` / `prisma migrate dev`
- `tsc --noEmit` (typecheck) — requires installed `node_modules`
- `eslint` (lint) — requires installed plugins
- `next build` — requires the full dependency graph + generated Prisma client
- `vitest` (tests) — requires installed runner

Phase A was therefore executed as a **rigorous static audit**: every source file was read; imports, types, and config were traced by hand against the declared dependency versions; and every defect found was fixed in place. **Runtime verification must be re-run locally by the user** (commands in §6). This report flags, honestly, what was statically verified vs. what still requires a live build.

---

## 1. Build status summary

| Check | Static result | Requires local run |
|---|---|---|
| Dependency manifests (package.json × 8) | ✅ consistent | install |
| Prisma schema validity | ✅ 23 models / 15 enums / 40 braces balanced | `prisma validate` |
| Prisma client import surface | ✅ all imports resolve to declared exports | `prisma generate` |
| TypeScript (types/imports traced) | ✅ no unresolved symbols found | `tsc --noEmit` |
| NextAuth Edge compatibility | ✅ fixed (split-config) | `next build` |
| Next.js standalone/monorepo config | ✅ fixed (`outputFileTracingRoot`) | `next build` |
| Lint (manual pass) | ✅ no obvious violations | `eslint` |
| Unit tests | ⚠️ present but unrun | `vitest` |
| Production build | ⚠️ unrun (registry blocked) | `next build` |

**Overall Phase A verdict:** No compile-blocking defects remain in source. Build cannot be *proven* green until the user runs it with registry access, but every statically detectable blocker has been removed.

---

## 2. TypeScript errors found

No unresolved-symbol or type errors were found by static tracing after fixes. Specific items checked and cleared:

- All `@tradepilot/*` workspace imports resolve to a real `main`/`exports` entry in the target package's `package.json`.
- `@/lib/*` path alias maps to `apps/web/src/lib/*` (verified against `tsconfig.json` `paths`).
- Prisma-generated types (`AuditAction`, `Prisma`, `SubscriptionPlan`, etc.) are imported only from `@tradepilot/db`, which re-exports `@prisma/client`.
- `lib/stripe.ts` previously pinned an `apiVersion` string literal that mismatches the SDK's pinned union type → **removed** (kept `typescript: true`); the SDK now uses its own default, eliminating a literal-type error on upgrade.

## 3. Missing imports / missing packages

None outstanding. During the audit one true gap was closed:

- `packages/db/prisma/seed.ts` used `bcrypt.hash(...)` but **`bcryptjs` was not a dependency** of `packages/db`. Added `bcryptjs ^2.4.3` and `@types/bcryptjs ^2.4.6` to `packages/db` devDependencies.

All other runtime imports (`ioredis`, `stripe`, `razorpay`, `openai`, `zod`, `next-auth`, `@auth/prisma-adapter`, `bcryptjs`) are present in `apps/web/package.json`.

## 4. Runtime errors (static reasoning)

- **NextAuth + Edge middleware (CRITICAL — fixed).** `middleware.ts` previously imported the full `auth.ts`, which transitively pulls in Prisma, bcrypt, and ioredis — none of which run on the Edge runtime. This would have crashed the middleware at request time. **Fixed** with the split-config pattern: an Edge-safe `lib/auth.config.ts` (no Node imports, holds the `authorized` route-protection callback) consumed by `middleware.ts`, and a Node-runtime `lib/auth.ts` that spreads `authConfig` and adds the Prisma adapter, providers, and the DB-querying `jwt` callback.
- **Health check** correctly degrades (503) rather than throwing if DB/Redis are unreachable.
- **Audit logging** is wrapped in try/catch and never throws into the request path.

## 5. Prisma / Next.js specific issues

- **Standalone monorepo tracing (fixed).** `next.config.js` now sets `output: 'standalone'` and `outputFileTracingRoot: path.join(__dirname, '../../')` so workspace packages are traced into `.next/standalone` for the Docker image. Without this the container would miss `@tradepilot/*` files at runtime.
- **Prisma preview feature** `fullTextSearchPostgres` is declared; ensure the Postgres target supports it (standard on Postgres 12+).
- **`directUrl`** is configured for migration/connection-pooler separation (e.g. Supabase/PgBouncer). Both `DATABASE_URL` and `DIRECT_URL` must be set.

## 6. Security issues surfaced during build audit

Two were found and **auto-fixed** in Phase A (detailed in SECURITY_REPORT.md):

1. Razorpay webhook signature compared with `===` (timing-unsafe) → replaced with `crypto.timingSafeEqual` + length guard.
2. Cron bearer token compared with `!==` (timing-unsafe) → replaced with constant-time check.

Security headers (HSTS, CSP, X-Frame-Options, etc.) were added to `next.config.js`.

---

## 7. Fixes applied in Phase A

| # | File | Fix |
|---|---|---|
| 1 | `apps/web/src/lib/auth.config.ts` | **Created** Edge-safe NextAuth config with route-protection `authorized` callback |
| 2 | `apps/web/src/lib/auth.ts` | **Rewrote** to spread `authConfig` + Prisma adapter + Google/Credentials + Node `jwt` callback |
| 3 | `apps/web/src/middleware.ts` | **Rewrote** to consume only `authConfig` (no Node imports on Edge) |
| 4 | `apps/web/next.config.js` | Added `output: 'standalone'`, `outputFileTracingRoot`, full security-header set |
| 5 | `apps/web/src/lib/stripe.ts` | Removed pinned `apiVersion` literal (TS union mismatch) |
| 6 | `packages/db/prisma/seed.ts` | sha256 → `bcrypt.hash` so the seeded admin can log in via Credentials |
| 7 | `packages/db/package.json` | Added `bcryptjs` + `@types/bcryptjs` |
| 8 | `apps/web/src/lib/razorpay.ts` | Constant-time signature verification |
| 9 | `apps/web/src/app/api/cron/route.ts` | Constant-time bearer-token check |
| 10 | `packages/db/prisma/schema.prisma` | Hardening indexes on all FK columns + composite indexes (see DATABASE_REVIEW.md) |

---

## 8. Commands to verify locally (user must run with registry access)

```bash
pnpm install
pnpm --filter @tradepilot/db db:generate     # prisma generate
pnpm --filter @tradepilot/db db:deploy       # prisma migrate deploy
pnpm -w typecheck                            # tsc --noEmit across workspaces
pnpm -w lint                                 # eslint
pnpm -w test                                 # vitest
pnpm --filter web build                      # next build
```

A green run of all six confirms the build. Static analysis indicates these should pass; the only items that cannot be pre-verified here are runtime/test execution, which depend on installed binaries.
