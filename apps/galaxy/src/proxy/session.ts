import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import type { Database } from '../../../../supabase/database.types';
import { serverEnv } from '../env';

// Keeps the Supabase session fresh before a page renders (proxy.ts): an expired access token is
// refreshed here, and the new cookies go both to the render (request) and to the browser (response).
// It calls auth.getClaims(), which checks the JWT locally when the project signs with asymmetric keys
// and otherwise makes the same call to Supabase Auth as getUser() (PRD 657). Without Supabase
// configured (the demo galaxy) it does nothing.

export type SessionEnv = { url: string; key: string };

/** What the refresh asks of a Supabase server client: built with the cookies' getAll and setAll, it checks the claims. */
export type CreateClient = (url: string, key: string, options: { cookies: CookieMethodsServer }) => { auth: { getClaims(): Promise<unknown> } };

const createClient: CreateClient = (url, key, options) => createServerClient<Database>(url, key, options);

export async function refreshSession(
  request: NextRequest,
  env: SessionEnv | null,
  create: CreateClient = createClient,
): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  if (!env) return response;
  const supabase = create(env.url, env.key, {
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
  return serverEnv().supabase;
}
