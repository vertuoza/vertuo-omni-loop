import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '../../../../../supabase/database.types.ts';
import { memberWorkspace } from '../../data/workspace';
import { jevRecords, recordSince, type JevRecords } from '../record/record';
import { jevStore, type JevDecisionSettings, type JevKeyStatus } from '../store';

// Settings › Jev's read (PRD 812 s1), as the signed-in person, so the database decides what it
// returns: their workspace (the one joined first, as /app's), whether they own it, and the key's
// status (whether one is stored; its last four and date for the owner only), and the decisions' modes
// and tuning, which every member reads (PRD 812 s2), and each decision's record from the last 30 days
// of calls (PRD 812 s4). A role that cannot be read reads as a member's; calls that cannot be read
// leave the page without a record (null), never without its settings.

export type JevLoad =
  | { kind: 'no-workspace' }
  | { kind: 'unreadable' }
  | { kind: 'jev'; workspace: { id: string; name: string }; owner: boolean; keyStatus: JevKeyStatus; decisions: JevDecisionSettings[]; records: JevRecords | null };

const why = (err: unknown) => (err instanceof Error ? err.message : String(err));

export async function loadJevPage(db: SupabaseClient<Database>, user: User, now: Date = new Date()): Promise<JevLoad> {
  try {
    const workspace = await memberWorkspace(db, user.id);
    if (!workspace) return { kind: 'no-workspace' };
    const store = jevStore(db);
    const [owner, keyStatus, decisions, records] = await Promise.all([
      store.isOwner(workspace.id).catch((err: unknown) => {
        console.error(`jev: your role could not be read (${why(err)})`);
        return false;
      }),
      store.keyStatus(workspace.id),
      store.decisions(workspace.id),
      store.calls(workspace.id, recordSince(now)).then((calls) => jevRecords(calls, now), (err: unknown) => {
        console.error(`jev: the record could not be read (${why(err)})`);
        return null;
      }),
    ]);
    return { kind: 'jev', workspace: { id: workspace.id, name: workspace.name }, owner, keyStatus, decisions, records };
  } catch (err) {
    console.error(`jev: the page could not be read (${why(err)})`);
    return { kind: 'unreadable' };
  }
}
