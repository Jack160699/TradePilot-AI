import Link from 'next/link';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@tradepilot/ui';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string; error?: string }>;
}) {
  const { email = '', token = '', error } = await searchParams;
  const invalid = !email || !token;
  const errorMsg =
    error === 'expired'
      ? 'That reset link has expired. Request a new one.'
      : error === 'invalid'
        ? 'Invalid reset request. Please check the link.'
        : null;

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle className="text-2xl">Choose a new password</CardTitle></CardHeader>
        <CardContent>
          {errorMsg && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorMsg}</p>}
          {invalid ? (
            <p className="text-sm text-muted-foreground">
              This page requires a valid reset link. <Link href="/forgot-password" className="text-primary">Request one</Link>.
            </p>
          ) : (
            <form action="/api/auth/reset-password" method="post" className="space-y-4">
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="token" value={token} />
              <input name="password" type="password" required minLength={8}
                placeholder="New password (min 8 chars)"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
              <Button type="submit" className="w-full">Update password</Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-primary">Back to login</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
