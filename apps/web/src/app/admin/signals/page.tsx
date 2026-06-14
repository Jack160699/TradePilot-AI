import { Card, CardContent, Badge } from '@tradepilot/ui';
import { prisma } from '@tradepilot/db';

export default async function AdminSignalsPage() {
  const signals = await prisma.signal.findMany({
    include: { instrument: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Signals</h1>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr><th className="p-3">Symbol</th><th className="p-3">Dir</th><th className="p-3">Status</th><th className="p-3">Model</th><th className="p-3">Conf</th></tr>
          </thead>
          <tbody>
            {signals.map((s) => (
              <tr key={s.id} className="border-b">
                <td className="p-3">{s.instrument.symbol}</td>
                <td className="p-3"><Badge variant={s.direction === 'LONG' ? 'success' : 'danger'}>{s.direction}</Badge></td>
                <td className="p-3">{s.status}</td>
                <td className="p-3">{s.model}</td>
                <td className="p-3">{(s.confidence * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
