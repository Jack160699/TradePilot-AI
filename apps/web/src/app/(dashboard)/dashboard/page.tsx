import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@tradepilot/ui';
import { prisma } from '@tradepilot/db';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;
  const [openTrades, activeSignals, portfolios, strategies, activeAlerts, recentSignals] =
    await Promise.all([
      prisma.trade.count({ where: { userId, status: 'OPEN' } }),
      prisma.signal.count({ where: { status: 'ACTIVE' } }),
      prisma.portfolio.count({ where: { userId } }),
      prisma.strategy.count({ where: { userId } }),
      prisma.alert.count({ where: { userId, status: 'ACTIVE' } }),
      prisma.signal.findMany({
        where: { status: 'ACTIVE' },
        include: { instrument: true },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
    ]);

  const stats = [
    { label: 'Active Signals', value: activeSignals, href: '/signals' },
    { label: 'My Strategies', value: strategies, href: '/strategies' },
    { label: 'Open Trades', value: openTrades, href: '/portfolio' },
    { label: 'Portfolios', value: portfolios, href: '/portfolio' },
    { label: 'Active Alerts', value: activeAlerts, href: '/alerts' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-colors hover:border-primary/50">
              <CardHeader><CardTitle className="text-sm text-muted-foreground">{s.label}</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{s.value}</p></CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Latest signals</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {recentSignals.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No active signals yet. Build a strategy and run the engine to generate some.
            </p>
          )}
          {recentSignals.map((s) => (
            <div key={s.id} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
              <span className="font-medium">{s.instrument.symbol}</span>
              <span className="text-muted-foreground">{s.timeframe} · {s.model}</span>
              <span>entry {s.entryPrice.toString()}</span>
              <Badge variant={s.direction === 'LONG' ? 'success' : 'danger'}>{s.direction}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
