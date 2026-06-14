/**
 * Strategy rule engine.
 *
 * A strategy is a set of IF/THEN conditions combined with AND/OR. Each condition
 * compares two operands. An operand is either a constant value or a technical
 * indicator computed from the OHLCV series (RSI, EMA, SMA, MACD, Bollinger
 * Bands, Volume). When the combined condition is true on the most recent bar,
 * the engine emits a trade signal with volatility-scaled stop-loss / take-profit.
 *
 * This module is pure (no I/O), so it is shared by the live signal worker, the
 * backtester, and unit tests.
 */
import { sma, ema, rsi, macd, bollinger, atr, volumeSma } from './indicators';

export interface Bar {
  time: number; // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type IndicatorName =
  | 'PRICE'
  | 'RSI'
  | 'EMA'
  | 'SMA'
  | 'MACD'
  | 'MACD_SIGNAL'
  | 'MACD_HIST'
  | 'BB_UPPER'
  | 'BB_MIDDLE'
  | 'BB_LOWER'
  | 'VOLUME'
  | 'VOLUME_SMA';

export type Operator = 'GT' | 'LT' | 'GTE' | 'LTE' | 'CROSSES_ABOVE' | 'CROSSES_BELOW';

export interface IndicatorOperand {
  kind: 'indicator';
  indicator: IndicatorName;
  period?: number;
}

export interface ValueOperand {
  kind: 'value';
  value: number;
}

export type Operand = IndicatorOperand | ValueOperand;

export interface Condition {
  left: Operand;
  op: Operator;
  right: Operand;
}

export interface StrategyConfig {
  logic: 'AND' | 'OR';
  direction: 'LONG' | 'SHORT';
  conditions: Condition[];
  /** Stop-loss as a fraction of entry (e.g. 0.02 = 2%). */
  stopLossPct: number;
  /** Take-profit as a fraction of entry (e.g. 0.04 = 4%). */
  takeProfitPct: number;
}

export interface GeneratedSignal {
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  riskReward: number;
  indicators: Record<string, number>;
  rationale: string;
}

export const INDICATOR_LABELS: Record<IndicatorName, string> = {
  PRICE: 'Price (close)',
  RSI: 'RSI',
  EMA: 'EMA',
  SMA: 'SMA',
  MACD: 'MACD line',
  MACD_SIGNAL: 'MACD signal',
  MACD_HIST: 'MACD histogram',
  BB_UPPER: 'Bollinger upper',
  BB_MIDDLE: 'Bollinger middle',
  BB_LOWER: 'Bollinger lower',
  VOLUME: 'Volume',
  VOLUME_SMA: 'Volume SMA',
};

export const OPERATOR_LABELS: Record<Operator, string> = {
  GT: '>',
  LT: '<',
  GTE: '>=',
  LTE: '<=',
  CROSSES_ABOVE: 'crosses above',
  CROSSES_BELOW: 'crosses below',
};

/** Resolve an operand to a full series aligned with `bars`. */
function resolveSeries(operand: Operand, bars: Bar[]): number[] {
  if (operand.kind === 'value') return bars.map(() => operand.value);
  const close = bars.map((b) => b.close);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const volume = bars.map((b) => b.volume);
  const p = operand.period;
  switch (operand.indicator) {
    case 'PRICE':
      return close;
    case 'RSI':
      return rsi(close, p ?? 14);
    case 'EMA':
      return ema(close, p ?? 50);
    case 'SMA':
      return sma(close, p ?? 50);
    case 'MACD':
      return macd(close).macdLine;
    case 'MACD_SIGNAL':
      return macd(close).signalLine;
    case 'MACD_HIST':
      return macd(close).histogram;
    case 'BB_UPPER':
      return bollinger(close, p ?? 20).upper;
    case 'BB_MIDDLE':
      return bollinger(close, p ?? 20).middle;
    case 'BB_LOWER':
      return bollinger(close, p ?? 20).lower;
    case 'VOLUME':
      return volume;
    case 'VOLUME_SMA':
      return volumeSma(volume, p ?? 20);
    default:
      return close;
  }
}

function operandLabel(operand: Operand): string {
  if (operand.kind === 'value') return String(operand.value);
  const base = INDICATOR_LABELS[operand.indicator];
  return operand.period ? `${base}(${operand.period})` : base;
}

interface ConditionResult {
  passed: boolean;
  leftValue: number;
  rightValue: number;
  description: string;
}

function evalCondition(cond: Condition, bars: Bar[]): ConditionResult {
  const leftSeries = resolveSeries(cond.left, bars);
  const rightSeries = resolveSeries(cond.right, bars);
  const i = bars.length - 1;
  const l = leftSeries[i] ?? NaN;
  const r = rightSeries[i] ?? NaN;
  const lPrev = leftSeries[i - 1] ?? NaN;
  const rPrev = rightSeries[i - 1] ?? NaN;

  let passed = false;
  switch (cond.op) {
    case 'GT':
      passed = l > r;
      break;
    case 'LT':
      passed = l < r;
      break;
    case 'GTE':
      passed = l >= r;
      break;
    case 'LTE':
      passed = l <= r;
      break;
    case 'CROSSES_ABOVE':
      passed = lPrev <= rPrev && l > r;
      break;
    case 'CROSSES_BELOW':
      passed = lPrev >= rPrev && l < r;
      break;
  }
  if (Number.isNaN(l) || Number.isNaN(r)) passed = false;
  return {
    passed,
    leftValue: l,
    rightValue: r,
    description: `${operandLabel(cond.left)} ${OPERATOR_LABELS[cond.op]} ${operandLabel(cond.right)}`,
  };
}

/**
 * Evaluate a strategy against a series of bars (oldest → newest).
 * Returns a generated signal when the rule set matches the latest bar.
 */
export function evaluateStrategy(bars: Bar[], config: StrategyConfig): GeneratedSignal | null {
  if (bars.length < 30 || config.conditions.length === 0) return null;
  const results = config.conditions.map((c) => evalCondition(c, bars));
  const matched =
    config.logic === 'AND' ? results.every((r) => r.passed) : results.some((r) => r.passed);
  if (!matched) return null;

  const last = bars[bars.length - 1]!;
  const entry = last.close;
  const direction = config.direction;
  const slPct = Math.max(0.001, config.stopLossPct);
  const tpPct = Math.max(0.001, config.takeProfitPct);
  const stopLoss = direction === 'LONG' ? entry * (1 - slPct) : entry * (1 + slPct);
  const takeProfit = direction === 'LONG' ? entry * (1 + tpPct) : entry * (1 - tpPct);
  const riskReward = tpPct / slPct;

  // Confidence: share of conditions passed (AND is always 1.0) blended with a
  // volatility sanity check (tighter ATR relative to entry → higher confidence).
  const passShare = results.filter((r) => r.passed).length / results.length;
  const atrSeries = atr(
    bars.map((b) => b.high),
    bars.map((b) => b.low),
    bars.map((b) => b.close),
  );
  const vol = (atrSeries[atrSeries.length - 1] ?? 0) / entry;
  const volScore = Math.max(0, Math.min(1, 1 - vol * 10));
  const confidence = Math.max(0.5, Math.min(0.98, 0.5 * passShare + 0.5 * volScore));

  const indicators: Record<string, number> = {};
  results.forEach((r, idx) => {
    indicators[`cond${idx + 1}_left`] = round(r.leftValue);
    indicators[`cond${idx + 1}_right`] = round(r.rightValue);
  });

  const rationale =
    `${direction} setup: ` +
    results.map((r) => r.description).join(config.logic === 'AND' ? ' AND ' : ' OR ') +
    `. Entry ${round(entry)}, SL ${round(stopLoss)}, TP ${round(takeProfit)} (R:R ${riskReward.toFixed(2)}).`;

  return { direction, entryPrice: entry, stopLoss, takeProfit, confidence, riskReward, indicators, rationale };
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** Validate an untrusted strategy config (e.g. from a form/API). */
export function validateStrategyConfig(input: unknown): { ok: true; config: StrategyConfig } | { ok: false; error: string } {
  const c = input as Partial<StrategyConfig>;
  if (!c || typeof c !== 'object') return { ok: false, error: 'Config must be an object' };
  if (c.logic !== 'AND' && c.logic !== 'OR') return { ok: false, error: 'logic must be AND or OR' };
  if (c.direction !== 'LONG' && c.direction !== 'SHORT') return { ok: false, error: 'direction must be LONG or SHORT' };
  if (!Array.isArray(c.conditions) || c.conditions.length === 0) return { ok: false, error: 'At least one condition required' };
  if (c.conditions.length > 10) return { ok: false, error: 'At most 10 conditions allowed' };
  for (const cond of c.conditions) {
    if (!cond || typeof cond !== 'object') return { ok: false, error: 'Invalid condition' };
    if (!isOperand(cond.left) || !isOperand(cond.right)) return { ok: false, error: 'Invalid operand' };
    if (!(cond.op in OPERATOR_LABELS)) return { ok: false, error: `Invalid operator: ${String(cond.op)}` };
  }
  const slPct = Number(c.stopLossPct);
  const tpPct = Number(c.takeProfitPct);
  if (!(slPct > 0 && slPct < 1)) return { ok: false, error: 'stopLossPct must be between 0 and 1' };
  if (!(tpPct > 0 && tpPct < 2)) return { ok: false, error: 'takeProfitPct must be between 0 and 2' };
  return {
    ok: true,
    config: {
      logic: c.logic,
      direction: c.direction,
      conditions: c.conditions as Condition[],
      stopLossPct: slPct,
      takeProfitPct: tpPct,
    },
  };
}

function isOperand(o: unknown): o is Operand {
  if (!o || typeof o !== 'object') return false;
  const op = o as Operand;
  if (op.kind === 'value') return typeof op.value === 'number' && Number.isFinite(op.value);
  if (op.kind === 'indicator') return (op.indicator as string) in INDICATOR_LABELS;
  return false;
}
