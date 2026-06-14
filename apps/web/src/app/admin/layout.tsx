import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';

const NAV = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/signals', label: 'Signals' },
  { href: '/admin/market-data', label: 'Market Data' },
  { href: '/admin/billing', label: 'Billing' },
  { href: '/admin/audit', label: 'Audit Log' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!(await hasPermission(session.user.id, 'admin:access'))) redirect('/dashboard');

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-card p-4">
        <span className="mb-6 block text-lg font-bold text-primary">Admin</span>
        <nav className="space-y-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
