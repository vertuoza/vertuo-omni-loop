import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// The fleets a workspace owner may give a runner to (PRD 1830 s3; ADR-0095): the workspace's teams that
// are not retired, read as the signed-in person, so row-level security hands a member their own
// workspace's only. Parsed where they come in; a refusal throws, naming the call.

export type FleetsDb = Pick<SupabaseClient, 'from'>;

const FleetRow = z.object({ name: z.string(), label: z.string() });

export function fleetsRepository(db: FleetsDb) {
  return {
    /** The workspace's fleets, in their order. */
    fleets: async (workspaceId: string): Promise<{ name: string; label: string }[]> => {
      const { data, error } = await db.from('teams').select('name, label').eq('workspace_id', workspaceId).is('retired_at', null).order('sort');
      if (error) throw new Error(`teams: ${error.message}`);
      return z.array(FleetRow).parse(data);
    },
  };
}
