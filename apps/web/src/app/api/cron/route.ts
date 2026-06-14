import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@tradepilot/db';
import { runSignalEngine } from '@/lib/signal-engine';

// Vercel Hobby compatibility:
//  - Cron runs once per day (see vercel.json "0 3 * * *").
//  - maxDuration 60s is the Hobby ceiling; keeps the daily sweep within budget.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Constant-time bearer-token check for the cron secret. */
function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET ?? '';
  if (!secret || !header) return false;
  const a = Buffer.from(header, 'utf8');
  const b = Buffer.from(`Bearer ${secret}`, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Daily maintenance cron (Vercel Hobby: once per day).
 * 1. Expires stale ACTIVE signals (fast, runs first so it always commits).
 * 2. Runs a bounded engine sweep so the platform still auto-generates daily.
 *
 * Frequent / real-time generation is NOT done here — it is on-demand and
 * user-triggered via POST /api/engine/run (the "Run signal engine" button),
 * which keeps the platform responsive without any sub-daily cron.
 *
 * Protected by CRON_SECRET (Vercel auto-sends `Authorization: Bearer $CRON_SECRET`).
 */
export async function GET(req: Request) {
  if (!authorized(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const expired = await prisma.signal.updateMany({
    where: { status: 'ACTIVE', createdAt: { lt: new Date(Date.now() - 1000 * 60 * 60 * 24) } },
    data: { status: 'EXPIRED' },
  });
  // Bounded sweep keeps the single daily invocation within the Hobby time limit.
  const engine = await runSignalEngine({ limit: 50 });
  return NextResponse.json({ expired: expired.count, ...engine });
}
