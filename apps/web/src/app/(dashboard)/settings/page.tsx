import { Card, CardContent, CardHeader, CardTitle } from '@tradepilot/ui';
import { prisma } from '@tradepilot/db';
import { auth } from '@/lib/auth';

export default async function SettingsPage() {
  const session = await auth();
  const prefs = await prisma.notificationPreference.findUnique({ where: { userId: session!.user.id } });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card>
        <CardHeader><CardTitle>Notification channels</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>Email: {prefs?.emailEnabled ? 'On' : 'Off'}</div>
          <div>Telegram: {prefs?.telegramEnabled ? 'On' : 'Off'}</div>
          <div>WhatsApp: {prefs?.whatsappEnabled ? 'On' : 'Off'}</div>
          <div>Min confidence: {((prefs?.minConfidence ?? 0.6) * 100).toFixed(0)}%</div>
        </CardContent>
      </Card>
    </div>
  );
}
