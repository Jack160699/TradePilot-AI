import type { AssetClass, Bar, InstrumentInfo, MarketDataProvider, ProviderHealth, Quote, Timeframe } from './types';
import { fetchJson } from './http';
import { BINANCE_INTERVAL, canonical } from './symbols';

const BASE = process.env.BINANCE_BASE_URL ?? 'https://api.binance.com';

type Kline = [number, string, string, string, string, string, ...unknown[]];
interface TickerPrice { symbol: string; price: string }
interface ExchangeInfo {
  symbols: Array<{ symbol: string; status: string; baseAsset: string; quoteAsset: string }>;
}

/**
 * Binance public market data (crypto). No API key required for the market-data
 * endpoints used here.
 */
export class BinanceProvider implements MarketDataProvider {
  readonly name = 'binance' as const;
  readonly assetClasses: AssetClass[] = ['CRYPTO'];

  isConfigured(): boolean {
    return true; // public endpoints
  }

  private sym(symbol: string): string {
    return canonical(symbol);
  }

  async getBars(symbol: string, timeframe: Timeframe, limit: number): Promise<Bar[]> {
    const interval = BINANCE_INTERVAL[timeframe];
    const capped = Math.min(1000, Math.max(1, limit));
    const url = `${BASE}/api/v3/klines?symbol=${this.sym(symbol)}&interval=${interval}&limit=${capped}`;
    const rows = await fetchJson<Kline[]>(url);
    return rows.map((k) => ({
      time: Number(k[0]),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    }));
  }

  async getQuote(symbol: string): Promise<Quote> {
    const url = `${BASE}/api/v3/ticker/price?symbol=${this.sym(symbol)}`;
    const t = await fetchJson<TickerPrice>(url);
    return { symbol: t.symbol, price: Number(t.price), time: Date.now() };
  }

  async getInstruments(): Promise<InstrumentInfo[]> {
    const info = await fetchJson<ExchangeInfo>(`${BASE}/api/v3/exchangeInfo`);
    return info.symbols
      .filter((s) => s.status === 'TRADING' && s.quoteAsset === 'USDT')
      .map((s) => ({
        symbol: s.symbol,
        name: `${s.baseAsset} / ${s.quoteAsset}`,
        assetClass: 'CRYPTO' as const,
        exchange: 'BINANCE',
      }));
  }

  async health(): Promise<ProviderHealth> {
    const started = Date.now();
    try {
      await fetchJson<{ serverTime: number }>(`${BASE}/api/v3/time`, { retries: 1, timeoutMs: 5000 });
      return { provider: this.name, configured: true, ok: true, latencyMs: Date.now() - started, checkedAt: Date.now() };
    } catch (err) {
      return {
        provider: this.name,
        configured: true,
        ok: false,
        latencyMs: Date.now() - started,
        message: err instanceof Error ? err.message : 'unknown error',
        checkedAt: Date.now(),
      };
    }
  }
}
