// The canon gate's live ports (PRD 839): the business read as the service role, and the small model
// through the kit's OpenRouter client (`kit/lib/openrouter.mjs`).
//
// - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: the same as the pr-stats collector's. With either
//   unset the gate is neutral, "no business: the App cannot read businesses here".
// - `OPENROUTER_API_KEY`: with it unset the gate is neutral, "model not configured". The gate asks the
//   small model, CANON_MODEL, whatever `OPENROUTER_MODEL` names for the retro and the harvest.
import { createClient } from '@supabase/supabase-js';
import { askModel, KEY_VAR, MODEL_CALL, MODEL_VAR } from 'vertuo-omni-plan/kit/lib/openrouter.mjs';
import { createCanon } from './canon.mjs';

/** The small model galaxy's business draft and ask classifier use. */
export const CANON_MODEL = 'anthropic/claude-haiku-4.5';
/** One call, its retries and its repair, in a minute at most; the reply is short. */
const CANON_CALL = Object.freeze({ ...MODEL_CALL, budgetMs: 60_000, maxTokens: 2048 });

/**
 * `business_for_repo_app(repo)`, as the service role: the repository's confirmed claims, personas and
 * `updatedAt`. Throws when the database refuses.
 * @param {{ url: string, key: string, fetch?: typeof fetch }} connection
 */
export function businessReader({ url, key, fetch = undefined }) {
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(fetch ? { global: { fetch } } : {}),
  });
  return async (repo) => {
    const { data, error } = await db.rpc('business_for_repo_app', { p_repo: repo });
    if (error) throw new Error(`the database refused: ${error.message}${error.code ? ` (${error.code})` : ''}`);
    return data;
  };
}

/** The canon gate bound to `env`. One per warm instance, so its cache lives as long as the instance. */
export function canonFromEnv(env = process.env, { fetch = globalThis.fetch } = {}) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const readBusiness = url && key ? businessReader({ url, key, fetch }) : async () => null;
  const modelEnv = { [KEY_VAR]: env[KEY_VAR], [MODEL_VAR]: CANON_MODEL };
  const ask = (request) => askModel({ ...request, env: modelEnv, fetch, call: CANON_CALL, title: 'omni loop canon' });
  return createCanon({ readBusiness, ask });
}
