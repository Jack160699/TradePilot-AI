import { Card, CardContent, CardHeader, CardTitle, Badge } from '@tradepilot/ui';
import { prisma } from '@tradepilot/db';
import { formatPct } from '@/lib/utils';
import { RunEngineButton } from '@/components/strategy/run-engine-button';

export const dynamic = 'force-dynamic';

export default async function SignalsPage() {
  const signals = await prisma.signal.findMany({
    where: { status: 'ACTIVE' },
    include: { instrument: true },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">My Signals</h1>
        <RunEngineButton />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {signals.length === 0 && (
          <p className="text-muted-foreground">
            No active signals yet. Create a strategy and run the engine to generate signals.
          </p>
        )}
        {signals.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {s.instrument.symbol}
                <Badge variant={s.direction === 'LONG' ? 'success' : 'danger'}>{s.direction}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>{s.timeframe}</span>
                <Badge variant="outline">{s.model}</Badge>
              </div>
              <div>Entry: {s.entryPrice.toString()}</div>
              <div>Stop: {s.stopLoss.toString()} · Target: {s.takeProfit.toString()}</div>
              <div>R:R {s.riskReward.toFixed(2)} · Confidence {formatPct(s.confidence * 100, 0)}</div>
              <p className="pt-2 text-xs">{s.rationale}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
