// The outboxes (supabase/migrations/20260929090000_outbox_answers.sql), written through the one
// function the migration writes for them: dossier_outbox_put(), which only the service role may call.
// It finds the dossier by PRD 216's key (the workspace whose github_org owns the repository, the
// repository, the PRD), creating it when there is none, keeps only a newer evaluation, and upserts.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { OutboxBody } from './contract';
import { storedOutbox } from './contract';

/** The database refused or failed; `code` is Postgres's: P0002 no workspace owns the repository's organisation. */
export class OutboxStoreError extends Error {
  constructor(what: string, readonly code: string | undefined, readonly reason: string) {
    super(`${what}: ${reason}`);
  }
}

export type OutboxPut = { id: string; stale: boolean };

export function outboxStore(db: Pick<SupabaseClient, 'rpc'>) {
  return {
    /** Stores the outbox the App sent: the dossier it went to, and whether it was older than the one kept. */
    async put(body: OutboxBody): Promise<OutboxPut> {
      const { data, error } = await db.rpc('dossier_outbox_put', {
        p_repo: body.repo,
        p_prd: body.prd,
        p_pr_number: body.pr.number,
        p_pr_url: body.pr.url,
        p_head_sha: body.pr.headSha,
        p_state: body.pr.state,
        p_outbox: storedOutbox(body),
        p_evaluated_at: body.evaluatedAt,
      });
      if (error) throw new OutboxStoreError('store the outbox', error.code, error.message);
      const put = data as Partial<OutboxPut> | null;
      if (!put || typeof put.id !== 'string') throw new OutboxStoreError('store the outbox', undefined, 'no dossier came back');
      return { id: put.id, stale: put.stale === true };
    },
  };
}

export type OutboxStore = ReturnType<typeof outboxStore>;
