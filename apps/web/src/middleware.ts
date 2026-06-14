import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

// Edge-safe: only the adapter-free authConfig is loaded here.
// Route protection lives in authConfig.callbacks.authorized.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
