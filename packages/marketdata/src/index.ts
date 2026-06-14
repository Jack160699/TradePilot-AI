export * from './types';
export { HttpError, RateLimitError, fetchJson } from './http';
export {
  canonical,
  inferAssetClass,
  splitFxPair,
  TIMEFRAME_MS,
  BINANCE_INTERVAL,
  POLYGON_AGG,
  alphaVantageFxParams,
} from './symbols';
export { BinanceProvider } from './binance';
export { AlphaVantageProvider } from './alphavantage';
export { PolygonProvider } from './polygon';

import { BinanceProvider } from './binance';
import { AlphaVantageProvider } from './alphavantage';
import { PolygonProvider } from './polygon';
import type { AssetClass, MarketDataProvider, ProviderName } from './types';

const REGISTRY: Record<ProviderName, MarketDataProvider> = {
  binance: new BinanceProvider(),
  alphavantage: new AlphaVantageProvider(),
  polygon: new PolygonProvider(),
};

/** All provider singletons. */
export function allProviders(): MarketDataProvider[] {
  return Object.values(REGISTRY);
}

/** Look up a provider by name. */
export function getProviderByName(name: ProviderName): MarketDataProvider {
  return REGISTRY[name];
}

export type ProviderMode = ProviderName | 'auto';

export function isProviderMode(value: string): value is ProviderMode {
  return value === 'auto' || value === 'binance' || value === 'alphavantage' || value === 'polygon';
}

/** Default asset-class → provider routing used in "auto" mode. */
const ASSET_ROUTE: Record<AssetClass, ProviderName> = {
  CRYPTO: 'binance',
  FOREX: 'alphavantage',
  COMMODITY: 'alphavantage',
  EQUITY: 'polygon',
  INDEX: 'polygon',
};

/** The provider that serves a given asset class in auto mode. */
export function providerForAssetClass(assetClass: AssetClass): MarketDataProvider {
  return REGISTRY[ASSET_ROUTE[assetClass]];
}
