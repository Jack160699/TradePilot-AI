import Link from 'next/link';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@tradepilot/ui';

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const sent = (await searchParams).sent === '1';
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle className="text-2xl">Reset your password</CardTitle></CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-sm text-muted-foreground">
              If an account exists for that email, we&apos;ve sent a reset link. Check your inbox
              (and server logs in development).
            </p>
          ) : (
            <form action="/api/auth/forgot-password" method="post" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your email and we&apos;ll send a link to reset your password.
              </p>
              <input name="email" type="email" required placeholder="Email"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
              <Button type="submit" className="w-full">Send reset link</Button>
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
