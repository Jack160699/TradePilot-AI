/** Shared market-data domain types. */

export type Timeframe = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1' | 'W1';

export type AssetClass = 'CRYPTO' | 'EQUITY' | 'FOREX' | 'COMMODITY' | 'INDEX';

export type ProviderName = 'binance' | 'alphavantage' | 'polygon';

/** OHLCV bar — shape-compatible with @tradepilot/trading's Bar. */
export interface Bar {
  time: number; // epoch ms (bar open time)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  symbol: string;
  price: number;
  time: number; // epoch ms
}

export interface InstrumentInfo {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  exchange?: string;
}

export interface ProviderHealth {
  provider: ProviderName;
  configured: boolean;
  ok: boolean;
  latencyMs?: number;
  message?: string;
  checkedAt: number;
}

/**
 * Uniform interface every market-data source implements. Implementations are
 * responsible for symbol normalization, timeframe mapping, retry, and
 * rate-limit handling so callers can stay provider-agnostic.
 */
export interface MarketDataProvider {
  readonly name: ProviderName;
  /** Asset classes this provider can serve. */
  readonly assetClasses: AssetClass[];
  /** True when the required API key (if any) is present. */
  isConfigured(): boolean;
  /** Historical OHLCV bars, oldest → newest, length ≤ limit. */
  getBars(symbol: string, timeframe: Timeframe, limit: number): Promise<Bar[]>;
  /** Latest available price for a symbol. */
  getQuote(symbol: string): Promise<Quote>;
  /** Symbols this provider exposes (may be a curated subset). */
  getInstruments(): Promise<InstrumentInfo[]>;
  /** Lightweight connectivity + auth check with measured latency. */
  health(): Promise<ProviderHealth>;
}

/** Thrown when a provider is called without its required configuration. */
export class ProviderNotConfiguredError extends Error {
  constructor(public provider: ProviderName) {
    super(`Provider "${provider}" is not configured (missing API key)`);
    this.name = 'ProviderNotConfiguredError';
  }
}
