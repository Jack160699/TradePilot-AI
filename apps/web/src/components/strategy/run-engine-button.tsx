'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@tradepilot/ui';
import { Play } from 'lucide-react';

export function RunEngineButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/engine/run', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(`Evaluated ${body.evaluated ?? 0} strategies, generated ${body.generated ?? 0} signals.`);
        router.refresh();
      } else {
        setMsg(typeof body.error === 'string' ? body.error : 'Engine run failed.');
      }
    } catch {
      setMsg('Network error.');
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-3">
      <Button size="sm" onClick={run} disabled={busy}>
        <Play className="mr-1 h-4 w-4" /> {busy ? 'Running…' : 'Run signal engine'}
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
