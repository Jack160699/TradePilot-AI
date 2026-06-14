# TradePilot AI

Production-grade AI trading-signals SaaS. Turborepo monorepo — Next.js 15 (App
Router) · TypeScript · PostgreSQL + Prisma · Redis · OpenAI · Stripe + Razorpay ·
Telegram + WhatsApp alerts · full RBAC, audit logging, and admin panel.

## Quick start

```bash
pnpm install
cp .env.example .env                 # fill in secrets
docker compose up -d postgres redis  # local stateful services
pnpm db:generate && pnpm db:push && pnpm db:seed
pnpm dev                             # http://localhost:3000
```

Default admin (rotate immediately): `admin@tradepilot.ai`.

## Workspaces

| Package                     | Responsibility                              |
| --------------------------- | ------------------------------------------- |
| `apps/web`                  | Next.js UI + API + middleware               |
| `packages/config`           | env validation + plan limits                |
| `packages/db`               | Prisma schema, client, seed                 |
| `packages/ai`               | OpenAI signal engine                        |
| `packages/trading`          | indicators, risk math, backtester           |
| `packages/notifications`    | Telegram / WhatsApp dispatch                |
| `packages/analytics`        | performance metrics                         |
| `packages/ui`               | Shadcn-style component library              |

## Documentation

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) plus API, Auth, RBAC,
Data Model, and Deployment guides in `docs/`.

## Scripts

`pnpm build · dev · lint · typecheck · test · db:migrate · db:seed · db:studio`

## Deployment

Vercel (primary) via `vercel.json`, or self-host with the multi-stage `Dockerfile`
and `docker-compose.yml`. CI/CD in `.github/workflows/`.
