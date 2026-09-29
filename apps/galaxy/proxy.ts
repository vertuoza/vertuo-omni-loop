import type { NextRequest } from 'next/server';
import { refreshSession, sessionEnv } from './src/proxy/session';

// Keeps the Supabase session fresh before every page render (src/proxy/session.ts). It does not run
// for the API's routes and polls, which read their own session, nor for Next's files and the static
// ones: fonts, stylesheets, scripts, images and the like (PRD 657).
export async function proxy(request: NextRequest) {
  return refreshSession(request, sessionEnv());
}

// Next reads this literal at build time: it cannot be imported from elsewhere.
export const config = {
  matcher: ['/((?!api(?:/|$)|_next/|favicon\\.ico$|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|css|js|map|woff|woff2|ttf|otf|txt|xml)$).*)'],
};
