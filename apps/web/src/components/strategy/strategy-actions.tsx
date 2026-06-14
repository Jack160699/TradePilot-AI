'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@tradepilot/ui';

export function StrategyActions({ id, enabled }: { id: string; enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await fetch(`/api/strategies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled }),
    });
    router.refresh();
    setBusy(false);
  }

  async function remove() {
    if (!confirm('Delete this strategy? This cannot be undone.')) return;
    setBusy(true);
    await fetch(`/api/strategies/${id}`, { method: 'DELETE' });
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={toggle} disabled={busy}>
        {enabled ? 'Disable' : 'Enable'}
      </Button>
      <Button variant="ghost" size="sm" onClick={remove} disabled={busy}>Delete</Button>
    </div>
  );
}
