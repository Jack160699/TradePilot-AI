import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@tradepilot/db';
import { rateLimit } from '@/lib/rate-limit';
import { recordAudit } from '@/lib/audit';
import { issueToken } from '@/lib/tokens';
import { sendMail, verificationEmail, appUrl } from '@/lib/mail';

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

/**
 * Parse the request body regardless of how the client encoded it.
 *
 * The browser registration form posts `application/x-www-form-urlencoded`, but
 * API clients (and test harnesses) post JSON. Calling `req.formData()` on a JSON
 * body throws `TypeError: Could not parse content as FormData`, which — with no
 * surrounding try/catch — surfaced as HTTP 500. This accepts JSON, urlencoded,
 * multipart, and raw bodies.
 */
async function readBody(req: Request): Promise<Record<string, unknown>> {
  const contentType = (req.headers.get('content-type') ?? '').toLowerCase();
  if (contentType.includes('application/json')) {
    return (await req.json().catch(() => ({}))) as Record<string, unknown>;
  }
  if (contentType.includes('form-data') || contentType.includes('x-www-form-urlencoded')) {
    const form = await req.formData();
    return Object.fromEntries(form);
  }
  // Unknown/missing content-type: try JSON, then urlencoded.
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return Object.fromEntries(new URLSearchParams(text));
  }
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const wantsJson = (req.headers.get('content-type') ?? '').toLowerCase().includes('application/json');

  try {
    const rl = await rateLimit(`register:${ip}`, 5, 60);
    if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const parsed = schema.safeParse(await readBody(req));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (exists) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

    const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await bcrypt.hash(parsed.data.password, 12),
        status: 'ACTIVE',
        ...(userRole && { roles: { create: { roleId: userRole.id } } }),
        subscription: { create: { plan: 'FREE', status: 'ACTIVE' } },
        notificationPrefs: { create: {} },
      },
    });
    await recordAudit({ userId: user.id, action: 'CREATE', resource: 'user', resourceId: user.id, ipAddress: ip });

    // Issue an email-verification link (dev: logged; prod: sent via provider).
    const raw = await issueToken('verify', user.email, 60 * 24);
    const link = appUrl(`/api/auth/verify?email=${encodeURIComponent(user.email)}&token=${raw}`);
    await sendMail(verificationEmail(user.email, link));

    const next = `/verify-email?email=${encodeURIComponent(user.email)}`;
    // JSON callers get a 201 they can act on; browser form posts get a redirect.
    if (wantsJson) return NextResponse.json({ ok: true, userId: user.id, next }, { status: 201 });
    return NextResponse.redirect(new URL(next, req.url), 303);
  } catch (err) {
    // Surface the real cause in logs instead of an opaque 500.
    console.error('[register] unhandled error:', err);
    const message = err instanceof Error ? err.message : 'Registration failed';
    return NextResponse.json({ error: 'Registration failed', message }, { status: 500 });
  }
}
