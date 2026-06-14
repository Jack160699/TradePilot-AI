import type { NextAuthConfig } from 'next-auth';

const PROTECTED = [
  '/dashboard', '/signals', '/strategies', '/portfolio', '/backtest',
  '/charts', '/alerts', '/analytics', '/settings', '/profile',
];
const ADMIN = ['/admin'];

/**
 * Edge-safe NextAuth configuration. Contains NO Node-only imports
 * (no Prisma adapter, no bcrypt, no ioredis) so it can run inside
 * middleware on the Edge runtime. The full config in `auth.ts`
 * spreads this and adds the adapter + providers + jwt callback.
 */
export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  trustHost: true,
  providers: [], // real providers are added in auth.ts (Node runtime)
  callbacks: {
    /** Route protection — runs in middleware. */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const roles = (auth?.user as { roles?: string[] } | undefined)?.roles ?? [];
      const path = nextUrl.pathname;

      if (ADMIN.some((p) => path.startsWith(p))) {
        if (!isLoggedIn) return false; // → redirect to signIn
        if (!roles.includes('ADMIN')) {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }
        return true;
      }
      if (PROTECTED.some((p) => path.startsWith(p))) {
        return isLoggedIn; // false → redirect to signIn
      }
      return true;
    },
    /** Pure session shaping — safe on the Edge. */
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        (session.user as { roles?: string[] }).roles = (token.roles as string[]) ?? [];
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
