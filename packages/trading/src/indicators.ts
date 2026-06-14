/** Pure technical-indicator math used by the AI engine and backtester. */
export function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { out.push(NaN); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j]!;
    out.push(sum / period);
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0] ?? 0;
  values.forEach((v, i) => {
    prev = i === 0 ? v : v * k + prev * (1 - k);
    out.push(prev);
  });
  return out;
}

export function rsi(values: number[], period = 14): number[] {
  const out: number[] = [NaN];
  let gain = 0, loss = 0;
  for (let i = 1; i < values.length; i++) {
    const diff = values[i]! - values[i - 1]!;
    const g = Math.max(diff, 0);
    const l = Math.max(-diff, 0);
    if (i <= period) {
      gain += g; loss += l;
      if (i === period) {
        const rs = loss === 0 ? 100 : gain / loss;
        out.push(100 - 100 / (1 + rs));
      } else out.push(NaN);
    } else {
      gain = (gain * (period - 1) + g) / period;
      loss = (loss * (period - 1) + l) / period;
      const rs = loss === 0 ? 100 : gain / loss;
      out.push(100 - 100 / (1 + rs));
    }
  }
  return out;
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine = values.map((_, i) => emaFast[i]! - emaSlow[i]!);
  const signalLine = ema(macdLine, signal);
  const histogram = macdLine.map((m, i) => m - signalLine[i]!);
  return { macdLine, signalLine, histogram };
}

/** Bollinger Bands (period SMA ± stdDev·σ). Returns upper/middle/lower series. */
export function bollinger(values: number[], period = 20, stdDev = 2) {
  const middle = sma(values, period);
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { upper.push(NaN); lower.push(NaN); continue; }
    let sumSq = 0;
    const mean = middle[i]!;
    for (let j = i - period + 1; j <= i; j++) sumSq += (values[j]! - mean) ** 2;
    const sigma = Math.sqrt(sumSq / period);
    upper.push(mean + stdDev * sigma);
    lower.push(mean - stdDev * sigma);
  }
  return { upper, middle, lower };
}

/** Average True Range — used for volatility-scaled stops/targets. */
export function atr(high: number[], low: number[], close: number[], period = 14): number[] {
  const tr: number[] = [];
  for (let i = 0; i < close.length; i++) {
    if (i === 0) { tr.push(high[i]! - low[i]!); continue; }
    const h = high[i]!, l = low[i]!, pc = close[i - 1]!;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  // Wilder's smoothing via EMA-like RMA
  const out: number[] = [];
  let prev = tr[0]!;
  tr.forEach((v, i) => {
    prev = i === 0 ? v : (prev * (period - 1) + v) / period;
    out.push(prev);
  });
  return out;
}

/** Simple moving average of volume — supports volume-based rule conditions. */
export function volumeSma(volume: number[], period = 20): number[] {
  return sma(volume, period);
}
