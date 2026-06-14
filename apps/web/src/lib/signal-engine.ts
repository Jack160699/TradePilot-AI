import { prisma } from '@tradepilot/db';
import type { AssetClass } from '@tradepilot/db';
import { evaluateStrategy, validateStrategyConfig, type StrategyConfig } from '@tradepilot/trading';
import type { Bar } from '@tradepilot/marketdata';
import { getBars } from './market-data';
import { recordAudit } from './audit';

export interface EngineResult {
  evaluated: number;
  generated: number;
  skipped: number;
  signals: string[];
}

/** Infer an asset class so signals can auto-create their instrument. */
function inferAssetClass(symbol: string): AssetClass {
  const s = symbol.toUpperCase();
  if (s.endsWith('USDT') || s.endsWith('USDC') || s.endsWith('BTC')) return 'CRYPTO';
  if (/^(EUR|GBP|USD|JPY|AUD|NZD|CHF|CAD)[A-Z]{3}$/.test(s)) return 'FOREX';
  if (s.startsWith('XAU') || s.startsWith('XAG') || s.endsWith('OIL')) return 'COMMODITY';
  return 'EQUITY';
}

async function ensureInstrument(symbol: string): Promise<string> {
  const sym = symbol.toUpperCase();
  const existing = await prisma.instrument.findUnique({ where: { symbol: sym } });
  if (existing) return existing.id;
  const created = await prisma.instrument.create({
    data: { symbol: sym, name: sym, assetClass: inferAssetClass(sym) },
  });
  return created.id;
}

/**
 * Evaluate enabled strategies against fresh bars and persist any generated
 * signals. Dedupes by (instrument + strategy + direction) within a 6h window so
 * repeated worker runs don't spam identical signals.
 *
 * @param scope.userId  restrict to one user's strategies (dashboard "Run now")
 * @param scope.limit   cap strategies processed per run (worker safety)
 */
export async function runSignalEngine(scope: { userId?: string; limit?: number } = {}): Promise<EngineResult> {
  const strategies = await prisma.strategy.findMany({
    where: { enabled: true, ...(scope.userId ? { userId: scope.userId } : {}) },
    take: scope.limit ?? 200,
  });

  const result: EngineResult = { evaluated: 0, generated: 0, skipped: 0, signals: [] };
  const dedupeSince = new Date(Date.now() - 6 * 60 * 60 * 1000);
  // Reuse fetched bars across strategies that share a symbol+timeframe within
  // this run, on top of the Redis cache, to minimize provider API calls.
  const barsCache = new Map<string, Bar[]>();

  for (const strategy of strategies) {
    result.evaluated++;
    const validated = validateStrategyConfig(strategy.config);
    if (!validated.ok) {
      result.skipped++;
      continue;
    }
    const config: StrategyConfig = validated.config;

    const symbol = (strategy.symbol ?? 'BTCUSDT').toUpperCase();
    const timeframe = strategy.timeframe;
    await prisma.strategy.update({ where: { id: strategy.id }, data: { lastRunAt: new Date() } });

    const cacheKey = `${symbol}:${timeframe}`;
    let bars = barsCache.get(cacheKey);
    if (!bars) {
      try {
        bars = await getBars(symbol, timeframe, 250);
        barsCache.set(cacheKey, bars);
      } catch (err) {
        // Provider unconfigured/unavailable for this symbol — skip, never fake data.
        console.error(`[engine] market data unavailable for ${symbol} ${timeframe}:`, err);
        result.skipped++;
        continue;
      }
    }
    if (bars.length < 30) {
      result.skipped++;
      continue;
    }

    const gen = evaluateStrategy(bars, config);
    if (!gen) continue;

    const instrumentId = await ensureInstrument(symbol);

    const dup = await prisma.signal.findFirst({
      where: {
        instrumentId,
        direction: gen.direction,
        model: strategy.name,
        status: 'ACTIVE',
        createdAt: { gte: dedupeSince },
      },
    });
    if (dup) continue;

    const signal = await prisma.signal.create({
      data: {
        instrumentId,
        authorId: strategy.userId,
        direction: gen.direction,
        timeframe,
        status: 'ACTIVE',
        entryPrice: gen.entryPrice,
        stopLoss: gen.stopLoss,
        takeProfit: gen.takeProfit,
        confidence: gen.confidence,
        riskReward: gen.riskReward,
        rationale: gen.rationale,
        model: strategy.name,
        indicators: { ...gen.indicators, strategyId: strategy.id, source: 'strategy-engine' },
        publishedPlan: 'FREE',
      },
    });
    result.generated++;
    result.signals.push(signal.id);
  }

  await recordAudit({
    userId: scope.userId ?? null,
    action: 'SIGNAL_PUBLISH',
    resource: 'signal-engine',
    metadata: { evaluated: result.evaluated, generated: result.generated, skipped: result.skipped },
  });
  return result;
}
