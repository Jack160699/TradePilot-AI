# Infrastructure Notes

Recommended production topology:

- **Compute**: Vercel (Next.js standalone) or a container platform (ECS/Fly/K8s)
  using the root `Dockerfile`.
- **Database**: managed PostgreSQL 16 (Neon, Supabase, or RDS). Set both
  `DATABASE_URL` (pooled) and `DIRECT_URL` (direct, for migrations).
- **Cache**: managed Redis (Upstash for serverless, ElastiCache otherwise).
- **Secrets**: store env vars in the platform secret manager — never commit `.env`.
- **Cron**: Vercel Cron hits `/api/cron` every 15 min (guarded by `CRON_SECRET`).
- **Backups**: enable PITR on Postgres; audit logs are append-only and retained.

This folder is the home for future IaC (Terraform/Pulumi) modules.
