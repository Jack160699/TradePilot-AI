import { Card, CardContent, Badge } from '@tradepilot/ui';
import { prisma } from '@tradepilot/db';

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    include: { roles: { include: { role: true } }, subscription: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr><th className="p-3">Email</th><th className="p-3">Status</th><th className="p-3">Plan</th><th className="p-3">Roles</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b">
                <td className="p-3">{u.email}</td>
                <td className="p-3"><Badge variant={u.status === 'ACTIVE' ? 'success' : 'outline'}>{u.status}</Badge></td>
                <td className="p-3">{u.subscription?.plan ?? 'FREE'}</td>
                <td className="p-3">{u.roles.map((r) => r.role.name).join(', ') || 'USER'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
