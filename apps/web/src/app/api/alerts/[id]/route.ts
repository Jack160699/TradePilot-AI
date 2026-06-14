import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tradepilot/db';
import { auth } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';

const patchSchema = z.object({ status: z.enum(['ACTIVE', 'PAUSED']) });

async function ownAlert(userId: string, id: string) {
  const a = await prisma.alert.findUnique({ where: { id } });
  return a && a.userId === userId ? a : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await ownAlert(session.user.id, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const updated = await prisma.alert.update({ where: { id }, data: { status: parsed.data.status } });
  await recordAudit({ userId: session.user.id, action: 'UPDATE', resource: 'alert', resourceId: id });
  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await ownAlert(session.user.id, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  await prisma.alert.delete({ where: { id } });
  await recordAudit({ userId: session.user.id, action: 'DELETE', resource: 'alert', resourceId: id });
  return NextResponse.json({ ok: true });
}
