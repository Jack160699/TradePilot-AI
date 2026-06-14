import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@tradepilot/ui';
import { prisma } from '@tradepilot/db';
import { auth } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    include: { subscription: true, roles: { include: { role: true } } },
  });
  if (!user) redirect('/login');

  async function updateProfile(formData: FormData) {
    'use server';
    const s = await auth();
    const name = String(formData.get('name') ?? '').trim();
    if (!name) redirect('/profile?error=name');
    await prisma.user.update({ where: { id: s!.user.id }, data: { name } });
    await recordAudit({ userId: s!.user.id, action: 'UPDATE', resource: 'user', resourceId: 'profile' });
    revalidatePath('/profile');
    redirect('/profile?ok=profile');
  }

  async function changePassword(formData: FormData) {
    'use server';
    const s = await auth();
    const current = String(formData.get('current') ?? '');
    const next = String(formData.get('next') ?? '');
    if (next.length < 8) redirect('/profile?error=short');
    const u = await prisma.user.findUnique({ where: { id: s!.user.id } });
    if (!u?.passwordHash || !(await bcrypt.compare(current, u.passwordHash))) {
      redirect('/profile?error=current');
    }
    await prisma.user.update({
      where: { id: s!.user.id },
      data: { passwordHash: await bcrypt.hash(next, 12) },
    });
    await recordAudit({ userId: s!.user.id, action: 'UPDATE', resource: 'auth', resourceId: 'password-change' });
    redirect('/profile?ok=password');
  }

  const roles = user.roles.map((r) => r.role.name);
  const notice =
    sp.ok === 'profile' ? { tone: 'ok', msg: 'Profile updated.' }
    : sp.ok === 'password' ? { tone: 'ok', msg: 'Password changed.' }
    : sp.error === 'current' ? { tone: 'err', msg: 'Current password is incorrect.' }
    : sp.error === 'short' ? { tone: 'err', msg: 'New password must be at least 8 characters.' }
    : sp.error === 'name' ? { tone: 'err', msg: 'Name cannot be empty.' }
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>
      {notice && (
        <p className={`rounded-md px-3 py-2 text-sm ${
          notice.tone === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'
        }`}>{notice.msg}</p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{user.email}</span></div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email status</span>
              <Badge variant={user.emailVerified ? 'success' : 'outline'}>
                {user.emailVerified ? 'Verified' : 'Unverified'}
              </Badge>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span>{user.subscription?.plan ?? 'FREE'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Roles</span><span>{roles.join(', ') || 'USER'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Member since</span><span>{user.createdAt.toLocaleDateString()}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Edit profile</CardTitle></CardHeader>
          <CardContent>
            <form action={updateProfile} className="space-y-3">
              <label className="block text-sm text-muted-foreground">Display name</label>
              <input name="name" defaultValue={user.name ?? ''} required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
              <Button type="submit">Save changes</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
          <CardContent>
            <form action={changePassword} className="grid gap-3 md:grid-cols-2">
              <input name="current" type="password" required placeholder="Current password"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
              <input name="next" type="password" required minLength={8} placeholder="New password (min 8)"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
              <div><Button type="submit">Update password</Button></div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
