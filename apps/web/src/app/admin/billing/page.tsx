import { Card, CardContent, CardHeader, CardTitle } from '@tradepilot/ui';
import { prisma } from '@tradepilot/db';
import { formatCurrency } from '@/lib/utils';

export default async function AdminBillingPage() {
  const [payments, mrrAgg] = await Promise.all([
    prisma.payment.findMany({ where: { status: 'SUCCEEDED' }, orderBy: { createdAt: 'desc' }, take: 50, include: { user: true } }),
    prisma.payment.aggregate({ where: { status: 'SUCCEEDED' }, _sum: { amount: true } }),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Billing</h1>
      <Card>
        <CardHeader><CardTitle>Total collected</CardTitle></CardHeader>
        <CardContent><p className="text-3xl font-bold">{formatCurrency(mrrAgg._sum.amount ?? 0)}</p></CardContent>
      </Card>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr><th className="p-3">User</th><th className="p-3">Provider</th><th className="p-3">Amount</th><th className="p-3">Date</th></tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="p-3">{p.user.email}</td>
                <td className="p-3">{p.provider}</td>
                <td className="p-3">{formatCurrency(p.amount, p.currency.toUpperCase())}</td>
                <td className="p-3">{p.createdAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
