import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { runSignalEngine } from '@/lib/signal-engine';

/** Run the signal engine for the current user's enabled strategies. */
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = await rateLimit(`engine:run:${session.user.id}`, 12, 3600);
  if (!rl.success) {
    return NextResponse.json({ error: 'Engine run limit reached. Try again later.' }, { status: 429 });
  }

  const result = await runSignalEngine({ userId: session.user.id });
  return NextResponse.json(result);
}
