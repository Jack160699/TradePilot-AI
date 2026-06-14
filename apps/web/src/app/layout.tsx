import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TradePilot AI — AI Trading Signals',
  description: 'Production-grade AI trading signals, backtesting, and portfolio analytics.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
