import 'server-only';
import { serviceDb } from '../data/sign-in-live';
import { supabaseEnv } from '../data/supabase-server';
import { serverEnv } from '../env';
import { cliCallbackDeps, detached } from './cli-code-live';
import type { CliSession, KitExchange } from './cli-code';
import { kitBox, kitExchange, type KitMakeDeps, type KitStore } from './kit-token';
import { claimKitToken, makeKitToken, releaseKitToken, renewedKitToken } from './kit-token.repository';

// The kit token (src/ask/kit-token.ts says what each step does), wired to the real Supabase and the
// server's key, KIT_TOKEN_KEY (src/env.ts). The round trip makes the token acting as its fresh sign-in
// (kit_token_make()), and the exchange reads and writes the sealed session as the service role
// (SUPABASE_SERVICE_ROLE_KEY), the only role kit_token_claim(), _renewed() and _release() let in.
// Without the key, or without the service role, no token is made or traded here: both say so.

type Cookie = { name: string; value: string };

/** The token branch of the auth callback's steps: `omni signin`'s (./cli-code-live.ts) for the code and
 * the session, then kit_token_make() acting as that session. `join` joins the person's workspaces. */
export function kitMakeDeps(cookies: Cookie[], join: (session: CliSession) => Promise<unknown>) {
  const env = supabaseEnv();
  const { deps: signIn, spent } = cliCallbackDeps(cookies);
  const deps: KitMakeDeps = {
    exchange: signIn.exchange,
    join,
    // A token no exchange here could trade is not made: both need the key and the service role.
    box: serverEnv().serviceRole ? kitBox(serverEnv().kitTokenKey) : null,
    async make(session, row) {
      if (!env) return { expiresAt: null, error: { message: 'no database' } };
      const { data, error } = await makeKitToken(detached(env, session.access_token), row);
      if (error) return { expiresAt: null, error: { message: error.message, ...(error.code ? { code: error.code } : {}) } };
      const expiresAt = typeof data === 'object' && data !== null && 'expiresAt' in data ? data.expiresAt : null;
      return { expiresAt: typeof expiresAt === 'string' ? expiresAt : null, error: null };
    },
    revoke: signIn.revoke,
  };
  return { deps, spent };
}

/** The token store, as the service role: each call throws when the database fails. */
function store(): KitStore {
  const db = serviceDb();
  const thrown = (fn: string, error: { message: string }) => new Error(`${fn}: ${error.message}`);
  return {
    async claim(hash) {
      const { data, error } = await claimKitToken(db, hash);
      if (error) throw thrown('kit_token_claim', error);
      return data;
    },
    async renewed(token, lease, session) {
      const { data, error } = await renewedKitToken(db, token, lease, session);
      if (error) throw thrown('kit_token_renewed', error);
      return data === true;
    },
    async release(token, lease) {
      const { error } = await releaseKitToken(db, token, lease);
      if (error) throw thrown('kit_token_release', error);
    },
  };
}

/** /api/ask/token's `{omni_token}` exchange, or null when this deployment has no key or no service role. */
export function kitExchangeLive(): KitExchange | null {
  const { kitTokenKey, serviceRole } = serverEnv();
  const box = kitBox(kitTokenKey);
  if (!box || !serviceRole) return null;
  return kitExchange({ store: store(), box });
}
