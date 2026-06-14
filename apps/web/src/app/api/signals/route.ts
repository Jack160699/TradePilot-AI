import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tradepilot/db';
import { auth } from '@/lib/auth';
import { requirePermission, ForbiddenError } from '@/lib/rbac';
import { rateLimit } from '@/lib/rate-limit';
import { recordAudit } from '@/lib/audit';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = await rateLimit(`signals:get:${session.user.id}`);
  if (!rl.success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const signals = await prisma.signal.findMany({
    where: { status: 'ACTIVE' },
    include: { instrument: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({ data: signals });
}

const createSchema = z.object({
  instrumentId: z.string(),
  direction: z.enum(['LONG', 'SHORT']),
  timeframe: z.enum(['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1']),
  entryPrice: z.number(),
  stopLoss: z.number(),
  takeProfit: z.number(),
  confidence: z.number().min(0).max(1),
  riskReward: z.number(),
  rationale: z.string(),
  model: z.string(),
  indicators: z.record(z.any()),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await requirePermission(session.user.id, 'signal:create');
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const signal = await prisma.signal.create({
    data: { ...parsed.data, authorId: session.user.id },
  });
  await recordAudit({ userId: session.user.id, action: 'SIGNAL_PUBLISH', resource: 'signal', resourceId: signal.id });
  return NextResponse.json({ data: signal }, { status: 201 });
}
