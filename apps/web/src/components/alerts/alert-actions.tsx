'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@tradepilot/ui';

export function AlertActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const paused = status === 'PAUSED';

  async function toggle() {
    setBusy(true);
    await fetch(`/api/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: paused ? 'ACTIVE' : 'PAUSED' }),
    });
    router.refresh();
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={toggle} disabled={busy}>
        {paused ? 'Resume' : 'Pause'}
      </Button>
      <Button variant="ghost" size="sm" onClick={remove} disabled={busy}>Delete</Button>
    </div>
  );
}
