import 'server-only';
import { messageOf } from 'omni-loop/kit/lib/narrow.ts';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '../../../../../supabase/database.types.ts';
import { memberWorkspace } from '../../data/workspace';
import { virtualFleetsServiceAs } from '../../virtual-fleets/virtual-fleets.live';

/** The names of the AI fleets of the workspace the person joined first; none when they cannot be read, so a fleet then stays where it was asked. */
export async function aiFleetNames(db: SupabaseClient<Database>, user: Pick<User, 'id'>): Promise<string[]> {
  try {
    const workspace = await memberWorkspace(db, user.id);
    return workspace ? await virtualFleetsServiceAs(db).names(workspace.id) : [];
  } catch (error) {
    console.error(`fleet: the AI fleets could not be read (${messageOf(error)})`);
    return [];
  }
}
