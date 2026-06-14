import Link from 'next/link';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@tradepilot/ui';

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle className="text-2xl">Create your account</CardTitle></CardHeader>
        <CardContent>
          <form action="/api/auth/register" method="post" className="space-y-4">
            <input name="name" required placeholder="Full name"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
            <input name="email" type="email" required placeholder="Email"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
            <input name="password" type="password" required minLength={8} placeholder="Password (min 8 chars)"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
            <Button type="submit" className="w-full">Create account</Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Have an account? <Link href="/login" className="text-primary">Log in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
