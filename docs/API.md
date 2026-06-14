# API Architecture

All endpoints live under `apps/web/src/app/api` as Next.js Route Handlers.
Every mutating endpoint follows the same pipeline:

```mermaid
sequenceDiagram
  participant C as Client
  participant RH as Route Handler
  participant S as auth()
  participant R as RBAC
  participant RL as Redis RateLimit
  participant DB as Prisma
  participant A as Audit

  C->>RH: POST /api/signals
  RH->>S: validate session (JWT)
  S-->>RH: user or 401
  RH->>R: requirePermission(signal:create)
  R-->>RH: ok or 403
  RH->>RL: rateLimit(user)
  RL-->>RH: ok or 429
  RH->>RH: zod validate body (400 on fail)
  RH->>DB: create record
  RH->>A: recordAudit(...)
  RH-->>C: 201 { data }
```

## Endpoint Catalog

| Method | Path                     | Auth | Permission        | Purpose                          |
| ------ | ------------------------ | ---- | ----------------- | -------------------------------- |
| GET    | `/api/health`            | none | —                 | Liveness (db + redis)            |
| POST   | `/api/auth/register`     | none | — (IP rate-lim)   | Create account                   |
| *      | `/api/auth/[...nextauth]`| —    | —                 | NextAuth (login/oauth/session)   |
| GET    | `/api/signals`           | yes  | —                 | List active signals              |
| POST   | `/api/signals`           | yes  | `signal:create`   | Publish a signal                 |
| GET    | `/api/portfolio`         | yes  | —                 | List user portfolios + open pnl  |
| POST   | `/api/backtest`          | yes  | `backtest:run`    | Enqueue a backtest               |
| POST   | `/api/webhooks/stripe`   | sig  | —                 | Stripe subscription sync         |
| POST   | `/api/webhooks/razorpay` | sig  | —                 | Razorpay subscription sync       |
| GET    | `/api/cron`              | bearer| —                | Cron: expire signals, run AI     |

## Conventions

- **Validation**: zod schemas on every body; `400` returns `error.flatten()`.
- **Errors**: `401` unauthenticated, `403` forbidden, `429` rate-limited,
  `400` invalid, `409` conflict.
- **Rate limiting**: Redis fixed-window per user/IP, tunable via env.
- **Idempotency**: webhooks are signature-verified and safe to retry.
