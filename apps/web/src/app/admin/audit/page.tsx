import { Card, CardContent } from '@tradepilot/ui';
import { prisma } from '@tradepilot/db';

export default async function AdminAuditPage() {
  const logs = await prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit Log</h1>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr><th className="p-3">Time</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Resource</th><th className="p-3">IP</th></tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="p-3">{l.createdAt.toISOString()}</td>
                <td className="p-3">{l.user?.email ?? 'system'}</td>
                <td className="p-3">{l.action}</td>
                <td className="p-3">{l.resource}{l.resourceId ? `:${l.resourceId.slice(0, 8)}` : ''}</td>
                <td className="p-3">{l.ipAddress ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
