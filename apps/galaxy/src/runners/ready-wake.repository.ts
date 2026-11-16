// The ready wake's reads and writes (PRD 2898 s8, ./ready-wake.ts), as the service role: the installation a workspace
// holds, and the refresh of the App's `pr-ready` job on its ledger (`background_job_refresh`).
import type { readyRefreshOf } from 'omni-loop/kit/lib/runner/acceptance-line.ts';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

/** What the wake reads and writes, as the service role. */
export type ReadyWakeStore = {
  installationOf(workspaceId: string): Promise<number | null>;
  refresh(job: NonNullable<ReturnType<typeof readyRefreshOf>>): Promise<void>;
};

const InstallationRow = z.object({ github_installation_id: z.number().int().positive().nullable() });
const Refreshed = z.enum(['added', 'updated', 'again', 'requeued']);

/** The store over the service role's client. */
export function readyWakeStore(db: Pick<SupabaseClient, 'from' | 'rpc'>): ReadyWakeStore {
  return {
    async installationOf(workspaceId) {
      const { data, error } = await db.from('workspaces').select('github_installation_id').eq('id', workspaceId).limit(1);
      if (error) throw new Error(`Supabase: could not read the workspace's installation (${error.message})`);
      const [row] = z.array(InstallationRow).parse(data);
      return row?.github_installation_id ?? null;
    },
    async refresh({ kind, key, subject, payload, delaySeconds }) {
      const answer: { data: unknown; error: { message: string } | null } = await db.rpc('background_job_refresh', { p_kind: kind, p_key: key, p_subject: subject, p_payload: payload, p_delay_seconds: delaySeconds });
      if (answer.error) throw new Error(`Supabase: could not refresh the ready check's job (${answer.error.message})`);
      Refreshed.parse(answer.data);
    },
  };
}
