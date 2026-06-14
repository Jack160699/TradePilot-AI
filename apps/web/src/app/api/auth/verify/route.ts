import { NextResponse } from 'next/server';
import { prisma } from '@tradepilot/db';
import { consumeToken } from '@/lib/tokens';
import { recordAudit } from '@/lib/audit';

/** Email-verification link target: /api/auth/verify?email=..&token=.. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get('email') ?? '';
  const token = url.searchParams.get('token') ?? '';
  if (!email || !token) {
    return NextResponse.redirect(new URL('/verify-email?error=invalid', req.url), 303);
  }

  const valid = await consumeToken('verify', email, token);
  if (!valid) {
    return NextResponse.redirect(new URL('/verify-email?error=expired', req.url), 303);
  }

  const user = await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date(), status: 'ACTIVE' },
  });
  await recordAudit({ userId: user.id, action: 'UPDATE', resource: 'auth', resourceId: 'email-verified' });
  return NextResponse.redirect(new URL('/login?verified=1', req.url), 303);
}
