import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tradepilot/db';
import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { recordAudit } from '@/lib/audit';

const schema = z.object({
  type: z.enum(['PRICE', 'SIGNAL', 'STRATEGY']),
  symbol: z.string().min(1).max(20),
  condition: z.enum(['ABOVE', 'BELOW', 'CROSSES', 'ANY']),
  threshold: z.number().positive().optional(),
  channel: z.enum(['EMAIL', 'TELEGRAM', 'WHATSAPP', 'IN_APP', 'WEBHOOK']),
  note: z.string().max(280).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const alerts = await prisma.alert.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ data: alerts });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = await rateLimit(`alert:create:${session.user.id}`, 50, 3600);
  if (!rl.success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.condition !== 'ANY' && parsed.data.threshold == null) {
    return NextResponse.json({ error: 'Threshold required for ABOVE/BELOW/CROSSES' }, { status: 400 });
  }

  const alert = await prisma.alert.create({
    data: {
      userId: session.user.id,
      type: parsed.data.type,
      symbol: parsed.data.symbol.toUpperCase(),
      condition: parsed.data.condition,
      threshold: parsed.data.threshold ?? null,
      channel: parsed.data.channel,
      note: parsed.data.note,
      status: 'ACTIVE',
    },
  });
  await recordAudit({ userId: session.user.id, action: 'CREATE', resource: 'alert', resourceId: alert.id });
  return NextResponse.json({ data: alert }, { status: 201 });
}
