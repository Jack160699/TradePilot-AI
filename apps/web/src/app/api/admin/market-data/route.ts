import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { requirePermission, ForbiddenError } from '@/lib/rbac';
import { recordAudit } from '@/lib/audit';
import {
  getProviderStatuses,
  setActiveMode,
  runHealthCheck,
} from '@/lib/market-data';
import { isProviderMode } from '@tradepilot/marketdata';

async function guard(): Promise<{ userId: string } | NextResponse> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await requirePermission(session.user.id, 'admin:access');
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
  return { userId: session.user.id };
}

export async function GET() {
  const g = await guard();
  if (g instanceof NextResponse) return g;
  return NextResponse.json(await getProviderStatuses());
}

const postSchema = z.union([
  z.object({ action: z.literal('select'), mode: z.string() }),
  z.object({ action: z.literal('test'), provider: z.enum(['binance', 'alphavantage', 'polygon']) }),
]);

export async function POST(req: Request) {
  const g = await guard();
  if (g instanceof NextResponse) return g;
  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.action === 'select') {
    if (!isProviderMode(parsed.data.mode)) {
      return NextResponse.json({ error: 'Invalid provider mode' }, { status: 400 });
    }
    await setActiveMode(parsed.data.mode);
    await recordAudit({ userId: g.userId, action: 'UPDATE', resource: 'market-data', resourceId: parsed.data.mode });
    return NextResponse.json(await getProviderStatuses());
  }

  // action === 'test' — live connectivity check (real API call)
  const health = await runHealthCheck(parsed.data.provider);
  await recordAudit({ userId: g.userId, action: 'UPDATE', resource: 'market-data-test', resourceId: parsed.data.provider });
  return NextResponse.json({ health });
}
