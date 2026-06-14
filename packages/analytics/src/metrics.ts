export interface TradeRecord { pnl: number; pnlPct: number; closedAt: Date; }

export interface PerformanceSummary {
  totalPnl: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpe: number;
  totalTrades: number;
}

export function summarizePerformance(trades: TradeRecord[]): PerformanceSummary {
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const grossWin = wins.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnl, 0));
  const returns = trades.map((t) => t.pnlPct / 100);
  const mean = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length || 1);
  const std = Math.sqrt(variance) || 1;
  return {
    totalPnl: trades.reduce((a, t) => a + t.pnl, 0),
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    profitFactor: grossLoss === 0 ? grossWin : grossWin / grossLoss,
    sharpe: (mean / std) * Math.sqrt(252),
    totalTrades: trades.length,
  };
}
