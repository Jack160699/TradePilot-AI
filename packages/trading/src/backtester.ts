import { riskReward } from './risk';

export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number; }
export interface BacktestParams {
  candles: Candle[];
  initialCapital: number;
  signalFn: (window: Candle[]) => 'LONG' | 'SHORT' | null;
  stopPct: number;
  targetPct: number;
  riskPct: number;
}
export interface BacktestResult {
  finalEquity: number;
  totalReturnPct: number;
  sharpeRatio: number;
  maxDrawdownPct: number;
  winRate: number;
  totalTrades: number;
  equityCurve: Array<{ t: number; equity: number }>;
}

/** Deterministic event-driven backtest engine. */
export function runBacktest(p: BacktestParams): BacktestResult {
  let equity = p.initialCapital;
  let peak = equity;
  let maxDD = 0;
  let wins = 0;
  let trades = 0;
  const returns: number[] = [];
  const equityCurve: Array<{ t: number; equity: number }> = [];

  for (let i = 30; i < p.candles.length; i++) {
    const window = p.candles.slice(0, i);
    const dir = p.signalFn(window);
    const candle = p.candles[i]!;
    if (dir) {
      const entry = candle.c;
      const stop = dir === 'LONG' ? entry * (1 - p.stopPct / 100) : entry * (1 + p.stopPct / 100);
      const target = dir === 'LONG' ? entry * (1 + p.targetPct / 100) : entry * (1 - p.targetPct / 100);
      const rr = riskReward(entry, stop, target);
      // simplified: assume target/stop hit with probability tied to rr
      const win = rr >= 1.5 && candle.c >= candle.o === (dir === 'LONG');
      const pnlPct = win ? p.targetPct : -p.stopPct;
      const riskAmount = equity * (p.riskPct / 100);
      equity += riskAmount * (pnlPct / p.stopPct);
      returns.push(pnlPct / 100);
      trades++;
      if (win) wins++;
    }
    peak = Math.max(peak, equity);
    maxDD = Math.max(maxDD, (peak - equity) / peak);
    equityCurve.push({ t: candle.t, equity });
  }

  const mean = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length || 1);
  const std = Math.sqrt(variance) || 1;
  return {
    finalEquity: equity,
    totalReturnPct: ((equity - p.initialCapital) / p.initialCapital) * 100,
    sharpeRatio: (mean / std) * Math.sqrt(252),
    maxDrawdownPct: maxDD * 100,
    winRate: trades ? (wins / trades) * 100 : 0,
    totalTrades: trades,
    equityCurve,
  };
}
