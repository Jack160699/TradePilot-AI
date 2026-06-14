import { StrategyBuilder } from '@/components/strategy/builder';

export default function NewStrategyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Strategy Builder</h1>
        <p className="text-sm text-muted-foreground">
          Compose IF/THEN rules from technical indicators. Example: RSI(14) &lt; 30 AND Price &gt; EMA(200) → BUY.
        </p>
      </div>
      <StrategyBuilder />
    </div>
  );
}
