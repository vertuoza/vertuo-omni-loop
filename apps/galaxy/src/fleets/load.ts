import { propertyOf } from 'omni-loop/kit/lib/narrow.ts';
import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import { loadFleets } from '../data/load-galaxy';
import { orEmpty, parseRows } from '../data/parse-rows';
import { memberWorkspace } from '../data/workspace';
import { BOARD_COLUMNS, StoredBoard } from './board-row';
import type { Fleet } from './model';
import { MASCOTS } from './store';

// /app/settings/fleets's read (PRD 400 s3), as the signed-in person, so row-level security decides what it
// returns: their workspace (the one joined first, as /app's), its fleets, retired ones included,
// whether they own it (is_owner(), s1) and the mascots an owner may pick (fleet_mascots(), s1). A role
// that cannot be read reads as a member's: the page then only shows, and the functions refuse anyone
// else anyway. Mascots that cannot be read are the known list. Each fleet's GitHub project board and
// the App's last note about it (PRD 2530) are read beside the fleets; a board that cannot be read leaves
// the fleets without one.

export type FleetsLoad =
  | { kind: 'no-workspace' }
  | { kind: 'unreadable' }
  | { kind: 'fleets'; workspace: { id: string; name: string }; owner: boolean; fleets: Fleet[]; mascots: readonly string[] };

const why = (err: unknown) => (err instanceof Error ? err.message : String(propertyOf(err, 'message') ?? err));

async function ownerOf(db: SupabaseClient<Database>, workspace: string): Promise<boolean> {
  try {
    const { data, error } = await db.rpc('is_owner', { workspace });
    if (error) throw error;
    // The answer as it came, unparsed: only a true makes an owner.
    const owner: unknown = data;
    return owner === true;
  } catch (err) {
    console.error(`fleets: your role could not be read (${why(err)})`);
    return false;
  }
}

async function mascotsOf(db: SupabaseClient<Database>): Promise<readonly string[]> {
  try {
    const { data, error } = await db.rpc('fleet_mascots');
    if (error) throw error;
    return Array.isArray(data) && data.every((m) => typeof m === 'string') ? data : MASCOTS;
  } catch (err) {
    console.error(`fleets: the mascots could not be read (${why(err)})`);
    return MASCOTS;
  }
}

/** The fleets of the workspace that have a board, by name. */
async function boardsOf(db: SupabaseClient<Database>, workspace: string): Promise<Map<string, NonNullable<Fleet['board']>>> {
  const boards = new Map<string, NonNullable<Fleet['board']>>();
  try {
    const { data, error } = await db.from('teams').select(BOARD_COLUMNS).eq('workspace_id', workspace);
    if (error) throw error;
    for (const row of orEmpty(parseRows(StoredBoard, data, 'fleets/load: teams boards'))) {
      if (row.project_url) boards.set(row.name, { url: row.project_url, note: row.project_note, notedAt: row.project_noted_at });
    }
  } catch (err) {
    console.error(`fleets: the boards could not be read (${why(err)})`);
  }
  return boards;
}

export async function loadFleetsPage(db: SupabaseClient<Database>, user: User): Promise<FleetsLoad> {
  try {
    const workspace = await memberWorkspace(db, user.id);
    if (!workspace) return { kind: 'no-workspace' };
    const [rows, boards, owner, mascots] = await Promise.all([loadFleets(db, workspace.id), boardsOf(db, workspace.id), ownerOf(db, workspace.id), mascotsOf(db)]);
    const fleets = rows.map((f): Fleet => { const board = boards.get(f.name); return board ? { ...f, board } : f; });
    return { kind: 'fleets', workspace: { id: workspace.id, name: workspace.name }, owner, fleets, mascots };
  } catch (err) {
    console.error(`fleets: the page could not be read (${why(err)})`);
    return { kind: 'unreadable' };
  }
}
