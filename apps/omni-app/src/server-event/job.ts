// `server-event` as a job of the ledger (PRD omni-loop-3 s4; PRD 1548 s4 and s8, acceptance 8): what the
// `serverEvent` function did, moved over. `/api/server-event` (./server-event.ts) refreshes one job per
// product PRD's dossier, keyed by the dossier's id, in no lane, with 4 tries, due 5 seconds on (PRD 2688's refresh,
// ../jobs/ledger.ts): a second event for the same dossier within 5 seconds joins the queued job, on its latest
// payload, as the debounce did. Its payload is the server event (`event`, `dossier`, `at`), never a token
// (L-GDPR-2). An approval, a void, an outbox item opened or one settled on the server re-posts the checks,
// `omni/approved` and the outbox check among them, on every open target pull request of that product PRD:
//
//   targets   its open pull requests, read from the database (./targets.ts), never listed from GitHub
//   pulls     each one read (one `GET` of that pull request, never a list): kept when its body names the PRD
//             (`Part of mobile-12`), with its head
//   recheck   the four checks' jobs of each kept pull request refreshed on the ledger (PRD 2688, `recheck`,
//             which ../jobs/pr-checks.ts gives), due at once: the outbox check, the inbox check, the approved check and the
//             budgets check, so an `item-settled` that answers a ceiling's raise turns `omni / budgets` green with
//             no new push (PRD 1679): each verdict is that check's alone. The worker running this job runs them
//             next, as it claims the jobs due (../jobs/worker.ts)
//
// The job reads the approval galaxy recorded and changes nothing in it (BL-APPROVALS-1): it never gives, voids or
// moves an approval, and never edits a file an approver read; it only runs the checks again so they show it. A job
// re-runs whole: refreshing a check's job twice runs it once more, on the same head. The installation's GitHub
// budget is shared with galaxy (PRD 902): a read it refuses is never sent, the job says so in one line, and the
// worker makes the job `waiting` until the pause or the window ends. A pull request GitHub answers 404 or 410 for
// (gone, or in a repository the App cannot read) is left out and said in the log, and the others are re-checked: it
// is permanent, so it never spends a try (bug #2764); any other failure, a 5xx among them, is thrown and retried.
// No targets' reader (the App cannot read the server here): the job ends `skipped`, saying why.
import { GithubDeferred, GithubPaused } from '@omni/github';
import { z } from 'zod';
import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { productPrdOf } from '../approved-check/state.ts';
import type { CheckRequestData } from '../jobs/payloads.ts';
import { REFRESH_DELAY_SECONDS, type RefreshJob } from '../jobs/ledger.ts';
import type { JobHandler, JobResult } from '../jobs/worker.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { readPull, type GitHubClient } from '../outbox-check/github.ts';
import { statusOf } from '../outbox-check/github-schema.ts';
import { noteTo } from '../run-log/run-log.ts';
import type { OpenPull, PrdTargets, TargetsReader } from './targets.ts';

export const SERVER_EVENT_KIND = 'server-event';

/** What the server says changed a product PRD. */
const SERVER_EVENT_KINDS = ['approved', 'voided', 'item-opened', 'item-settled'] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A server event, as galaxy posts it and as its job carries it. */
export const ServerEventSchema = z.object({
  event: z.enum(SERVER_EVENT_KINDS),
  dossier: z.string().regex(UUID),
  at: z.string().refine((at) => !Number.isNaN(Date.parse(at))),
});
export type ServerEvent = z.infer<typeof ServerEventSchema>;

/** The trigger the checks are told they run for. */
export const SERVER_EVENT_TRIGGER = 'server-event';

/** A server event's tries: the 4th that throws fails it. */
const MAX_TRIES = 4;

/** What GitHub answers for a pull request that is gone, or that the App cannot read: permanent, never retried. */
const GONE: ReadonlySet<unknown> = new Set([404, 410]);

/** A pull request kept: it names the PRD, at this head. */
type Kept = { repository: string; number: number; headSha: string };

