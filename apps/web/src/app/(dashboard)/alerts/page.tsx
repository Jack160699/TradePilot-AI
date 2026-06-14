import { Card, CardContent, Badge } from '@tradepilot/ui';
import { prisma } from '@tradepilot/db';
import { auth } from '@/lib/auth';
import { AlertForm } from '@/components/alerts/alert-form';
import { AlertActions } from '@/components/alerts/alert-actions';

export const dynamic = 'force-dynamic';

const COND_LABEL: Record<string, string> = {
  ABOVE: 'rises above', BELOW: 'falls below', CROSSES: 'crosses', ANY: 'any change',
};

export default async function AlertsPage() {
  const session = await auth();
  const alerts = await prisma.alert.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Alerts</h1>
      <AlertForm />

      <div className="space-y-3">
        {alerts.length === 0 && <p className="text-muted-foreground">No alerts yet. Create one above.</p>}
        {alerts.map((a) => (
          <Card key={a.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{a.symbol}</span>
                  <Badge variant="outline">{a.type}</Badge>
                  <Badge variant={a.status === 'ACTIVE' ? 'success' : a.status === 'TRIGGERED' ? 'default' : 'outline'}>
                    {a.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Notify via {a.channel} when price {COND_LABEL[a.condition] ?? a.condition}
                  {a.threshold != null ? ` ${a.threshold.toString()}` : ''}.
                  {a.note ? ` — ${a.note}` : ''}
                  {a.triggerCount > 0 ? ` (fired ${a.triggerCount}×)` : ''}
                </p>
              </div>
              <AlertActions id={a.id} status={a.status} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
