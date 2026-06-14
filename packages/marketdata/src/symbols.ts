/** Symbol + timeframe normalization shared by providers. */
import type { AssetClass, Timeframe } from './types';

/** Strip separators and uppercase: "btc/usdt" → "BTCUSDT". */
export function canonical(symbol: string): string {
  return symbol.toUpperCase().replace(/[-/_:\s]/g, '');
}

const FIAT = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CHF', 'CAD'];
const CRYPTO_QUOTES = ['USDT', 'USDC', 'BUSD', 'BTC', 'ETH'];

/** Best-effort asset-class inference from a canonical symbol. */
export function inferAssetClass(symbol: string): AssetClass {
  const s = canonical(symbol);
  if (CRYPTO_QUOTES.some((q) => s.endsWith(q) && s.length > q.length)) return 'CRYPTO';
  if (s.startsWith('XAU') || s.startsWith('XAG') || s.endsWith('OIL') || s.startsWith('WTI')) return 'COMMODITY';
  if (s.length === 6 && FIAT.includes(s.slice(0, 3)) && FIAT.includes(s.slice(3))) return 'FOREX';
  return 'EQUITY';
}

/** Split a 6-char FX pair "EURUSD" → { from: "EUR", to: "USD" }. */
export function splitFxPair(symbol: string): { from: string; to: string } {
  const s = canonical(symbol);
  if (s.length !== 6) throw new Error(`Not a 6-char FX pair: ${symbol}`);
  return { from: s.slice(0, 3), to: s.slice(3) };
}

// ── Timeframe maps ───────────────────────────────────────────────────────────

export const TIMEFRAME_MS: Record<Timeframe, number> = {
  M1: 60_000,
  M5: 300_000,
  M15: 900_000,
  M30: 1_800_000,
  H1: 3_600_000,
  H4: 14_400_000,
  D1: 86_400_000,
  W1: 604_800_000,
};

/** Binance kline interval codes. */
export const BINANCE_INTERVAL: Record<Timeframe, string> = {
  M1: '1m', M5: '5m', M15: '15m', M30: '30m', H1: '1h', H4: '4h', D1: '1d', W1: '1w',
};

/** Polygon aggregate multiplier + timespan. */
export const POLYGON_AGG: Record<Timeframe, { multiplier: number; timespan: string }> = {
  M1: { multiplier: 1, timespan: 'minute' },
  M5: { multiplier: 5, timespan: 'minute' },
  M15: { multiplier: 15, timespan: 'minute' },
  M30: { multiplier: 30, timespan: 'minute' },
  H1: { multiplier: 1, timespan: 'hour' },
  H4: { multiplier: 4, timespan: 'hour' },
  D1: { multiplier: 1, timespan: 'day' },
  W1: { multiplier: 1, timespan: 'week' },
};

/**
 * Alpha Vantage FX intraday only supports 1/5/15/30/60min. Higher timeframes
 * map to the daily/weekly series. Returns the AV function + interval (if any).
 */
export function alphaVantageFxParams(tf: Timeframe): { fn: string; interval?: string } {
  switch (tf) {
    case 'M1': return { fn: 'FX_INTRADAY', interval: '1min' };
    case 'M5': return { fn: 'FX_INTRADAY', interval: '5min' };
    case 'M15': return { fn: 'FX_INTRADAY', interval: '15min' };
    case 'M30': return { fn: 'FX_INTRADAY', interval: '30min' };
    case 'H1': return { fn: 'FX_INTRADAY', interval: '60min' };
    case 'H4': return { fn: 'FX_INTRADAY', interval: '60min' }; // closest supported
    case 'D1': return { fn: 'FX_DAILY' };
    case 'W1': return { fn: 'FX_WEEKLY' };
  }
}
