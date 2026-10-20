import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { memberSession } from '../../data/member-session';
import { memberWorkspace } from '../../data/workspace';

// Who the Constituents and Personas pages are drawn for (PRD 2240 s4), as the signed-in person: the
// demo, a member with their workspace (the database as them, so row-level security decides what each
// read returns), or nobody who can read.

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

/** What the browser needs to write, from a reader that can. */
export const writeSourceOf = (reader: Extract<KnowledgeReader, { kind: 'database' }>): WriteSource => ({
  kind: 'database', url: reader.env.url, key: reader.env.key, workspace: reader.workspace,
});
