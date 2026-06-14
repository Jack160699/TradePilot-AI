'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@tradepilot/ui';
import { TradingViewChart } from '@/components/charts/tradingview-chart';

const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'AAPL', 'MSFT', 'TSLA', 'NVDA', 'AMZN', 'EURUSD', 'GBPUSD', 'XAUUSD',
];
const TIMEFRAMES = ['M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];
const inputCls = 'rounded-md border bg-background px-3 py-2 text-sm';

export default function ChartsPage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('H1');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Charts</h1>
        <div className="flex gap-3">
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={inputCls}>
            {SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className={inputCls}>
            {TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <TradingViewChart symbol={symbol} timeframe={timeframe} height={560} />

      <Card>
        <CardHeader><CardTitle className="text-sm text-muted-foreground">About this chart</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Powered by TradingView Advanced Charts. Use the toolbar to add indicators, switch
          timeframes, and draw trendlines, Fibonacci levels, and annotations. Symbol and
          timeframe selectors above sync the embedded widget.
        </CardContent>
      </Card>
    </div>
  );
}
