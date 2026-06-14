import { randomBytes, createHash } from 'node:crypto';
import { prisma } from '@tradepilot/db';

/** Namespaced identifiers keep verify vs. reset tokens in separate keyspaces. */
export type TokenPurpose = 'verify' | 'reset';

function scoped(purpose: TokenPurpose, email: string): string {
  return `${purpose}:${email.toLowerCase()}`;
}

/** SHA-256 of the raw token — only the hash is persisted, never the secret. */
function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Issue a single-use token for a purpose+email. Any prior tokens for the same
 * scope are invalidated. Returns the raw token to embed in the emailed link.
 */
export async function issueToken(
  purpose: TokenPurpose,
  email: string,
  ttlMinutes = 60,
): Promise<string> {
  const identifier = scoped(purpose, email);
  const raw = randomBytes(32).toString('hex');
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: {
      identifier,
      token: hashToken(raw),
      expires: new Date(Date.now() + ttlMinutes * 60_000),
    },
  });
  return raw;
}

/**
 * Validate and consume a token. Returns true exactly once for a valid,
 * unexpired token, then deletes it (single use).
 */
export async function consumeToken(
  purpose: TokenPurpose,
  email: string,
  raw: string,
): Promise<boolean> {
  const identifier = scoped(purpose, email);
  const token = hashToken(raw);
  const record = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier, token } },
  });
  if (!record) return false;
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier, token } },
  });
  if (record.expires < new Date()) return false;
  return true;
}
