import Link from 'next/link';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@tradepilot/ui';
import { Activity, BarChart3, Bell, ShieldCheck, Cpu, LineChart } from 'lucide-react';

const FEATURES = [
  { icon: Cpu, title: 'AI Signal Engine', desc: 'GPT-powered, risk-managed trade proposals with confidence scoring.' },
  { icon: LineChart, title: 'Backtesting', desc: 'Event-driven engine with Sharpe, drawdown, and win-rate analytics.' },
  { icon: BarChart3, title: 'Portfolio Tracker', desc: 'Live P&L, position sizing, and performance attribution.' },
  { icon: Bell, title: 'Multi-channel Alerts', desc: 'Telegram, WhatsApp, email and in-app delivery in real time.' },
  { icon: ShieldCheck, title: 'Enterprise Security', desc: 'RBAC, audit logs, rate limiting, and 2FA out of the box.' },
  { icon: Activity, title: 'TradingView Charts', desc: 'Embedded advanced charts with indicator overlays.' },
];

const PLANS = [
  { name: 'Free', price: '$0', features: ['3 signals/day', '5 backtests/mo', '1 portfolio'] },
  { name: 'Pro', price: '$29', features: ['50 signals/day', '100 backtests/mo', 'Telegram alerts'], highlight: true },
  { name: 'Elite', price: '$99', features: ['Unlimited signals', 'WhatsApp alerts', '25 portfolios'] },
];

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6">
      <nav className="flex items-center justify-between py-6">
        <span className="text-xl font-bold text-primary">TradePilot AI</span>
        <div className="flex gap-3">
          <Link href="/login"><Button variant="ghost">Log in</Button></Link>
          <Link href="/register"><Button>Get started</Button></Link>
        </div>
      </nav>

      <section className="py-24 text-center">
        <Badge variant="success" className="mb-4">Now with GPT-4o signal engine</Badge>
        <h1 className="mx-auto max-w-3xl text-5xl font-bold tracking-tight">
          AI trading signals that actually manage risk
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          TradePilot AI generates risk-managed signals, backtests strategies, tracks your portfolio,
          and alerts you across every channel — all in one platform.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link href="/register"><Button size="lg">Start free</Button></Link>
          <Link href="/signals"><Button size="lg" variant="outline">View live signals</Button></Link>
        </div>
      </section>

      <section className="grid gap-6 py-16 md:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <f.icon className="h-8 w-8 text-primary" />
              <CardTitle className="mt-2">{f.title}</CardTitle>
            </CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{f.desc}</p></CardContent>
          </Card>
        ))}
      </section>

      <section className="py-16">
        <h2 className="mb-10 text-center text-3xl font-bold">Simple, transparent pricing</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((p) => (
            <Card key={p.name} className={p.highlight ? 'border-primary' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {p.name} {p.highlight && <Badge variant="success">Popular</Badge>}
                </CardTitle>
                <p className="text-3xl font-bold">{p.price}<span className="text-sm text-muted-foreground">/mo</span></p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {p.features.map((feat) => <li key={feat}>✓ {feat}</li>)}
                </ul>
                <Link href="/register"><Button className="mt-6 w-full">Choose {p.name}</Button></Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} TradePilot AI. All rights reserved.
      </footer>
    </main>
  );
}
