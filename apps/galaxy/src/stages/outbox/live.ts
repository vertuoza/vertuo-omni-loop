import 'server-only';
import { serviceDb } from '../../data/sign-in-live';
import type { DossierRef } from '../../dossier/github/reader';
import { dossierGithub } from '../../dossier/github/server';
import { stageStore } from '../store';
import { recountOutboxes, type RecountDeps, type RecountRef } from './recount';
import { prdOutboxStore } from './store';

// The recount's real deps (PRD 657, s5): the server's one dossier GitHub reader, so its cache and its
// in-flight dedup are shared with the PRD pages, and the service role's client (SUPABASE_SERVICE_ROLE_KEY)
// for the stored stages and prd_outbox, the one role that writes it. Each is made when a call first
// needs it, so a missing setting fails that call, which the caller logs.

/** A dossier's summary through the server's reader; null when there is none. */
async function serverSummary(ref: DossierRef) {
  const reader = dossierGithub();
  return reader ? reader.summary(ref) : null;
}

/** The GitHub summaries and the service role's outbox store, as the stages sync takes them. */
export function outboxDeps(): Pick<RecountDeps, 'summary' | 'store'> {
  return {
    summary: serverSummary,
    store: {
      record: (rows, syncedAt) => prdOutboxStore(serviceDb()).record(rows, syncedAt),
      countsOf: (workspace, prds) => prdOutboxStore(serviceDb()).countsOf(workspace, prds),
    },
  };
}

/** Recounts the workspace's PRDs given, as the service role. */
export function recountLive(workspace: string, prds: readonly RecountRef[]): Promise<number> {
  return recountOutboxes(workspace, prds, { ...outboxDeps(), stages: stageStore(serviceDb()) });
}
