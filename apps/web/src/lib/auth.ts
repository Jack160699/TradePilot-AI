import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from '@tradepilot/db';
import { z } from 'zod';
import { authConfig } from './auth.config';
import { getUserRoles } from './rbac';
import { recordAudit } from './audit';
import { verifyGoogleIdToken } from './google';

const credsSchema = z.object({ email: z.string().email(), password: z.string().min(8) });

// Google OAuth is optional — only register it when credentials are configured,
// otherwise Auth.js logs warnings for an unusable provider on every request.
const googleProvider =
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET })]
    : [];

/**
 * Full NextAuth instance (Node runtime). Spreads the edge-safe
 * `authConfig` and adds the Prisma adapter, providers, and the
 * Node-only jwt callback (which queries the database for roles).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...googleProvider,
    // Google One Tap — the GIS prompt posts an ID token (`credential`) which we
    // verify server-side, then find-or-create the user. jwt strategy + this
    // credentials provider means no DB session row is needed.
    Credentials({
      id: 'google-onetap',
      name: 'Google One Tap',
      credentials: { credential: {} },
      async authorize(raw) {
        const credential = typeof raw?.credential === 'string' ? raw.credential : '';
        const identity = await verifyGoogleIdToken(credential);
        if (!identity) return null;

        let user = await prisma.user.findUnique({ where: { email: identity.email } });
        if (!user) {
          const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
          user = await prisma.user.create({
            data: {
              email: identity.email,
              name: identity.name,
              image: identity.picture,
              emailVerified: new Date(),
              status: 'ACTIVE',
              ...(userRole && { roles: { create: { roleId: userRole.id } } }),
              subscription: { create: { plan: 'FREE', status: 'ACTIVE' } },
              notificationPrefs: { create: {} },
            },
          });
        }
        if (user.status === 'BANNED' || user.status === 'SUSPENDED') return null;
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        await recordAudit({ userId: user.id, action: 'LOGIN', resource: 'user', resourceId: user.id });
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok || user.status === 'BANNED' || user.status === 'SUSPENDED') return null;
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        await recordAudit({ userId: user.id, action: 'LOGIN', resource: 'user', resourceId: user.id });
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.roles = await getUserRoles(user.id);
      }
      return token;
    },
  },
});
