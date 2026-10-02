import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { serviceDb } from '../data/sign-in-live';
import { supabaseEnv } from '../data/supabase-server';
import { installUrl } from '../signup/github-app';
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { CODE_TTL_MS, type CliCallbackDeps, type CliSession, type Placement, type TokenClient, type TokenDeps } from './cli-code';
import type { Database } from '../../../../supabase/database.types';

// The terminal's sign-in, wired to the real Supabase (src/ask/cli-code.ts says what each step does).
// The callback acts as the sign-in it just made, and /api/ask/token trades codes and tokens acting as
// nobody; the code table is reached through its two functions. The service role
// (SUPABASE_SERVICE_ROLE_KEY, server only) does two things only, both for PRD 459: it issues the code
// of a person in no workspace, whom ask_cli_code_issue() still refuses, and it asks repo_workspace()
// where the repository the terminal named goes, which no signed-in role may call. Without that key
// the first sign-in is not handed over and the second says nothing; the sign-in itself still works.
// Without Supabase configured (the demo galaxy, a closed build) every step answers that ask mode is
// not available here.

type Env = { url: string; key: string };
type Cookie = { name: string; value: string };
type CookieToSet = Cookie & { options?: Record<string, unknown> };

const CODE_VERIFIER = /-code-verifier$/;

/** A client that keeps nothing: acting as nobody, or as `accessToken`. */
function detached({ url, key }: Env, accessToken?: string) {
  return createClient<Database>(url, key, {
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
          const client = createServerClient<Database>(env.url, env.key, {
            cookies: {
              getAll: () => verifier,
              setAll(list) {
                for (const cookie of list) if (CODE_VERIFIER.test(cookie.name)) spent.push(cookie);
              },
            },
          });
          const { data, error } = await client.auth.exchangeCodeForSession(code);
          return { session: data?.session ?? null, error: error ? { message: error.message } : null };
        }
      : null,
    async issue(session, codeHash) {
      if (!env) return { error: { message: 'no database' } };
      const { error } = await detached(env, session.access_token).rpc('ask_cli_code_issue', {
        p_code_hash: codeHash,
        p_refresh_token: session.refresh_token,
      });
      return { error: error ? { message: error.message, code: error.code } : null };
    },
    async issueOutsideWorkspaces(session, codeHash) {
      try {
        const db = serviceDb();
        await db.from('ask_cli_codes').delete().lt('expires_at', new Date().toISOString());
        const { error } = await db.from('ask_cli_codes').insert({
          code_hash: codeHash,
          owner: session.user.id,
          refresh_token: session.refresh_token,
          expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
        });
        return { error: error ? { message: error.message } : null };
      } catch (error) {
        return { error: { message: error instanceof Error ? error.message : String(error) } };
      }
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
    place: placeRepo,
    installLink: installUrl(process.env.GITHUB_APP_SLUG),
  };
}

/** repo_workspace() for a person and a repository, as the service role, with the workspace's slug and name. */
async function placeRepo(userId: string, repo: string): Promise<Placement> {
  const db = serviceDb();
  const { data, error } = await db.rpc('repo_workspace', { person: userId, repo });
  if (error) throw new Error(`repo_workspace: ${error.message}`);
  const row: unknown = Array.isArray(data) ? data[0] : data;
  const workspaceId = propertyOf(row, 'workspace_id');
  const refusal = propertyOf(row, 'refusal');
  if (typeof workspaceId !== 'string' || !workspaceId) return { workspace: null, reason: typeof refusal === 'string' ? refusal : null };
  const { data: found, error: readError } = await db.from('workspaces').select('slug, name').eq('id', workspaceId).maybeSingle();
  if (readError || !found) throw new Error(`workspaces: ${readError?.message ?? 'not found'}`);
  return { workspace: { slug: String(found.slug), name: String(found.name) }, reason: null };
}
