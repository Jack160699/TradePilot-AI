# MARKET_DATA_STATUS.md

**Project:** TradePilot AI · **Date:** 2026-06-14
**Subsystem:** Market Data Layer (`@tradepilot/marketdata` + `apps/web/src/lib/market-data.ts`)
**Status:** Synthetic feed **removed**; real provider integrations in place. No mock data anywhere.

---

## What changed
The deterministic synthetic price feed (`packages/trading/src/market.ts`) is retired. The signal
engine now sources **live OHLCV bars** through a provider abstraction backed by three real APIs.
Auth, dashboard, strategy builder, and alerts were **not modified**.

```
@tradepilot/marketdata (pure, no deps)        apps/web/src/lib/market-data.ts (caching + routing)
├─ MarketDataProvider interface               ├─ getBars / getQuote / getInstruments  (Redis-cached)
├─ BinanceProvider      (crypto)              ├─ getActiveMode / setActiveMode        (DB ⇢ env ⇢ auto)
├─ AlphaVantageProvider (forex)               ├─ pickProvider  (force or asset-class routing)
├─ PolygonProvider      (equities)            └─ runHealthCheck / getProviderStatuses
├─ http.ts  (retry + backoff + 429 handling)
└─ symbols.ts (normalization + timeframe maps)        ▼ consumed by
                                              apps/web/src/lib/signal-engine.ts (await getBars, per-run cache)
                                              apps/web/src/app/admin/market-data (select / test / health)
```

## Provider abstraction
```ts
interface MarketDataProvider {
  name; assetClasses; isConfigured();
  getBars(symbol, timeframe, limit): Promise<Bar[]>;
  getQuote(symbol): Promise<Quote>;
  getInstruments(): Promise<InstrumentInfo[]>;
  health(): Promise<ProviderHealth>;
}
```

## Implemented providers

| Provider | Asset classes | Bars endpoint | Quote | Key required |
|---|---|---|---|---|
| **Binance** | Crypto | `/api/v3/klines` | `/api/v3/ticker/price` | **No** (public) |
| **Alpha Vantage** | Forex (+ commodity routing) | `FX_INTRADAY` / `FX_DAILY` / `FX_WEEKLY` | `CURRENCY_EXCHANGE_RATE` | **Yes** |
| **Polygon.io** | US equities / index | `/v2/aggs/ticker/{t}/range/...` | `/v2/aggs/ticker/{t}/prev` | **Yes** |

## Required API keys

| Env var | Provider | How to get | Free tier limits |
|---|---|---|---|
| *(none)* | Binance | — | Generous public weight limits |
| `ALPHAVANTAGE_API_KEY` | Alpha Vantage | https://www.alphavantage.co/support/#api-key | ~25 requests/day, 5/min |
| `POLYGON_API_KEY` | Polygon.io | https://polygon.io/dashboard/api-keys | 5 requests/min (end-of-day data) |
| `MARKET_DATA_PROVIDER` | selection | `auto`\|`binance`\|`alphavantage`\|`polygon` | default `auto` |
| `BINANCE_BASE_URL` | optional | override base URL | — |

Without a provider's key, requests for that asset class **fail gracefully and generate nothing** —
the engine never substitutes fake data. Crypto works out of the box (Binance needs no key).

## Provider selection (env + runtime)
Resolution order: **DB override → `MARKET_DATA_PROVIDER` env → `auto`**.
- `auto` routes by asset class: crypto→Binance, forex/commodity→Alpha Vantage, equity/index→Polygon.
- Forcing a provider sends every symbol to it.
- Admins change the mode at **`/admin/market-data`** (persisted in the `market_data_provider`
  feature flag); no redeploy needed.

## Supported symbols (normalized)
Internal symbols are normalized per provider (`canonical()` strips separators; FX pairs split into
base/quote; Polygon uses bare tickers).

| Class | Examples | Served by |
|---|---|---|
| Crypto | BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT (any Binance `*USDT`) | Binance |
| Forex | EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, USDCHF, NZDUSD, EURGBP, EURJPY, GBPJPY | Alpha Vantage |
| Equities | AAPL, MSFT, TSLA, NVDA, AMZN (any US ticker) | Polygon |

`getInstruments()` returns the live tradable list (Binance USDT pairs, Polygon active tickers) or the
curated FX set for Alpha Vantage.

## Caching, retry, rate-limit handling
- **Cache:** Redis via `cached()` (fail-open). TTLs: intraday bars 60s, daily 900s, weekly 3600s,
  quotes 15s, instrument lists 1h. The engine adds a per-run in-memory cache so strategies sharing a
  symbol+timeframe fetch once.
- **Retry:** `fetchJson` retries network errors, HTTP 429, and 5xx with exponential backoff + jitter
  (honors `Retry-After`); 4xx (except 429) are non-retryable. 10s timeout per request.
- **Rate limits:** HTTP 429 triggers backoff; Alpha Vantage's soft-limit JSON (`Note`/`Information`)
  is detected and surfaced as a `RateLimitError`. Caching is the primary defense against free-tier caps.

## Health checks
- `/admin/market-data` shows each provider's **configured** state (no API calls) and an **active** badge.
- **"Test connection"** calls `POST /api/admin/market-data {action:'test',provider}` → the provider's
  `health()` makes one real lightweight call and returns `{ok, latencyMs, message}`:
  - Binance → `/api/v3/time`
  - Alpha Vantage → `CURRENCY_EXCHANGE_RATE EUR→USD`
  - Polygon → `/v1/marketstatus/now`
- Admin endpoints require the `admin:access` permission and are audit-logged.

## Verification status (honest)
Implemented and statically verified (the execution sandbox is unavailable + registry blocked this
session, so live API calls were not exercised here). To verify live:
```bash
pnpm install                     # links the new @tradepilot/marketdata workspace package
# set ALPHAVANTAGE_API_KEY / POLYGON_API_KEY in .env (Binance needs none)
pnpm --filter web dev
# Visit /admin/market-data → Test connection on each provider
# Create a crypto strategy (e.g. BTCUSDT) → Run signal engine → live bars drive the result
```

## Remaining notes
- Alpha Vantage FX has no native H4 interval; H4 maps to 60-min (documented approximation).
- Polygon free tier serves end-of-day/aggregate data; intraday/real-time needs a paid plan.
- Options data (Polygon) is reachable via the same aggregates API on paid tiers; not wired into the
  signal engine yet (equities path is active).
