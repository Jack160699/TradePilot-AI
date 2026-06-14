import { getProviderStatuses } from '@/lib/market-data';
import { MarketDataPanel } from '@/components/admin/market-data-panel';

export const dynamic = 'force-dynamic';

export default async function AdminMarketDataPage() {
  const { mode, providers } = await getProviderStatuses();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Market Data</h1>
        <p className="text-sm text-muted-foreground">
          Configure the live market-data provider used by the signal engine. Current mode: <strong>{mode}</strong>.
        </p>
      </div>
      <MarketDataPanel initialMode={mode} providers={providers} />
    </div>
  );
}
