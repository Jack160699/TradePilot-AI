# Data Model & Relationships

PostgreSQL via Prisma. Full schema: `packages/db/prisma/schema.prisma`.

## Entity-Relationship Diagram

```mermaid
erDiagram
  User ||--o{ UserRole : has
  Role ||--o{ UserRole : grants
  Role ||--o{ RolePermission : includes
  Permission ||--o{ RolePermission : in
  User ||--o| Subscription : owns
  Subscription ||--o{ Payment : bills
  User ||--o{ Payment : pays
  User ||--o{ Portfolio : owns
  Portfolio ||--o{ Trade : contains
  User ||--o{ Trade : executes
  Instrument ||--o{ Trade : traded
  Instrument ||--o{ Signal : about
  User ||--o{ Signal : authors
  Signal ||--o{ Trade : drives
  Signal ||--o{ Notification : emits
  User ||--o{ Notification : receives
  User ||--o| NotificationPreference : configures
  User ||--o{ Backtest : runs
  Strategy ||--o{ Backtest : tested-by
  User ||--o{ Watchlist : owns
  Watchlist ||--o{ WatchlistItem : lists
  Instrument ||--o{ WatchlistItem : referenced
  User ||--o{ ApiKey : issues
  User ||--o{ AuditLog : actor
  User ||--o{ Account : oauth
  User ||--o{ Session : sessions
```

## Key Relationship Rules

- **RBAC** is modeled as many-to-many through `UserRole` and `RolePermission`
  join tables, so permissions are composable and roles are reusable.
- **Signal → Trade**: a signal may spawn many trades; deleting a signal sets
  `Trade.signalId` to null (`onDelete: SetNull`) to preserve trade history.
- **Instrument → Trade** uses `onDelete: Restrict` — you cannot delete an
  instrument that has trade history.
- **User cascade**: deleting a user cascades to sessions, accounts, portfolios,
  trades, backtests, notifications, api keys; audit logs are preserved
  (`SetNull`) for compliance.
- **Money** is stored in the smallest currency unit (`Int`), prices/quantities
  as `Decimal(24,8)` to avoid float drift.

## Indexing Strategy

Hot query paths are indexed: `User.email/status`, `Signal.status/createdAt/instrumentId`,
`Trade.userId/portfolioId/status`, `AuditLog.action/createdAt/resource`,
`Payment.userId/status`, `Subscription.status/plan`.
