import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@tradepilot/db';
import { rateLimit } from '@/lib/rate-limit';
import { consumeToken } from '@/lib/tokens';
import { recordAudit } from '@/lib/audit';

const schema = z.object({
  email: z.string().email(),
  token: z.string().min(16),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = await rateLimit(`reset:${ip}`, 10, 300);
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const form = await req.formData();
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return NextResponse.redirect(new URL('/reset-password?error=invalid', req.url), 303);
  }

  const valid = await consumeToken('reset', parsed.data.email, parsed.data.token);
  if (!valid) {
    return NextResponse.redirect(new URL('/reset-password?error=expired', req.url), 303);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.update({
    where: { email: parsed.data.email },
    data: { passwordHash },
  });
  await recordAudit({ userId: user.id, action: 'UPDATE', resource: 'auth', resourceId: 'password-reset', ipAddress: ip });
  return NextResponse.redirect(new URL('/login?reset=1', req.url), 303);
}
