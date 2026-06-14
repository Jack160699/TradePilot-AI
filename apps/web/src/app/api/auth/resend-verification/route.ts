import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tradepilot/db';
import { rateLimit } from '@/lib/rate-limit';
import { issueToken } from '@/lib/tokens';
import { sendMail, verificationEmail, appUrl } from '@/lib/mail';

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = await rateLimit(`resend-verify:${ip}`, 3, 300);
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const form = await req.formData();
  const parsed = schema.safeParse(Object.fromEntries(form));
  const back = new URL(`/verify-email?email=${encodeURIComponent(parsed.success ? parsed.data.email : '')}`, req.url);
  if (!parsed.success) return NextResponse.redirect(back, 303);

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user && !user.emailVerified) {
    const raw = await issueToken('verify', user.email, 60 * 24);
    const link = appUrl(`/api/auth/verify?email=${encodeURIComponent(user.email)}&token=${raw}`);
    await sendMail(verificationEmail(user.email, link));
  }
  return NextResponse.redirect(back, 303);
}
