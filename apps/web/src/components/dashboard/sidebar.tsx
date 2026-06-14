'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@tradepilot/ui';
import {
  LayoutDashboard, Radio, Wallet, FlaskConical, BarChart3, Settings,
  Workflow, CandlestickChart, BellRing,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/signals', label: 'My Signals', icon: Radio },
  { href: '/strategies', label: 'My Strategies', icon: Workflow },
  { href: '/portfolio', label: 'My Portfolio', icon: Wallet },
  { href: '/backtest', label: 'Backtests', icon: FlaskConical },
  { href: '/charts', label: 'Charts', icon: CandlestickChart },
  { href: '/alerts', label: 'Alerts', icon: BellRing },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 flex-col border-r bg-card p-4 md:flex">
      <Link href="/dashboard" className="mb-8 px-2 text-lg font-bold text-primary">TradePilot AI</Link>
      <nav className="space-y-1">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith(item.href) ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent',
            )}>
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
