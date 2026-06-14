'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@tradepilot/ui';
import { Plus, Trash2 } from 'lucide-react';

// ── Option catalogs (kept local so the client bundle stays lean) ──────────────
const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'AAPL', 'MSFT', 'TSLA', 'NVDA', 'AMZN', 'EURUSD', 'GBPUSD', 'XAUUSD',
];
const TIMEFRAMES = ['M5', 'M15', 'M30', 'H1', 'H4', 'D1'] as const;

const INDICATORS = [
  { value: 'PRICE', label: 'Price (close)', hasPeriod: false },
  { value: 'RSI', label: 'RSI', hasPeriod: true },
  { value: 'EMA', label: 'EMA', hasPeriod: true },
  { value: 'SMA', label: 'SMA', hasPeriod: true },
  { value: 'MACD', label: 'MACD line', hasPeriod: false },
  { value: 'MACD_SIGNAL', label: 'MACD signal', hasPeriod: false },
  { value: 'MACD_HIST', label: 'MACD histogram', hasPeriod: false },
  { value: 'BB_UPPER', label: 'Bollinger upper', hasPeriod: true },
  { value: 'BB_MIDDLE', label: 'Bollinger middle', hasPeriod: true },
  { value: 'BB_LOWER', label: 'Bollinger lower', hasPeriod: true },
  { value: 'VOLUME', label: 'Volume', hasPeriod: false },
  { value: 'VOLUME_SMA', label: 'Volume SMA', hasPeriod: true },
] as const;

const OPERATORS = [
  { value: 'LT', label: '<' },
  { value: 'LTE', label: '<=' },
  { value: 'GT', label: '>' },
  { value: 'GTE', label: '>=' },
  { value: 'CROSSES_ABOVE', label: 'crosses above' },
  { value: 'CROSSES_BELOW', label: 'crosses below' },
] as const;

interface RowOperand {
  mode: 'indicator' | 'value';
  indicator: string;
  period: number;
  value: number;
}
interface Row {
  left: RowOperand;
  op: string;
  right: RowOperand;
}

const newOperand = (mode: 'indicator' | 'value', indicator = 'RSI'): RowOperand => ({
  mode,
  indicator,
  period: 14,
  value: 30,
});

const newRow = (): Row => ({
  left: newOperand('indicator', 'RSI'),
  op: 'LT',
  right: newOperand('value'),
});

function hasPeriod(ind: string): boolean {
  return INDICATORS.find((i) => i.value === ind)?.hasPeriod ?? false;
}

function buildOperand(o: RowOperand) {
  if (o.mode === 'value') return { kind: 'value' as const, value: Number(o.value) };
  return hasPeriod(o.indicator)
    ? { kind: 'indicator' as const, indicator: o.indicator, period: Number(o.period) }
    : { kind: 'indicator' as const, indicator: o.indicator };
}

const inputCls = 'rounded-md border bg-background px-2 py-1.5 text-sm';

