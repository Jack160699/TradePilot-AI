import Link from 'next/link';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@tradepilot/ui';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const email = sp.email ?? '';
  const errorMsg =
    sp.error === 'expired'
      ? 'That verification link has expired.'
      : sp.error === 'invalid'
        ? 'That verification link is invalid.'
        : null;

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle className="text-2xl">Verify your email</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {errorMsg && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorMsg}</p>}
          <p className="text-sm text-muted-foreground">
            We&apos;ve sent a verification link{email ? ` to ${email}` : ''}. Click it to activate
            your account. In development the link is printed to the server logs.
          </p>
          {email && (
            <form action="/api/auth/resend-verification" method="post">
              <input type="hidden" name="email" value={email} />
              <Button type="submit" variant="outline" className="w-full">Resend verification email</Button>
            </form>
          )}
          <p className="text-center text-sm text-muted-foreground">
            Already verified? <Link href="/login" className="text-primary">Log in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
