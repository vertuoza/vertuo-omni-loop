import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../../supabase/database.types.ts';
import { listOf } from '../../data/unparsed';

// The workspaces a stage event goes to: those whose GitHub org is the repository's owner, in any case,
// as repo_workspace() places a repository (supabase/migrations/20261004090000_workspace_gate.sql). Read
// as the service role: the event comes from omni-app, not from a signed-in person.

/** A GitHub login: letters, digits and hyphens, so it carries no pattern character. */
const LOGIN = /^[a-z\d][a-z\d-]{0,38}$/i;

export async function workspacesOwning(db: Pick<SupabaseClient<Database>, 'from'>, repository: string): Promise<string[]> {
  const owner = repository.split('/')[0]?.toLowerCase() ?? '';
  if (!LOGIN.test(owner)) return [];
  const { data, error } = await db.from('workspaces').select('id').ilike('github_org', owner);
  if (error) throw new Error(`Supabase refused to read the workspaces of ${owner}: ${error.message}`);
  return listOf(data).map((row) => row.id);
}
