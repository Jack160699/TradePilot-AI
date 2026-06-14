import type { AssetClass, Bar, InstrumentInfo, MarketDataProvider, ProviderHealth, Quote, Timeframe } from './types';
import { ProviderNotConfiguredError } from './types';
import { fetchJson } from './http';
import { canonical, POLYGON_AGG, TIMEFRAME_MS } from './symbols';

const BASE = 'https://api.polygon.io';

interface AggResult { t: number; o: number; h: number; l: number; c: number; v: number }
interface AggResponse { results?: AggResult[]; status?: string; resultsCount?: number }
interface TickersResponse {
  results?: Array<{ ticker: string; name?: string; primary_exchange?: string }>;
}

/** Polygon.io market data (US equities; options/crypto/forex also available on
 *  paid tiers). Requires POLYGON_API_KEY. */
export class PolygonProvider implements MarketDataProvider {
  readonly name = 'polygon' as const;
  readonly assetClasses: AssetClass[] = ['EQUITY', 'INDEX'];

  private get key(): string {
    return process.env.POLYGON_API_KEY ?? '';
  }

  isConfigured(): boolean {
    return this.key.length > 0;
  }

  private requireKey(): string {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError(this.name);
    return this.key;
  }

  async getBars(symbol: string, timeframe: Timeframe, limit: number): Promise<Bar[]> {
    const key = this.requireKey();
    const ticker = canonical(symbol);
    const { multiplier, timespan } = POLYGON_AGG[timeframe];
    // Look back enough calendar time to cover `limit` trading bars (markets
    // close nights/weekends), then slice to the most recent `limit`.
    const to = Date.now();
    const from = to - limit * TIMEFRAME_MS[timeframe] * 3;
    const url =
      `${BASE}/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}` +
      `?adjusted=true&sort=asc&limit=50000&apiKey=${key}`;
    const body = await fetchJson<AggResponse>(url);
    const rows = body.results ?? [];
    const bars: Bar[] = rows.map((r) => ({ time: r.t, open: r.o, high: r.h, low: r.l, close: r.c, volume: r.v }));
    return bars.slice(-limit);
  }

  async getQuote(symbol: string): Promise<Quote> {
    const key = this.requireKey();
    const ticker = canonical(symbol);
    // Previous-day close works on the free tier (last-trade is delayed/paid).
    const body = await fetchJson<AggResponse>(`${BASE}/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${key}`);
    const last = body.results?.[0];
    return { symbol: ticker, price: last?.c ?? 0, time: last?.t ?? Date.now() };
  }

  async getInstruments(): Promise<InstrumentInfo[]> {
    const key = this.requireKey();
    const body = await fetchJson<TickersResponse>(
      `${BASE}/v3/reference/tickers?market=stocks&active=true&limit=100&apiKey=${key}`,
    );
    return (body.results ?? []).map((t) => ({
      symbol: t.ticker,
      name: t.name ?? t.ticker,
      assetClass: 'EQUITY' as const,
      exchange: t.primary_exchange,
    }));
  }

  async health(): Promise<ProviderHealth> {
    const started = Date.now();
    if (!this.isConfigured()) {
      return { provider: this.name, configured: false, ok: false, message: 'POLYGON_API_KEY not set', checkedAt: Date.now() };
    }
    try {
      const body = await fetchJson<{ status?: string }>(`${BASE}/v1/marketstatus/now?apiKey=${this.key}`, {
        retries: 1,
        timeoutMs: 6000,
      });
      return {
        provider: this.name,
        configured: true,
        ok: true,
        latencyMs: Date.now() - started,
        message: body.status ? `market: ${body.status}` : undefined,
        checkedAt: Date.now(),
      };
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
