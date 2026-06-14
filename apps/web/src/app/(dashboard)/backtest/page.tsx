import { Card, CardContent, CardHeader, CardTitle, Badge } from '@tradepilot/ui';
import { prisma } from '@tradepilot/db';
import { auth } from '@/lib/auth';

export default async function BacktestPage() {
  const session = await auth();
  const runs = await prisma.backtest.findMany({
    where: { userId: session!.user.id },
    include: { strategy: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Backtests</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {runs.length === 0 && <p className="text-muted-foreground">No backtests yet.</p>}
        {runs.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {r.symbol} · {r.strategy.name}
                <Badge variant={r.status === 'COMPLETED' ? 'success' : 'outline'}>{r.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {r.status === 'COMPLETED' ? (
                <div>Return {r.totalReturnPct?.toFixed(2)}% · Sharpe {r.sharpeRatio?.toFixed(2)} · MaxDD {r.maxDrawdownPct?.toFixed(1)}%</div>
              ) : <div>Pending results…</div>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
