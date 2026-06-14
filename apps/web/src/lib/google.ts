/**
 * Server-side verification of a Google Identity Services ID token (the
 * `credential` returned by Google One Tap / Sign In With Google).
 *
 * Verified against Google's tokeninfo endpoint, then the audience (client id),
 * issuer, expiry, and email-verified claims are checked before we trust it.
 */
export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

interface TokenInfo {
  aud?: string;
  iss?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  exp?: string | number;
}

const VALID_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

/**
 * Verify a Google ID token. Returns the identity on success, or null when the
 * token is invalid, expired, for the wrong client, or unverified.
 */
export async function verifyGoogleIdToken(credential: string): Promise<GoogleIdentity | null> {
  const clientId = process.env.AUTH_GOOGLE_ID;
  if (!credential || !clientId) return null;

  let info: TokenInfo;
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    info = (await res.json()) as TokenInfo;
  } catch {
    return null;
  }

  if (info.aud !== clientId) return null;
  if (!info.iss || !VALID_ISSUERS.includes(info.iss)) return null;

  const exp = Number(info.exp ?? 0);
  if (!exp || exp * 1000 <= Date.now()) return null;

  const emailVerified = info.email_verified === true || info.email_verified === 'true';
  if (!info.email || !info.sub || !emailVerified) return null;

  return {
    sub: info.sub,
    email: info.email.toLowerCase(),
    emailVerified,
    name: info.name,
    picture: info.picture,
  };
}
