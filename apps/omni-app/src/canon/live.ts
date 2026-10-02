// The canon gate's live ports (PRD 839, PRD 871): the business and the constituents read as the service
// role, the judge call to galaxy (./judge.ts), and the small model through the kit's OpenRouter client
// (`kit/lib/openrouter.ts`).
//
// - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: the same as the pr-stats collector's. With either
//   unset the gate is neutral, "no business: the App cannot read businesses here".
// - `OPENROUTER_API_KEY`: with it unset the gate is neutral, "model not configured". The gate asks the
//   small model, CANON_MODEL, whatever `OPENROUTER_MODEL` names for the retro and the harvest.
// - `CONSTITUENT_JUDGE_SECRET` (PRD 871): the secret the judge call to galaxy is signed with, the same
//   on galaxy. With it unset, a product with constituents gets a neutral gate, "judge not configured".
//   Galaxy's host is `GALAXY_URL` when set, as for the stage events.
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { askModel, KEY_VAR, MODEL_CALL, MODEL_VAR } from 'vertuo-omni-plan/kit/lib/openrouter.ts';
import type { Database } from '../../../../supabase/database.types.ts';
import { type Ask, createCanon } from './canon.ts';
import { constituentJudge, JUDGE_SECRET_VAR, judgeUrl } from './judge.ts';
import { type Business, type Constituents, parseBusiness, parseConstituents } from './schema.ts';

/** The environment the gate reads: the database's address, the service role's key, the model's key, the judge's secret. */
const CanonEnvSchema = z.looseObject({
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  [KEY_VAR]: z.string().optional(),
  [JUDGE_SECRET_VAR]: z.string().optional(),
});

/** The small model galaxy's business draft and ask classifier use. */
export const CANON_MODEL = 'anthropic/claude-haiku-4.5';
/** One call, its retries and its repair, in a minute at most; the reply is short. */
const CANON_CALL = Object.freeze({ ...MODEL_CALL, budgetMs: 60_000, maxTokens: 2048 });

/** The Supabase connection a service-role read takes. */
type Connection = { url: string; key: string; fetch?: typeof globalThis.fetch | undefined };

/** The service role's client. */
function serviceClient({ url, key, fetch }: Connection) {
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(fetch ? { global: { fetch } } : {}),
  });
}

/** What the database's refusal says, with its code when it has one. */
const refused = (error: { message: string; code?: string }) => new Error(`the database refused: ${error.message}${error.code ? ` (${error.code})` : ''}`);

/**
 * `business_for_repo_app(repo)`, as the service role: the repository's confirmed claims, personas and
 * `updatedAt`. Throws when the database refuses, or answers a business of another shape.
 */
export function businessReader(connection: Connection) {
  const db = serviceClient(connection);
  return async (repo: string): Promise<Business | null> => {
    const { data, error } = await db.rpc('business_for_repo_app', { p_repo: repo });
    if (error) throw refused(error);
    return data === null ? null : parseBusiness(data);
  };
}

/**
 * `constituents_for_repo_app(repo)` (PRD 871), as the service role: the repository's product's live
 * Statement and Never lines and its `latestEventId`. Throws when the database refuses, or answers
 * constituents of another shape.
 */
export function constituentsReader(connection: Connection) {
  const db = serviceClient(connection);
  return async (repo: string): Promise<Constituents | null> => {
    const { data, error } = await db.rpc('constituents_for_repo_app', { p_repo: repo });
    if (error) throw refused(error);
    return data === null ? null : parseConstituents(data);
  };
}

/** The canon gate bound to `env`. One per warm instance, so its cache lives as long as the instance. */
export function canonFromEnv(env: Record<string, string | undefined> = process.env, { fetch = globalThis.fetch }: { fetch?: typeof globalThis.fetch } = {}) {
  const read = CanonEnvSchema.parse(env);
  const url = read.SUPABASE_URL;
  const key = read.SUPABASE_SERVICE_ROLE_KEY;
  const readBusiness = url && key ? businessReader({ url, key, fetch }) : () => Promise.resolve(null);
  const readConstituents = url && key ? constituentsReader({ url, key, fetch }) : () => Promise.resolve(null);
  const judge = constituentJudge({ url: judgeUrl(env), secret: read[JUDGE_SECRET_VAR], fetch });
  const modelEnv = { [KEY_VAR]: read[KEY_VAR], [MODEL_VAR]: CANON_MODEL };
  const ask: Ask = (request) => askModel({ ...request, env: modelEnv, fetch, call: CANON_CALL, title: 'omni loop canon' });
  return createCanon({ readBusiness, readConstituents, judge, ask });
}
