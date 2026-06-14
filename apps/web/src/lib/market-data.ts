/**
 * Application market-data layer.
 *
 * Wraps the provider implementations from `@tradepilot/marketdata` with:
 *  - Redis caching (fail-open) to respect provider rate limits
 *  - provider selection: DB override → MARKET_DATA_PROVIDER env → "auto"
 *  - asset-class routing in "auto" mode (crypto→Binance, fx→AlphaVantage, equity→Polygon)
 *
 * Auth/dashboard/strategy/alert code is untouched; the signal engine consumes
 * `getBars` from here instead of the old synthetic feed.
 */
import { prisma } from '@tradepilot/db';
import {
  allProviders,
  getProviderByName,
  inferAssetClass,
  isProviderMode,
  providerForAssetClass,
  type Bar,
  type InstrumentInfo,
  type MarketDataProvider,
  type ProviderHealth,
  type ProviderMode,
  type ProviderName,
  type Quote,
  type Timeframe,
} from '@tradepilot/marketdata';
import { cached } from './redis';

const FLAG_KEY = 'market_data_provider';

/** Resolve the configured provider mode: DB flag → env → "auto". */
export async function getActiveMode(): Promise<ProviderMode> {
  try {
    const flag = await prisma.featureFlag.findUnique({ where: { key: FLAG_KEY } });
    const fromDb = (flag?.metadata as { mode?: string } | null)?.mode;
    if (fromDb && isProviderMode(fromDb)) return fromDb;
  } catch {
    /* fall through to env */
  }
  const fromEnv = process.env.MARKET_DATA_PROVIDER ?? 'auto';
  return isProviderMode(fromEnv) ? fromEnv : 'auto';
}

/** Persist the active provider mode (admin action). */
export async function setActiveMode(mode: ProviderMode): Promise<void> {
  await prisma.featureFlag.upsert({
    where: { key: FLAG_KEY },
    update: { metadata: { mode }, enabled: true },
    create: { key: FLAG_KEY, enabled: true, rollout: 100, metadata: { mode } },
  });
}

/** Choose the provider for a symbol given the active mode. */
async function pickProvider(symbol: string): Promise<MarketDataProvider> {
  const mode = await getActiveMode();
  if (mode !== 'auto') return getProviderByName(mode);
  return providerForAssetClass(inferAssetClass(symbol));
}

function barsTtl(timeframe: Timeframe): number {
  if (timeframe === 'W1') return 3600;
  if (timeframe === 'D1') return 900;
  return 60; // intraday
}

/** Historical OHLCV bars (cached), routed to the active provider. */
export async function getBars(symbol: string, timeframe: Timeframe, limit = 250): Promise<Bar[]> {
  const provider = await pickProvider(symbol);
  const key = `md:bars:${provider.name}:${symbol.toUpperCase()}:${timeframe}:${limit}`;
  return cached(key, barsTtl(timeframe), () => provider.getBars(symbol, timeframe, limit));
}

/** Latest quote (cached briefly), routed to the active provider. */
export async function getQuote(symbol: string): Promise<Quote> {
  const provider = await pickProvider(symbol);
  const key = `md:quote:${provider.name}:${symbol.toUpperCase()}`;
  return cached(key, 15, () => provider.getQuote(symbol));
}

/** Instruments for one provider (cached 1h). */
export async function getInstruments(name: ProviderName): Promise<InstrumentInfo[]> {
  return cached(`md:instruments:${name}`, 3600, () => getProviderByName(name).getInstruments());
}

export interface ProviderStatus {
  name: ProviderName;
  assetClasses: string[];
  configured: boolean;
  active: boolean;
}

/** Passive status (no network calls) for the admin page. */
export async function getProviderStatuses(): Promise<{ mode: ProviderMode; providers: ProviderStatus[] }> {
  const mode = await getActiveMode();
  const providers = allProviders().map((p) => ({
    name: p.name,
    assetClasses: p.assetClasses,
    configured: p.isConfigured(),
    active: mode === 'auto' ? true : mode === p.name,
  }));
  return { mode, providers };
}

/** Live health check for one provider (makes a real API call). */
export async function runHealthCheck(name: ProviderName): Promise<ProviderHealth> {
  return getProviderByName(name).health();
}

/** Live health for all providers (used sparingly — costs real API calls). */
export async function runAllHealthChecks(): Promise<ProviderHealth[]> {
  return Promise.all(allProviders().map((p) => p.health()));
}
