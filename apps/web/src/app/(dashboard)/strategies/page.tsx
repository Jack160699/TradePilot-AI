import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@tradepilot/ui';
import { prisma } from '@tradepilot/db';
import { auth } from '@/lib/auth';
import { StrategyActions } from '@/components/strategy/strategy-actions';
import { RunEngineButton } from '@/components/strategy/run-engine-button';

export const dynamic = 'force-dynamic';

interface RuleCondition {
  left: { kind: string; indicator?: string; period?: number; value?: number };
  op: string;
  right: { kind: string; indicator?: string; period?: number; value?: number };
}
interface RuleConfig {
  logic?: string;
  direction?: string;
  conditions?: RuleCondition[];
  stopLossPct?: number;
  takeProfitPct?: number;
}

const OP_LABEL: Record<string, string> = {
  GT: '>', LT: '<', GTE: '>=', LTE: '<=', CROSSES_ABOVE: 'crosses above', CROSSES_BELOW: 'crosses below',
};

function operand(o: RuleCondition['left']): string {
  if (o.kind === 'value') return String(o.value);
  return o.period ? `${o.indicator}(${o.period})` : String(o.indicator);
}

function describe(cfg: RuleConfig): string {
  if (!cfg.conditions?.length) return 'No conditions';
  return cfg.conditions
    .map((c) => `${operand(c.left)} ${OP_LABEL[c.op] ?? c.op} ${operand(c.right)}`)
    .join(` ${cfg.logic ?? 'AND'} `);
}

export default async function StrategiesPage() {
  const session = await auth();
  const strategies = await prisma.strategy.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">My Strategies</h1>
        <div className="flex items-center gap-3">
          <RunEngineButton />
          <Link href="/strategies/new"><Button>+ New strategy</Button></Link>
        </div>
      </div>

      {strategies.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No strategies yet. Build your first IF/THEN rule set to start generating signals.
            <div className="mt-4"><Link href="/strategies/new"><Button>Create a strategy</Button></Link></div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {strategies.map((s) => {
          const cfg = (s.config ?? {}) as RuleConfig;
          return (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{s.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={cfg.direction === 'SHORT' ? 'danger' : 'success'}>{cfg.direction ?? 'LONG'}</Badge>
                    <Badge variant={s.enabled ? 'default' : 'outline'}>{s.enabled ? 'Enabled' : 'Disabled'}</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div>{s.symbol} · {s.timeframe}</div>
                <div className="rounded-md bg-accent/50 p-2 text-xs">IF {describe(cfg)}</div>
                <div>
                  SL {((cfg.stopLossPct ?? 0) * 100).toFixed(1)}% · TP {((cfg.takeProfitPct ?? 0) * 100).toFixed(1)}%
                  {s.lastRunAt && <> · last run {new Date(s.lastRunAt).toLocaleString()}</>}
                </div>
                <StrategyActions id={s.id} enabled={s.enabled} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
