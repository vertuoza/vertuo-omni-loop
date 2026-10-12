import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types';

// The terminal's sign-in's database calls (PRD 1318, s3; ADR-0095): the code table's two functions and
// its server-side write, and where a repository's calls go (repo_workspace() and the workspace's name).
// Each runs on the client it is handed: acting as nobody, as the new sign-in, or as the service role,
// as src/ask/cli-code-live.ts decides. No rule lives here: src/ask/cli-code.ts reads what comes back.

type Db = SupabaseClient<Database>;

/** A database function's answer, read unparsed. */
export type Called = { data: unknown; error: { message: string; code?: string } | null };

/** What redeeming a code asks of a client acting as nobody: public.ask_cli_code_redeem. */
export type CodeRedeemer = { rpc(fn: 'ask_cli_code_redeem', args: { p_code_hash: string }): PromiseLike<Called> };

/** Redeems (and so deletes) the code stored under `codeHash`. */
export const redeemCode = (client: CodeRedeemer, codeHash: string): PromiseLike<Called> =>
  client.rpc('ask_cli_code_redeem', { p_code_hash: codeHash });

/** `db`'s redeemer, as a client acting as nobody hands it to the token exchange. */
export const redeemerOf = (db: Db): CodeRedeemer => ({ rpc: (fn, args) => db.rpc(fn, args) });

/** Stores a code's hash with the session's refresh token, acting as that session (public.ask_cli_code_issue). */
export const issueCode = (db: Db, codeHash: string, refreshToken: string) =>
  db.rpc('ask_cli_code_issue', { p_code_hash: codeHash, p_refresh_token: refreshToken });

/** A code stored by the server (the service role), for a person the database refused for being in no
 * workspace: expired codes are cleared first. */
export async function storeCode(
  db: Db,
  row: { code_hash: string; owner: string; refresh_token: string; expires_at: string },
  now: Date,
): Promise<{ error: { message: string } | null }> {
  await db.from('ask_cli_codes').delete().lt('expires_at', now.toISOString());
  return db.from('ask_cli_codes').insert(row);
}

/** repo_workspace() for a person and a repository, as the service role. */
export const repoWorkspace = (db: Db, person: string, repo: string): PromiseLike<Called> => db.rpc('repo_workspace', { person, repo });

/** A workspace's slug and name, as the service role. */
export const workspaceNamed = (db: Db, id: string) => db.from('workspaces').select('slug, name').eq('id', id).maybeSingle();
