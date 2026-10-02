import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '../../../../supabase/database.types';

// Keeps the Supabase session fresh before a page renders (proxy.ts): an expired access token is
// refreshed here, and the new cookies go both to the render (request) and to the browser (response).
// It calls auth.getClaims(), which checks the JWT locally when the project signs with asymmetric keys
// and otherwise makes the same call to Supabase Auth as getUser() (PRD 657). Without Supabase
// configured (the demo galaxy) it does nothing.

export type SessionEnv = { url: string; key: string };

export async function refreshSession(
  request: NextRequest,
  env: SessionEnv | null,
  create: typeof createServerClient = createServerClient,
): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  if (!env) return response;
  const supabase = create<Database>(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}

/** The database's public settings, or null for the demo galaxy. */
export function sessionEnv(): SessionEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}
