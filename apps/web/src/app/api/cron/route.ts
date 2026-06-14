import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@tradepilot/db';
import { runSignalEngine } from '@/lib/signal-engine';

/** Constant-time bearer-token check for the cron secret. */
function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET ?? '';
  if (!secret || !header) return false;
  const a = Buffer.from(header, 'utf8');
  const b = Buffer.from(`Bearer ${secret}`, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Vercel Cron entrypoint — expires stale signals and triggers AI generation.
 *  Protected by CRON_SECRET bearer token. */
export async function GET(req: Request) {
  if (!authorized(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const expired = await prisma.signal.updateMany({
    where: { status: 'ACTIVE', createdAt: { lt: new Date(Date.now() - 1000 * 60 * 60 * 24) } },
    data: { status: 'EXPIRED' },
  });
  // Evaluate every enabled strategy platform-wide and persist new signals.
  const engine = await runSignalEngine({ limit: 500 });
  return NextResponse.json({ expired: expired.count, ...engine });
}
