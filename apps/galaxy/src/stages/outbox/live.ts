import 'server-only';
import { serviceDb } from '../../data/sign-in-live';
import { githubStore } from '../../dossier/github/server';
import { liveRecountSummary } from '../../dossier/snapshot/live';
import { appCredentials } from '../../signup/github-app';
import { escalationReader, type EscalationRead } from '../sync/github';
import { stageStore } from '../store';
import { recountOutboxes, type RecountDeps, type RecountRef } from './recount';
import { prdOutboxStore } from './store';

// The recount's real deps (PRD 657, s5): each PRD's summary from its dossier's GitHub snapshot (PRD 902,
// s2, ../../dossier/snapshot/live.ts), refreshed in the background first when it is stale, and the
// service role's client (SUPABASE_SERVICE_ROLE_KEY) for the stored stages and prd_outbox, the one role
// that writes it. Each is made when a call first needs it, so a missing setting fails that call, which
// the caller logs. PRD 1794 (s5): the escalation record of each open feature PR, read as the Omni Loop
// App (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY) through the one reader this module keeps.

let escalation: EscalationRead | undefined;
const records = () => (escalation ??= escalationReader(appCredentials(), fetch, Date.now, githubStore()));

/** The GitHub summaries and the service role's outbox store, as the stages sync takes them. */
export function outboxDeps(): Pick<RecountDeps, 'summary' | 'store' | 'escalation'> {
  return {
    summary: (ref, workspace) => liveRecountSummary(workspace, ref),
    escalation: (ref) => records()(ref),
    store: {
      record: (rows, syncedAt) => prdOutboxStore(serviceDb()).record(rows, syncedAt),
      countsOf: (workspace, prds) => prdOutboxStore(serviceDb()).countsOf(workspace, prds),
      asking: (login) => prdOutboxStore(serviceDb()).asking(login),
    },
  };
}

/** Recounts the workspace's PRDs given, as the service role. */
export function recountLive(workspace: string, prds: readonly RecountRef[]): Promise<number> {
  return recountOutboxes(workspace, prds, { ...outboxDeps(), stages: stageStore(serviceDb()) });
}
