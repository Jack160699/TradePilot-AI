import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tradepilot/db';
import { auth } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';

const patchSchema = z.object({ enabled: z.boolean().optional() });

async function ownStrategy(userId: string, id: string) {
  const s = await prisma.strategy.findUnique({ where: { id } });
  return s && s.userId === userId ? s : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await ownStrategy(session.user.id, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.strategy.update({ where: { id }, data: parsed.data });
  await recordAudit({ userId: session.user.id, action: 'UPDATE', resource: 'strategy', resourceId: id });
  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await ownStrategy(session.user.id, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  await prisma.strategy.delete({ where: { id } });
  await recordAudit({ userId: session.user.id, action: 'DELETE', resource: 'strategy', resourceId: id });
  return NextResponse.json({ ok: true });
}
