'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@tradepilot/ui';

interface ProviderStatus {
  name: 'binance' | 'alphavantage' | 'polygon';
  assetClasses: string[];
  configured: boolean;
  active: boolean;
}
interface Health {
  provider: string;
  configured: boolean;
  ok: boolean;
  latencyMs?: number;
  message?: string;
  checkedAt: number;
}

const MODES = [
  { value: 'auto', label: 'Auto (route by asset class)' },
  { value: 'binance', label: 'Binance (force)' },
  { value: 'alphavantage', label: 'Alpha Vantage (force)' },
  { value: 'polygon', label: 'Polygon (force)' },
];

const PROVIDER_LABEL: Record<string, string> = {
  binance: 'Binance', alphavantage: 'Alpha Vantage', polygon: 'Polygon',
};

export function MarketDataPanel({
  initialMode,
  providers,
}: {
  initialMode: string;
  providers: ProviderStatus[];
}) {
  const [mode, setMode] = useState(initialMode);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [health, setHealth] = useState<Record<string, Health | 'loading'>>({});

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch('/api/admin/market-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'select', mode }),
    });
    setSaving(false);
    setSaved(true);
  }

  async function test(provider: string) {
    setHealth((h) => ({ ...h, [provider]: 'loading' }));
    try {
      const res = await fetch('/api/admin/market-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', provider }),
      });
      const body = await res.json();
      setHealth((h) => ({ ...h, [provider]: body.health as Health }));
    } catch {
      setHealth((h) => ({
        ...h,
        [provider]: { provider, configured: true, ok: false, message: 'request failed', checkedAt: Date.now() },
      }));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Active provider</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Select how the signal engine sources market data. <strong>Auto</strong> routes each
            symbol to the right provider by asset class; forcing a provider sends every request to it.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={mode}
              onChange={(e) => { setMode(e.target.value); setSaved(false); }}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            {saved && <span className="text-sm text-emerald-500">Saved</span>}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {providers.map((p) => {
          const h = health[p.name];
          return (
            <Card key={p.name}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {PROVIDER_LABEL[p.name]}
                  {p.active && <Badge variant="default">active</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>Assets: {p.assetClasses.join(', ')}</div>
                <div>
                  Config:{' '}
                  <Badge variant={p.configured ? 'success' : 'danger'}>
                    {p.configured ? 'configured' : 'no API key'}
                  </Badge>
                </div>
                {h && h !== 'loading' && (
                  <div className="rounded-md bg-accent/50 p-2 text-xs">
                    <Badge variant={h.ok ? 'success' : 'danger'}>{h.ok ? 'healthy' : 'error'}</Badge>{' '}
                    {h.latencyMs != null && <span>· {h.latencyMs}ms</span>}
                    {h.message && <div className="mt-1">{h.message}</div>}
                  </div>
                )}
                {h === 'loading' && <div className="text-xs">Testing…</div>}
                <Button variant="outline" size="sm" onClick={() => test(p.name)} disabled={h === 'loading'}>
                  Test connection
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
