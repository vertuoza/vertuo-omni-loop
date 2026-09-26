import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { supabaseEnv } from '../data/supabase-server';
import type { CliCallbackDeps, CliSession, TokenClient, TokenDeps } from './cli-code';

// The terminal's sign-in, wired to the real Supabase (src/ask/cli-code.ts says what each step does).
// Never a service key: the callback acts as the sign-in it just made, and /api/ask/token acts as
// nobody; the code table is reached only through its two functions. Without Supabase configured
// (the demo galaxy, a closed build) every step answers that ask mode is not available here.

type Env = { url: string; key: string };
type Cookie = { name: string; value: string };
type CookieToSet = Cookie & { options?: Record<string, unknown> };

const CODE_VERIFIER = /-code-verifier$/;

/** A client that keeps nothing: acting as nobody, or as `accessToken`. */
function detached({ url, key }: Env, accessToken?: string) {
  return createClient(url, key, {
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function revokeToken(env: Env, accessToken: string) {
  const { error } = await detached(env).auth.admin.signOut(accessToken, 'local');
  if (error) console.error(`ask cli sign-in: could not end a session: ${error.message}`);
}

/**
 * The callback's steps, reading only the PKCE code verifier from the browser's cookies (never its
 * own session, so the arcade's sign-in is neither read nor renewed) and writing no session back:
 * the new sign-in goes to the terminal, not to this browser. `spent` is the verifier's removal, for
 * the response to carry.
 */
export function cliCallbackDeps(cookies: Cookie[]): { deps: CliCallbackDeps; spent: CookieToSet[] } {
  const env = supabaseEnv();
  const spent: CookieToSet[] = [];
  const verifier = cookies.filter((cookie) => CODE_VERIFIER.test(cookie.name));
  const deps: CliCallbackDeps = {
    exchange: env
      ? async (code) => {
          const client = createServerClient(env.url, env.key, {
            cookies: {
              getAll: () => verifier,
              setAll(list) {
                for (const cookie of list) if (CODE_VERIFIER.test(cookie.name)) spent.push(cookie);
              },
            },
          });
          const { data, error } = await client.auth.exchangeCodeForSession(code);
          return { session: (data?.session as CliSession | null) ?? null, error: error ? { message: error.message } : null };
        }
      : null,
    async issue(session, codeHash) {
      if (!env) return { error: { message: 'no database' } };
      const { error } = await detached(env, session.access_token).rpc('ask_cli_code_issue', {
        p_code_hash: codeHash,
        p_refresh_token: session.refresh_token,
      });
      return { error: error ? { message: error.message } : null };
    },
    async revoke(session) {
      if (env) await revokeToken(env, session.access_token);
    },
  };
  return { deps, spent };
}

/** /api/ask/token's dependencies: a client acting as nobody. */
export function tokenDeps(): TokenDeps {
  const env = supabaseEnv();
  if (!env) return { connect: null };
  return {
    connect: (): TokenClient => {
      const client = detached(env);
      return {
        auth: { refreshSession: (current) => client.auth.refreshSession(current) },
        rpc: (fn, args) => client.rpc(fn, args),
      };
    },
    revoke: (accessToken) => revokeToken(env, accessToken),
  };
}
