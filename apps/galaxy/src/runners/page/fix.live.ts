import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { serviceDb } from '../../data/sign-in-live';
import { supabaseEnv, supabaseServer } from '../../data/supabase-server';
import { serverEnv } from '../../env';
import { outboxStand } from '../../dossier/page/stage';
import { snapshotsOf } from '../../touched/store';
import { continuationsRepository, runnersRepository } from '../runners.repository';
import { continuationsService } from '../runners.service';
import type { FixDeps } from './fix';

// The real dependencies of Fix with answers (PRD 2270 s2), for /api/runners/jobs/<id>/fix: the page's
// session, and the continuation's rules over the service role's client. Null without a database or a
// service role: the route then answers 503.

/** Where a PRD's asked questions stand in its stored GitHub snapshot, as the service role reads it. */
export const standOf = (db: ReturnType<typeof serviceDb>) => async (workspaceId: string, repo: string, prd: PrdNumber) => {
  const found = (await snapshotsOf(db, workspaceId, repo)).find((snapshot) => snapshot.summary.prd === prd);
  return found ? outboxStand(found.summary) : null;
};

export function fixDeps(): FixDeps | null {
  if (!supabaseEnv() || serverEnv().serviceRole === null) return null;
  const db = serviceDb();
  const store = runnersRepository(db);
  const continuations = continuationsService(store, continuationsRepository(db));
  return {
    caller: async () => (await (await supabaseServer()).auth.getUser()).data.user?.id ?? null,
    job: async (id) => {
      const job = await store.job(id);
      return job ? { workspaceId: job.workspace_id, repo: job.repo, line: job.line } : null;
    },
    stand: standOf(db),
    continueAnswered: (request) => continuations.continueAnswered(request),
    log: (message) => { log.error({ event: 'runners', outcome: 'failed', message }); },
  };
}
