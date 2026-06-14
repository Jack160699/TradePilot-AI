import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tradepilot/db';
import { auth } from '@/lib/auth';
import { requirePermission, ForbiddenError } from '@/lib/rbac';
import { rateLimit } from '@/lib/rate-limit';

const schema = z.object({
  strategyId: z.string(),
  symbol: z.string(),
  timeframe: z.enum(['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1']),
  startDate: z.string(),
  endDate: z.string(),
  initialCapital: z.number().positive(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await requirePermission(session.user.id, 'backtest:run');
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
  const rl = await rateLimit(`backtest:${session.user.id}`, 10, 3600);
  if (!rl.success) return NextResponse.json({ error: 'Monthly backtest limit reached' }, { status: 429 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const run = await prisma.backtest.create({
    data: {
      userId: session.user.id,
      strategyId: parsed.data.strategyId,
      symbol: parsed.data.symbol,
      timeframe: parsed.data.timeframe,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      initialCapital: parsed.data.initialCapital,
      status: 'QUEUED',
    },
  });
  return NextResponse.json({ data: run }, { status: 202 });
}
