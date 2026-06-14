-- ═══════════════════════════════════════════════════════════════════════════
-- 0002_strategy_owner_alerts
-- Adds strategy ownership + scheduling fields and the Alerts subsystem.
-- ═══════════════════════════════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PRICE', 'SIGNAL', 'STRATEGY');
CREATE TYPE "AlertCondition" AS ENUM ('ABOVE', 'BELOW', 'CROSSES', 'ANY');
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'PAUSED', 'TRIGGERED');

-- AlterTable: strategies
ALTER TABLE "strategies"
    ADD COLUMN "userId" TEXT,
    ADD COLUMN "symbol" TEXT,
    ADD COLUMN "timeframe" "SignalTimeframe" NOT NULL DEFAULT 'H1',
    ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "lastRunAt" TIMESTAMP(3);

CREATE INDEX "strategies_userId_idx" ON "strategies"("userId");
CREATE INDEX "strategies_enabled_idx" ON "strategies"("enabled");

ALTER TABLE "strategies" ADD CONSTRAINT "strategies_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: alerts
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL DEFAULT 'PRICE',
    "symbol" TEXT NOT NULL,
    "condition" "AlertCondition" NOT NULL DEFAULT 'ABOVE',
    "threshold" DECIMAL(24,8),
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "lastTriggeredAt" TIMESTAMP(3),
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "alerts_userId_idx" ON "alerts"("userId");
CREATE INDEX "alerts_status_idx" ON "alerts"("status");
CREATE INDEX "alerts_symbol_idx" ON "alerts"("symbol");

ALTER TABLE "alerts" ADD CONSTRAINT "alerts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
