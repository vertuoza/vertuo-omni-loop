import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import type { FleetRow } from '../arcade/types';
import { loadFleets } from '../data/load-galaxy';
import { memberWorkspace } from '../data/workspace';
import { MASCOTS } from './store';

// /app/settings/fleets's read (PRD 400 s3), as the signed-in person, so row-level security decides what it
// returns: their workspace (the one joined first, as /app's), its fleets, retired ones included,
// whether they own it (is_owner(), s1) and the mascots an owner may pick (fleet_mascots(), s1). A role
// that cannot be read reads as a member's: the page then only shows, and the functions refuse anyone
// else anyway. Mascots that cannot be read are the known list.

export type FleetsLoad =
  | { kind: 'no-workspace' }
  | { kind: 'unreadable' }
  | { kind: 'fleets'; workspace: { id: string; name: string }; owner: boolean; fleets: FleetRow[]; mascots: readonly string[] };

const why = (err: unknown) => (err instanceof Error ? err.message : String(propertyOf(err, 'message') ?? err));

async function ownerOf(db: SupabaseClient<Database>, workspace: string): Promise<boolean> {
  try {
    const { data, error } = await db.rpc('is_owner', { workspace });
    if (error) throw error;
    return data === true;
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

export async function loadFleetsPage(db: SupabaseClient<Database>, user: User): Promise<FleetsLoad> {
  try {
    const workspace = await memberWorkspace(db, user.id);
    if (!workspace) return { kind: 'no-workspace' };
    const [fleets, owner, mascots] = await Promise.all([loadFleets(db, workspace.id), ownerOf(db, workspace.id), mascotsOf(db)]);
    return { kind: 'fleets', workspace: { id: workspace.id, name: workspace.name }, owner, fleets, mascots };
  } catch (err) {
    console.error(`fleets: the page could not be read (${why(err)})`);
    return { kind: 'unreadable' };
  }
}
