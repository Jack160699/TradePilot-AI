import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tradepilot/db';
import { rateLimit } from '@/lib/rate-limit';
import { issueToken } from '@/lib/tokens';
import { sendMail, resetEmail, appUrl } from '@/lib/mail';
import { recordAudit } from '@/lib/audit';

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = await rateLimit(`forgot:${ip}`, 5, 300);
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const form = await req.formData();
  const parsed = schema.safeParse(Object.fromEntries(form));
  // Always respond the same way to avoid leaking which emails are registered.
  const redirectUrl = new URL('/forgot-password?sent=1', req.url);
  if (!parsed.success) return NextResponse.redirect(redirectUrl, 303);

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user) {
    const raw = await issueToken('reset', user.email, 60);
    const link = appUrl(`/reset-password?email=${encodeURIComponent(user.email)}&token=${raw}`);
    await sendMail(resetEmail(user.email, link));
    await recordAudit({ userId: user.id, action: 'UPDATE', resource: 'auth', resourceId: 'password-reset-request', ipAddress: ip });
  }
  return NextResponse.redirect(redirectUrl, 303);
}
