// The Omni App told of its own jobs that ended (PRD 2898 s8): an e2e fallback job (`/omni:acceptance <prd> --pr <n>
// --sha <sha>`) the App queued for a gated feature PR's commit refreshes, once it ended, that pull request's `pr-ready`
// job on the App's ledger, due at once. The App's next run reads the job's result from its log tail and writes the
// `acceptance` check run of the commit (apps/omni-app/src/ready-check/).
//
//   installation   the one the job's workspace holds (`workspaces.github_installation_id`): the App reads the pull
//                  request as that installation, so a job is only ever told to its own workspace's App
//                  (BR-PRODUCT-63); a workspace with none refreshes nothing
//   refresh        `background_job_refresh`, kind `pr-ready`, keyed `<owner/name>#<number>` as the App keys it
//                  (kit/lib/runner/acceptance-line.ts › readyRefreshOf); its payload names the pull request and the
//                  commit, never a token (L-GDPR-2)
//
// Run after the response, as the service role: a wake never changes what a runner's report answers, and one that
// fails is logged and left to the App's own refreshes (a push, a CI run that ended).
import { readyRefreshOf } from 'omni-loop/kit/lib/runner/acceptance-line.ts';
import type { ReadyWakeStore } from './ready-wake.repository';
import type { AppJobEnded } from './runners.service';

/** The wake of an App job that ended: the `pr-ready` job of its pull request refreshed; whether it was. */
export function readyWake(store: ReadyWakeStore) {
  return async (job: AppJobEnded): Promise<boolean> => {
    const installationId = await store.installationOf(job.workspaceId);
    if (installationId === null) return false;
    const refresh = readyRefreshOf({ installationId, repo: job.repo, line: job.line });
    if (refresh === null) return false;
    await store.refresh(refresh);
    return true;
  };
}
