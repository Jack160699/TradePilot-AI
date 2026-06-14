import { Card, CardContent, CardHeader, CardTitle } from '@tradepilot/ui';
import { prisma } from '@tradepilot/db';
import { auth } from '@/lib/auth';
import { summarizePerformance } from '@tradepilot/analytics';

export default async function PortfolioPage() {
  const session = await auth();
  const trades = await prisma.trade.findMany({
    where: { userId: session!.user.id, status: 'CLOSED' },
    orderBy: { closedAt: 'desc' },
  });
  const perf = summarizePerformance(
    trades.map((t) => ({ pnl: Number(t.pnl ?? 0), pnlPct: t.pnlPct ?? 0, closedAt: t.closedAt ?? new Date() })),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Portfolio</h1>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Total P&L" value={perf.totalPnl.toFixed(2)} />
        <Stat label="Win Rate" value={`${perf.winRate.toFixed(1)}%`} />
        <Stat label="Profit Factor" value={perf.profitFactor.toFixed(2)} />
        <Stat label="Sharpe" value={perf.sharpe.toFixed(2)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent><p className="text-2xl font-bold">{value}</p></CardContent>
    </Card>
  );
}
