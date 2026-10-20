import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RosterRow } from '../../business/constituents-rows';
import { memberSession } from '../../data/member-session';
import { parseRows } from '../../data/parse-rows';
import { memberWorkspace } from '../../data/workspace';

// What the Constituents and Personas pages read besides their rows (PRD 2240 s4), as the signed-in
// person: the workspace they play in, and the GitHub login of every member, so a row can say who created
// it. A roster that cannot be read leaves every author as "a member": never a page that does not open.

/** Where the browser writes: the demo's memory, or the database as the signed-in person (the publishable
 * key only, as Settings › Business sent it). */
export type WriteSource = { kind: 'demo' } | { kind: 'database'; url: string; key: string; workspace: string };

export type KnowledgeReader =
  | { kind: 'demo' }
  | { kind: 'database'; db: SupabaseClient; me: string; env: { url: string; key: string }; workspace: string }
  | { kind: 'unreadable' };

/** Who the pages are drawn for: the demo, a member with their workspace, or nobody who can read. */
export async function knowledgeReader(): Promise<KnowledgeReader> {
  const session = await memberSession();
  if (session.kind !== 'signed-in') return session.kind === 'demo' ? { kind: 'demo' } : { kind: 'unreadable' };
  const workspace = await memberWorkspace(session.db, session.user.id);
  if (!workspace) return { kind: 'unreadable' };
  return { kind: 'database', db: session.db, me: session.user.id, env: session.env, workspace: workspace.id };
}

/** The slice of a Supabase client the roster read needs. */
type RosterDb = { rpc(fn: 'workspace_roster', args: { workspace: string }): PromiseLike<{ data: unknown; error: { message: string } | null }> };

/** The GitHub login of each member that has one, by account id. */
const loginMap = (roster: readonly { user_id: string; github_login: string | null }[]): Record<string, string> =>
  Object.fromEntries(roster.flatMap((r) => (r.github_login === null ? [] : [[r.user_id, r.github_login] as const])));

/** Each member's GitHub login by account id; a member with none is left out. */
export async function loginsOf(db: RosterDb, workspace: string): Promise<Record<string, string>> {
  try {
    const { data, error } = await db.rpc('workspace_roster', { workspace });
    if (error) throw new Error(error.message);
    const roster = parseRows(RosterRow, data, 'product-knowledge/authors: workspace_roster');
    return roster.ok ? loginMap(roster.value) : {};
  } catch (err) {
    console.error(`product-knowledge: could not read the members (${String(err)})`);
    return {};
  }
}

/** What the browser needs to write, from a reader that can. */
export const writeSourceOf = (reader: Extract<KnowledgeReader, { kind: 'database' }>): WriteSource => ({
  kind: 'database', url: reader.env.url, key: reader.env.key, workspace: reader.workspace,
});
