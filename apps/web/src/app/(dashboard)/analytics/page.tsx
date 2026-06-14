import { Card, CardContent, CardHeader, CardTitle } from '@tradepilot/ui';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <Card>
        <CardHeader><CardTitle>Performance attribution</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Equity curve, drawdown, and per-instrument breakdowns render here from the analytics package.
        </CardContent>
      </Card>
    </div>
  );
}
