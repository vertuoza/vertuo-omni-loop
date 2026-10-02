import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseServer } from '../data/supabase-server';
import { memberWorkspace } from '../data/workspace';
import type { BusinessCountDb, BusinessCountDeps } from './business-count';

// The business count route's real deps: the signed-in person's own cookie session, and their workspace
// read as Settings › Business reads it (the one joined first), so the count matches the page it links to.
export function businessCountDeps(): BusinessCountDeps {
  return {
    db: async () => (await supabaseServer()) as unknown as BusinessCountDb, // ts-allow: the business count reads only the members BusinessCountDb names
    workspace: (db, user) => memberWorkspace(db as unknown as SupabaseClient, user), // ts-allow: memberWorkspace reads only `from`
  };
}
