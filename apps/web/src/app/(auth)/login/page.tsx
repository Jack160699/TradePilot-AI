import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@tradepilot/ui';
import { signIn } from '@/lib/auth';
import { GoogleOneTap } from '@/components/auth/google-one-tap';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; verified?: string; reset?: string }>;
}) {
  const sp = await searchParams;
  const googleClientId = process.env.AUTH_GOOGLE_ID ?? '';
  async function authenticate(formData: FormData) {
    'use server';
    try {
      await signIn('credentials', {
        email: formData.get('email'),
        password: formData.get('password'),
        redirectTo: '/dashboard',
      });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect('/login?error=credentials');
      }
      throw error; // re-throw the framework redirect
    }
  }

  const notice =
    sp.verified === '1'
      ? { tone: 'ok', msg: 'Email verified. You can now log in.' }
      : sp.reset === '1'
        ? { tone: 'ok', msg: 'Password updated. Log in with your new password.' }
        : sp.error === 'credentials'
          ? { tone: 'err', msg: 'Invalid email or password.' }
          : null;

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle className="text-2xl">Welcome back</CardTitle></CardHeader>
        <CardContent>
          {notice && (
            <p className={`mb-4 rounded-md px-3 py-2 text-sm ${
              notice.tone === 'ok'
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-destructive/10 text-destructive'
            }`}>{notice.msg}</p>
          )}
          {googleClientId && (
            <div className="mb-4">
              <GoogleOneTap clientId={googleClientId} />
              <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
            </div>
          )}
          <form action={authenticate} className="space-y-4">
            <input name="email" type="email" required placeholder="Email"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
            <input name="password" type="password" required placeholder="Password"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
            <div className="text-right">
              <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full">Log in</Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account? <Link href="/register" className="text-primary">Register</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
