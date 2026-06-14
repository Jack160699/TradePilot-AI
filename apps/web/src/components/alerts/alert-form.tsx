'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@tradepilot/ui';

const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'AAPL', 'MSFT', 'TSLA', 'NVDA', 'AMZN', 'EURUSD', 'GBPUSD', 'XAUUSD',
];
const inputCls = 'rounded-md border bg-background px-3 py-2 text-sm';

export function AlertForm() {
  const router = useRouter();
  const [type, setType] = useState('PRICE');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [condition, setCondition] = useState('ABOVE');
  const [threshold, setThreshold] = useState('');
  const [channel, setChannel] = useState('IN_APP');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needsThreshold = condition !== 'ANY';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          symbol,
          condition,
          channel,
          note: note || undefined,
          threshold: needsThreshold ? Number(threshold) : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body.error === 'string' ? body.error : 'Could not create alert.');
        setBusy(false);
        return;
      }
      setThreshold('');
      setNote('');
      router.refresh();
    } catch {
      setError('Network error.');
    }
    setBusy(false);
  }

  return (
    <Card>
      <CardHeader><CardTitle>Create alert</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            <option value="PRICE">Price</option>
            <option value="SIGNAL">New signal</option>
            <option value="STRATEGY">Strategy trigger</option>
          </select>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={inputCls}>
            {SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={condition} onChange={(e) => setCondition(e.target.value)} className={inputCls}>
            <option value="ABOVE">Above</option>
            <option value="BELOW">Below</option>
            <option value="CROSSES">Crosses</option>
            <option value="ANY">Any</option>
          </select>
          <input
            type="number" step="any" value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder={needsThreshold ? 'Threshold price' : 'No threshold'}
            disabled={!needsThreshold} required={needsThreshold}
            className={`${inputCls} disabled:opacity-50`}
          />
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls}>
            <option value="IN_APP">In-app</option>
            <option value="EMAIL">Email</option>
            <option value="TELEGRAM">Telegram</option>
            <option value="WHATSAPP">WhatsApp</option>
          </select>
          <input
            value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)" className={inputCls}
          />
          {error && <p className="md:col-span-3 text-sm text-destructive">{error}</p>}
          <div className="md:col-span-3">
            <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Add alert'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
