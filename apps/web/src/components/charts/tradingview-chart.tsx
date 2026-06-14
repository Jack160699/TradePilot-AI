'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    TradingView?: { widget: new (config: Record<string, unknown>) => unknown };
  }
}

/** Maps an internal symbol to a TradingView exchange-qualified symbol. */
const TV_SYMBOL: Record<string, string> = {
  BTCUSDT: 'BINANCE:BTCUSDT',
  ETHUSDT: 'BINANCE:ETHUSDT',
  SOLUSDT: 'BINANCE:SOLUSDT',
  BNBUSDT: 'BINANCE:BNBUSDT',
  XRPUSDT: 'BINANCE:XRPUSDT',
  AAPL: 'NASDAQ:AAPL',
  MSFT: 'NASDAQ:MSFT',
  TSLA: 'NASDAQ:TSLA',
  NVDA: 'NASDAQ:NVDA',
  AMZN: 'NASDAQ:AMZN',
  EURUSD: 'FX:EURUSD',
  GBPUSD: 'FX:GBPUSD',
  XAUUSD: 'OANDA:XAUUSD',
};

const TV_INTERVAL: Record<string, string> = {
  M1: '1', M5: '5', M15: '15', M30: '30', H1: '60', H4: '240', D1: 'D', W1: 'W',
};

let scriptPromise: Promise<void> | null = null;
function loadTv(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.TradingView) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://s3.tradingview.com/tv.js';
    s.async = true;
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function TradingViewChart({
  symbol,
  timeframe = 'H1',
  height = 540,
}: {
  symbol: string;
  timeframe?: string;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(`tv_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let cancelled = false;
    loadTv().then(() => {
      if (cancelled || !window.TradingView || !containerRef.current) return;
      containerRef.current.innerHTML = `<div id="${idRef.current}" style="height:${height}px"></div>`;
      new window.TradingView.widget({
        container_id: idRef.current,
        symbol: TV_SYMBOL[symbol] ?? symbol,
        interval: TV_INTERVAL[timeframe] ?? '60',
        autosize: true,
        theme: 'dark',
        style: '1',
        timezone: 'Etc/UTC',
        withdateranges: true,
        allow_symbol_change: true,
        studies: ['RSI@tv-basicstudies', 'MASimple@tv-basicstudies'],
        details: true,
        hide_side_toolbar: false,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, height]);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-xl border bg-card"
      style={{ height }}
    />
  );
}
