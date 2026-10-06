import type { Exchange } from '../ask/page/sign-in';
import { settlingExchange } from './sign-in';
import { signInDeps } from './sign-in-live';
import { supabaseEnv, supabaseServer } from './supabase-server';

// The exchange a page's sign-in callback hands its return: the code becomes the session cookie, then
// the account joins the workspaces of its GitHub orgs and links GitHub (src/data/sign-in.ts). Null on
// a deployment without Supabase.

/** The exchange, its client opened only once a code comes in (ask, knowledge). */
export function codeExchange(): Exchange | null {
  if (!supabaseEnv()) return null;
  return async (code: string) => {
    const db = await supabaseServer();
    return settlingExchange((c) => db.auth.exchangeCodeForSession(c), db, signInDeps)(code);
  };
}

/** The exchange, its client opened at once (the history pages: /prd, /bugs, /visual). */
export async function openedExchange(): Promise<Exchange | null> {
  if (!supabaseEnv()) return null;
  const db = await supabaseServer();
  return settlingExchange((code) => db.auth.exchangeCodeForSession(code), db, signInDeps);
}
