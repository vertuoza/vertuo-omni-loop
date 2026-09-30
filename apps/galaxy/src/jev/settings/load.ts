import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { memberWorkspace } from '../../data/workspace';
import { jevStore, type JevKeyStatus } from '../store';

// Settings › Jev's read (PRD 812 s1), as the signed-in person, so the database decides what it
// returns: their workspace (the one joined first, as /app's), whether they own it, and the key's
// status (whether one is stored; its last four and date for the owner only). A role that cannot be read
// reads as a member's.

export type JevLoad =
  | { kind: 'no-workspace' }
  | { kind: 'unreadable' }
  | { kind: 'jev'; workspace: { id: string; name: string }; owner: boolean; keyStatus: JevKeyStatus };

const why = (err: unknown) => (err instanceof Error ? err.message : String(err));

export async function loadJevPage(db: SupabaseClient, user: User): Promise<JevLoad> {
  try {
    const workspace = await memberWorkspace(db, user.id);
    if (!workspace) return { kind: 'no-workspace' };
    const store = jevStore(db as unknown as Parameters<typeof jevStore>[0]);
    const [owner, keyStatus] = await Promise.all([
      store.isOwner(workspace.id).catch((err: unknown) => {
        console.error(`jev: your role could not be read (${why(err)})`);
        return false;
      }),
      store.keyStatus(workspace.id),
    ]);
    return { kind: 'jev', workspace: { id: workspace.id, name: workspace.name }, owner, keyStatus };
  } catch (err) {
    console.error(`jev: the page could not be read (${why(err)})`);
    return { kind: 'unreadable' };
  }
}