/** The job of a server event: one per dossier, refreshed, so a burst of events re-checks once, from the last. */
export function serverEventJob({ event, dossier, at }: ServerEvent): RefreshJob {
  const id = dossier.toLowerCase();
  return { kind: SERVER_EVENT_KIND, key: id, subject: id, payload: { event, dossier, at }, maxTries: MAX_TRIES, delaySeconds: REFRESH_DELAY_SECONDS };
}

/** The budget's refusal `error` is, or wraps a few causes deep; null when it is none. */
function refusalIn(error: unknown, depth = 0): GithubPaused | GithubDeferred | null {
  if (error instanceof GithubPaused || error instanceof GithubDeferred) return error;
  return error instanceof Error && depth < 3 ? refusalIn(error.cause, depth + 1) : null;
}

/** Whether `pull`'s body names product PRD `prdId`, and its head; null when it names another or none. */
async function keptOf(octokit: GitHubClient, pull: OpenPull, prdId: string): Promise<Kept | null> {
  const [owner = '', repo = ''] = pull.repository.split('/');
  const read = await readPull(octokit, { owner, repo, prNumber: parsePr(pull.number) });
  return productPrdOf(read.body)?.id === prdId ? { ...pull, headSha: read.headSha } : null;
}

/** What `readTarget` answers for a pull request GitHub answers 404 or 410 for. */
const GONE_PULL = 'gone';

/**
 * Target `pull` read: kept when it names the PRD, null when it names another or none, `GONE_PULL` (said in the log)
 * when GitHub answers 404 or 410 for it. Anything else is thrown, a budget's refusal said in the log first.
 */
async function readTarget(
  { octokitFor, log }: { octokitFor: OctokitFor<GitHubClient>; log: (line: string) => void },
  { installationId, prdId }: PrdTargets,
  pull: OpenPull,
): Promise<Kept | null | typeof GONE_PULL> {
  const where = `${pull.repository}#${String(pull.number)}`;
  try {
    return await keptOf(await octokitFor(installationId), pull, prdId);
  } catch (error) {
    const status = statusOf(error);
    if (GONE.has(status)) {
      log(`server event: ${where} is left out: GitHub answers ${String(status)}, it is gone or the App cannot read it`);
      return GONE_PULL;
    }
    const refused = refusalIn(error);
    if (refused) log(`server event: ${where} waits for the GitHub budget: ${refused.message}`);
    throw error;
  }
}

export type ServerEventDeps = {
  octokitFor: OctokitFor<GitHubClient>;
  /** The targets' reader; null when the App cannot read the server here, which re-checks nothing. */
  readTargets: TargetsReader | null;
  /** Refreshes the four checks' jobs of a pull request on the ledger, due at once (../jobs/pr-checks.ts). */
  recheck: (request: CheckRequestData) => Promise<unknown>;
  log?: (line: string) => void;
};

/** The handler of the `server-event` kind. */
export function serverEventHandler({ octokitFor, readTargets, recheck, log = noteTo('server-event-recheck') }: ServerEventDeps): JobHandler {
  return async (job): Promise<JobResult> => {
    const { event: what, dossier } = ServerEventSchema.parse(job.payload);
    if (!readTargets) {
      log(`server event: the ${what} of dossier ${dossier} re-checks nothing: the App cannot read the server here`);
      return { outcome: 'skipped', reason: 'the App cannot read the server here' };
    }
    const targets = await readTargets(dossier);
    if (!targets) return { outcome: 'skipped', reason: `dossier ${dossier} is no product PRD's` };

    const kept: Kept[] = [];
    let leftOut = 0;
    for (const pull of targets.pulls) {
      const found = await readTarget({ octokitFor, log }, targets, pull);
      if (found === GONE_PULL) leftOut += 1;
      else if (found) kept.push(found);
    }
    if (kept.length === 0) {
      const gone = leftOut === 0 ? '' : ` (${String(leftOut)} left out: GitHub answers 404 or 410 for them)`;
      return { outcome: 'skipped', reason: `no open pull request names ${targets.prdId}${gone}` };
    }

    for (const { repository, number, headSha } of kept) {
      const [owner = '', repo = ''] = repository.split('/');
      const request = { installationId: targets.installationId, owner, repo, repository, prNumber: parsePr(number), headSha, trigger: SERVER_EVENT_TRIGGER };
      await recheck(request);
    }
    return { outcome: 'done' };
  };
}