export function StrategyBuilder() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>('H1');
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [stopLossPct, setStopLossPct] = useState(2);
  const [takeProfitPct, setTakeProfitPct] = useState(4);
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function updateOperand(i: number, side: 'left' | 'right', patch: Partial<RowOperand>) {
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, [side]: { ...r[side], ...patch } } : r)),
    );
  }

  const config = {
    logic,
    direction,
    stopLossPct: stopLossPct / 100,
    takeProfitPct: takeProfitPct / 100,
    conditions: rows.map((r) => ({
      left: buildOperand(r.left),
      op: r.op,
      right: buildOperand(r.right),
    })),
  };

  async function save() {
    setError(null);
    if (!name.trim()) return setError('Strategy name is required.');
    setSaving(true);
    try {
      const res = await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, symbol, timeframe, config }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body.error === 'string' ? body.error : 'Could not save strategy.');
        setSaving(false);
        return;
      }
      router.push('/strategies');
      router.refresh();
    } catch {
      setError('Network error while saving.');
      setSaving(false);
    }
  }

  function OperandEditor({ i, side }: { i: number; side: 'left' | 'right' }) {
    const o = rows[i]![side];
    return (
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={o.mode}
          onChange={(e) => updateOperand(i, side, { mode: e.target.value as 'indicator' | 'value' })}
          className={inputCls}
        >
          <option value="indicator">Indicator</option>
          <option value="value">Value</option>
        </select>
        {o.mode === 'indicator' ? (
          <>
            <select
              value={o.indicator}
              onChange={(e) => updateOperand(i, side, { indicator: e.target.value })}
              className={inputCls}
            >
              {INDICATORS.map((ind) => (
                <option key={ind.value} value={ind.value}>{ind.label}</option>
              ))}
            </select>
            {hasPeriod(o.indicator) && (
              <input
                type="number" min={1} max={400} value={o.period}
                onChange={(e) => updateOperand(i, side, { period: Number(e.target.value) })}
                className={`${inputCls} w-20`} title="Period"
              />
            )}
          </>
        ) : (
          <input
            type="number" value={o.value}
            onChange={(e) => updateOperand(i, side, { value: Number(e.target.value) })}
            className={`${inputCls} w-28`}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Strategy details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="RSI Oversold Reversal" className={`${inputCls} w-full`} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional" className={`${inputCls} w-full`} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Symbol</label>
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={`${inputCls} w-full`}>
              {SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Timeframe</label>
            <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as (typeof TIMEFRAMES)[number])} className={`${inputCls} w-full`}>
              {TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Rules
            <div className="flex items-center gap-2 text-sm font-normal">
              <span className="text-muted-foreground">Match</span>
              <select value={logic} onChange={(e) => setLogic(e.target.value as 'AND' | 'OR')} className={inputCls}>
                <option value="AND">ALL (AND)</option>
                <option value="OR">ANY (OR)</option>
              </select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map((r, i) => (
            <div key={i} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <Badge variant="outline">IF {i > 0 ? logic : ''} #{i + 1}</Badge>
                {rows.length > 1 && (
                  <button onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive" aria-label="Remove rule">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <OperandEditor i={i} side="left" />
                <select value={r.op} onChange={(e) => updateRow(i, { op: e.target.value })} className={inputCls}>
                  {OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
                <OperandEditor i={i} side="right" />
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRows([...rows, newRow()])}>
            <Plus className="mr-1 h-4 w-4" /> Add condition
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Signal & risk</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Direction</label>
            <select value={direction} onChange={(e) => setDirection(e.target.value as 'LONG' | 'SHORT')} className={`${inputCls} w-full`}>
              <option value="LONG">LONG (buy)</option>
              <option value="SHORT">SHORT (sell)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Stop loss %</label>
            <input type="number" min={0.1} max={50} step={0.1} value={stopLossPct}
              onChange={(e) => setStopLossPct(Number(e.target.value))} className={`${inputCls} w-full`} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Take profit %</label>
            <input type="number" min={0.1} max={100} step={0.1} value={takeProfitPct}
              onChange={(e) => setTakeProfitPct(Number(e.target.value))} className={`${inputCls} w-full`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm text-muted-foreground">Preview</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm">
            <span className="font-semibold">{direction}</span> {symbol} ({timeframe}) when{' '}
            <span className="text-primary">
              {rows.map((r, i) => {
                const lbl = (o: RowOperand) =>
                  o.mode === 'value' ? String(o.value)
                    : `${INDICATORS.find((x) => x.value === o.indicator)?.label}${hasPeriod(o.indicator) ? `(${o.period})` : ''}`;
                const opLbl = OPERATORS.find((x) => x.value === r.op)?.label;
                return (
                  <span key={i}>
                    {i > 0 && <span className="text-muted-foreground"> {logic} </span>}
                    {lbl(r.left)} {opLbl} {lbl(r.right)}
                  </span>
                );
              })}
            </span>
            . R:R {(takeProfitPct / stopLossPct).toFixed(2)}.
          </p>
        </CardContent>
      </Card>

      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <div className="flex gap-3">
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save strategy'}</Button>
        <Button variant="outline" onClick={() => router.push('/strategies')}>Cancel</Button>
      </div>
    </div>
  );
}
