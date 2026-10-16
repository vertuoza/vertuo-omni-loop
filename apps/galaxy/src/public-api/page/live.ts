import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '../../../../../supabase/database.types.ts';
import { memberWorkspace } from '../../data/workspace';
import { apiKeysServiceAs } from '../keys/api-keys.live';
import type { ApiKeysPageReads } from './load';

// Settings › API keys' real reads (PRD 2022 s1): the workspace, and the keys through their service, both
// as the signed-in person, so the migration's functions and row-level security decide what each returns.

export function apiKeysPageReads(db: SupabaseClient<Database>, user: Pick<User, 'id'>): ApiKeysPageReads {
  const service = apiKeysServiceAs(db);
  return {
    workspace: () => memberWorkspace(db, user.id),
    page: (workspace) => service.page(workspace),
  };
}
