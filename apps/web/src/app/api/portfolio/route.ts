import { NextResponse } from 'next/server';
import { prisma } from '@tradepilot/db';
import { auth } from '@/lib/auth';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const portfolios = await prisma.portfolio.findMany({
    where: { userId: session.user.id },
    include: { trades: { where: { status: 'OPEN' } } },
  });
  return NextResponse.json({ data: portfolios });
}
