import type { AssetClass, Bar, InstrumentInfo, MarketDataProvider, ProviderHealth, Quote, Timeframe } from './types';
import { ProviderNotConfiguredError } from './types';
import { fetchJson, RateLimitError } from './http';
import { alphaVantageFxParams, canonical, splitFxPair } from './symbols';

const BASE = 'https://www.alphavantage.co/query';

/** Major FX pairs Alpha Vantage reliably serves (its FX coverage is broad; this
 *  is the curated set this platform exposes for selection/normalization). */
const FX_PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'EURGBP', 'EURJPY', 'GBPJPY'];

interface AvResponse {
  Note?: string;
  Information?: string;
  'Error Message'?: string;
  [key: string]: unknown;
}

type AvBarObj = Record<string, { '1. open'?: string; '2. high'?: string; '3. low'?: string; '4. close'?: string }>;

/** Detect Alpha Vantage's soft rate-limit / error envelopes (HTTP 200 body). */
function assertNoAvError(body: AvResponse, provider = 'alphavantage'): void {
  if (body.Note || body.Information) throw new RateLimitError(provider, body.Note ?? body.Information);
  if (body['Error Message']) throw new Error(`Alpha Vantage: ${body['Error Message']}`);
}

/** Alpha Vantage market data (forex). Requires ALPHAVANTAGE_API_KEY. */
export class AlphaVantageProvider implements MarketDataProvider {
  readonly name = 'alphavantage' as const;
  readonly assetClasses: AssetClass[] = ['FOREX', 'COMMODITY'];

  private get key(): string {
    return process.env.ALPHAVANTAGE_API_KEY ?? '';
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
    const { from, to } = splitFxPair(symbol);
    const { fn, interval } = alphaVantageFxParams(timeframe);
    const outputsize = limit > 100 ? 'full' : 'compact';
    const params = new URLSearchParams({ function: fn, from_symbol: from, to_symbol: to, apikey: key, outputsize });
    if (interval) params.set('interval', interval);
    const body = await fetchJson<AvResponse>(`${BASE}?${params.toString()}`);
    assertNoAvError(body);

    const seriesKey = Object.keys(body).find((k) => k.toLowerCase().includes('time series'));
    if (!seriesKey) return [];
    const series = body[seriesKey] as AvBarObj;
    const bars: Bar[] = Object.entries(series).map(([ts, o]) => {
      const open = Number(o['1. open'] ?? 0);
      const high = Number(o['2. high'] ?? 0);
      const low = Number(o['3. low'] ?? 0);
      const close = Number(o['4. close'] ?? 0);
      return { time: new Date(ts.replace(' ', 'T') + 'Z').getTime(), open, high, low, close, volume: 0 };
    });
    bars.sort((a, b) => a.time - b.time);
    return bars.slice(-limit);
  }

  async getQuote(symbol: string): Promise<Quote> {
    const key = this.requireKey();
    const { from, to } = splitFxPair(symbol);
    const params = new URLSearchParams({
      function: 'CURRENCY_EXCHANGE_RATE',
      from_currency: from,
      to_currency: to,
      apikey: key,
    });
    const body = await fetchJson<AvResponse>(`${BASE}?${params.toString()}`);
    assertNoAvError(body);
    const rate = body['Realtime Currency Exchange Rate'] as Record<string, string> | undefined;
    const price = Number(rate?.['5. Exchange Rate'] ?? 0);
    return { symbol: canonical(symbol), price, time: Date.now() };
  }

  async getInstruments(): Promise<InstrumentInfo[]> {
    return FX_PAIRS.map((p) => ({
      symbol: p,
      name: `${p.slice(0, 3)} / ${p.slice(3)}`,
      assetClass: 'FOREX' as const,
      exchange: 'FX',
    }));
  }

  async health(): Promise<ProviderHealth> {
    const started = Date.now();
    if (!this.isConfigured()) {
      return { provider: this.name, configured: false, ok: false, message: 'ALPHAVANTAGE_API_KEY not set', checkedAt: Date.now() };
    }
    try {
      await this.getQuote('EURUSD');
      return { provider: this.name, configured: true, ok: true, latencyMs: Date.now() - started, checkedAt: Date.now() };
    } catch (err) {
      const rateLimited = err instanceof RateLimitError;
      return {
        provider: this.name,
        configured: true,
        ok: false,
        latencyMs: Date.now() - started,
        message: rateLimited ? 'Rate limit reached (free tier: 25 req/day)' : err instanceof Error ? err.message : 'unknown error',
        checkedAt: Date.now(),
      };
    }
  }
}
