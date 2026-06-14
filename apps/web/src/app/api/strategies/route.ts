import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, Prisma } from '@tradepilot/db';
import { validateStrategyConfig } from '@tradepilot/trading';
import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { recordAudit } from '@/lib/audit';

const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'] as const;

const bodySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  symbol: z.string().min(1).max(20),
  timeframe: z.enum(TIMEFRAMES),
  config: z.unknown(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const strategies = await prisma.strategy.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ data: strategies });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = await rateLimit(`strategy:create:${session.user.id}`, 30, 3600);
  if (!rl.success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const validated = validateStrategyConfig(parsed.data.config);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  const strategy = await prisma.strategy.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name,
      description: parsed.data.description,
      symbol: parsed.data.symbol,
      timeframe: parsed.data.timeframe,
      config: validated.config as unknown as Prisma.InputJsonValue,
      enabled: true,
    },
  });
  await recordAudit({ userId: session.user.id, action: 'CREATE', resource: 'strategy', resourceId: strategy.id });
  return NextResponse.json({ data: strategy }, { status: 201 });
}
