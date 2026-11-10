// The pull-request checks on the job ledger (PRD 2688 s7, spec "What refreshes the jobs"): the four kinds, one job
// per pull request and check, and the one worker every runner of the ledger runs.
//
//   the kinds        `pr-outbox`, `pr-inbox`, `pr-approved` and `pr-budgets`, each the body of today's check moved
//                    over (../outbox-check/job.ts, ../inbox-check/inbox-check.ts, ../approved-check/approved-job.ts,
//                    ../budgets-check/job.ts), with its failure hook
//   the job          keyed `<owner/name>#<number>`, lower case; its payload the check request (installation,
//                    repository, pull request, head commit), never a token (L-GDPR-2). It is refreshed, never
//                    added: the latest event wins, due 5 seconds after it (../jobs/ledger.ts)
//   a re-run         GitHub's Re-run button refreshes only the job of the check run's kind, told by its
//                    `external_id`, as the webhook told its event before; any other check run is the outbox's
//   the approval     the approved label put on or taken off a PRD's issue refreshes the `pr-approved` job of each
//                    open pull request of that PRD, read from GitHub (../approved-check/github.ts)
//   the worker       the handlers and failure hooks of every kind the ledger holds, the knowledge pack's and the
//                    scheduled ones' included (`pr-stats` and `escalation`, PRD omni-loop-3 s2, ./schedule.ts), and
//                    the two the webhook adds, `fix-row-stamp` and `fleet-board` (PRD omni-loop-3 s3): the webhook, the server event's recheck and the sweep all run the same jobs, so each runs every
//                    kind, and none spends a try on a job it has no handler for
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { askJudge } from '../approved-check/judge-client.ts';
import { APPROVED_KIND, approvedFailure, approvedHandler } from '../approved-check/approved-job.ts';
import { approvedPullsOf } from '../approved-check/approved-check.ts';
import { recordReader, type RecordReader } from '../approved-check/record.ts';
import type { AskJudge } from '../approved-check/repo-reading.ts';
import { BUDGETS_KIND, budgetsFailureHook, budgetsHandler } from '../budgets-check/job.ts';
import { outboxRowsReader, type OutboxRowsReader } from '../budgets-check/raises.ts';
import { liveCanon } from '../canon/live.ts';
import { DEFAULT_GALAXY_URL, type AppEnv, type SupabaseEnv } from '../env.ts';
import { ESCALATION_KIND, escalationHandler } from '../escalation/job.ts';
import { FIX_ROW_STAMP_KIND, fixRowStampHandler } from '../fix-rows/job.ts';
import { fixRowStamper } from '../fix-rows/stamp.ts';
import { FLEET_BOARD_KIND, fleetBoardHandler } from '../fleet-board/job.ts';
import { fleetBoardStore } from '../fleet-board/store.ts';
import { businessLawsJudge, businessLawsJudgeUrl } from '../inbox-check/business-laws-judge.ts';
import type { CanonGrader, LawsGrader } from '../inbox-check/evaluate-inbox.ts';
import { PR_INBOX_KIND, inboxFailureHook, inboxHandler } from '../inbox-check/inbox-check.ts';
import { APPROVED_EXTERNAL_ID, BUDGETS_EXTERNAL_ID, INBOX_EXTERNAL_ID, type CheckRequestData } from '../inngest-client.ts';
import { knowledgePackStore } from '../knowledge-pack/store.ts';
import { appOctokitFor, type OctokitFor } from '../octokit-for.ts';
import type { GitHubClient } from '../outbox-check/github.ts';
import { OUTBOX_KIND, outboxFailureHook, outboxHandler } from '../outbox-check/job.ts';
import { productOutboxReader, type ProductOutboxReader } from '../outbox-check/product-outbox.ts';
import type { GraphqlOctokit } from '../pr-stats/github.ts';
import { PR_STATS_KIND, prStatsHandler } from '../pr-stats/job.ts';
import { REFRESH_DELAY_SECONDS, type RefreshJob } from './ledger.ts';
import { packHandler, PACK_KIND } from './pack.ts';
import type { FailureHook, JobHandler } from './worker.ts';

/** The four kinds, in the order a pull request's jobs are refreshed. */
export const PR_CHECK_KINDS = Object.freeze([OUTBOX_KIND, PR_INBOX_KIND, APPROVED_KIND, BUDGETS_KIND] as const);
export type PrCheckKind = (typeof PR_CHECK_KINDS)[number];

/** The job of `kind` for the pull request `request` names, due `delaySeconds` after the refresh. */
export function prCheckJob(kind: PrCheckKind, request: CheckRequestData, delaySeconds = REFRESH_DELAY_SECONDS): RefreshJob {
  const subject = `${request.owner}/${request.repo}`.toLowerCase();
  const { installationId, owner, repo, repository, prNumber, headSha, trigger } = request;
  const payload = { installationId, owner, repo, repository, prNumber, headSha, ...(trigger === undefined ? {} : { trigger }) };
  return { kind, key: `${subject}#${String(prNumber)}`, subject, payload, delaySeconds };
}

/** The four jobs of a pull request, one per check. */
export function prCheckJobs(request: CheckRequestData, delaySeconds = REFRESH_DELAY_SECONDS): RefreshJob[] {
  return PR_CHECK_KINDS.map((kind) => prCheckJob(kind, request, delaySeconds));
}

/** The kind a re-run of a check run asks for, by the `external_id` it carries: the outbox's for any other. */
export function rerunKindOf(externalId: string | null | undefined): PrCheckKind {
  if (externalId === INBOX_EXTERNAL_ID) return PR_INBOX_KIND;
  if (externalId === APPROVED_EXTERNAL_ID) return APPROVED_KIND;
  if (externalId === BUDGETS_EXTERNAL_ID) return BUDGETS_KIND;
  return OUTBOX_KIND;
}

/** A PRD, in the repository of its issue, whose approved label was put on or taken off (PRD 1612). */
export type ApprovedRerun = { installationId: number; owner: string; repo: string; repository: string; prd: PrdNumber; trigger?: string | undefined };

/** The `pr-approved` jobs of every open pull request of the PRD, each at its head. GitHub's refusal is thrown. */
export async function approvedRerunJobs(octokit: GitHubClient, { installationId, owner, repo, prd, trigger }: ApprovedRerun): Promise<RefreshJob[]> {
  const pulls = await approvedPullsOf(octokit, { owner, repo, prd });
  return pulls.map((pull) =>
    prCheckJob(APPROVED_KIND, {
      installationId,
      owner: pull.owner,
      repo: pull.repo,
      repository: `${pull.owner}/${pull.repo}`,
      prNumber: pull.prNumber,
      headSha: pull.headSha,
      ...(trigger === undefined ? {} : { trigger }),
    }),
  );
}

/** What the four checks read beside GitHub: the server's readers, galaxy and its judges. */
export type PrCheckDeps = {
  octokitFor: OctokitFor<GitHubClient>;
  /** Each reader is null when the App cannot read the server here, which holds every product PRD's check. */
  readProductOutbox?: ProductOutboxReader | null;
  readRecord?: RecordReader | null;
  readOutboxRows?: OutboxRowsReader | null;
  galaxyUrl?: string;
  /** Galaxy's judge of a ◆ PRD's approval; none given, every ◆ PRD's check is held. */
  ask?: AskJudge;
  canon?: CanonGrader | null;
  laws?: LawsGrader | null;
};

/** A worker's handlers and failure hooks, by kind. */
export type Workers = { handlers: Record<string, JobHandler>; failures: Record<string, FailureHook> };

/** The four checks' handlers and failure hooks. */
export function prCheckWorkers({ octokitFor, readProductOutbox = null, readRecord = null, readOutboxRows = null, galaxyUrl = DEFAULT_GALAXY_URL, ask, canon = null, laws = null }: PrCheckDeps): Workers {
  return {
    handlers: {
      [OUTBOX_KIND]: outboxHandler({ octokitFor, readProductOutbox, galaxyUrl }),
      [PR_INBOX_KIND]: inboxHandler({ octokitFor, canon, laws }),
      [APPROVED_KIND]: approvedHandler({ octokitFor, readRecord, galaxyUrl, ...(ask ? { ask } : {}) }),
      [BUDGETS_KIND]: budgetsHandler({ octokitFor, readOutboxRows }),
    },
    failures: {
      [OUTBOX_KIND]: outboxFailureHook({ octokitFor }),
      [PR_INBOX_KIND]: inboxFailureHook({ octokitFor }),
      [APPROVED_KIND]: approvedFailure({ octokitFor }),
      [BUDGETS_KIND]: budgetsFailureHook({ octokitFor }),
    },
  };
}

/**
 * The groups the live worker reads: the database it runs on, what the checks ask beside GitHub, and the App's own
 * key, with which the escalation lists its installations.
 */
export type WorkerEnv = { supabase: SupabaseEnv } & Partial<Pick<AppEnv, 'githubApp' | 'openrouter' | 'constituentJudge' | 'businessLawsJudge' | 'stageEvents' | 'galaxyUrl'>>;

/**
 * Every kind's handler and failure hook, bound to the app's environment: the knowledge pack's, the four checks',
 * the Engineering board's collector's, the escalation's, the fix row stamp's and the fleet board's.
 */
export function liveWorkers(env: WorkerEnv, octokitFor: OctokitFor<GitHubClient & GraphqlOctokit>): Workers {
  const { supabase } = env;
  const galaxyUrl = env.galaxyUrl ?? DEFAULT_GALAXY_URL;
  const checks = prCheckWorkers({
    octokitFor,
    readProductOutbox: productOutboxReader(supabase),
    readRecord: recordReader(supabase),
    readOutboxRows: outboxRowsReader(supabase),
    galaxyUrl,
    ask: (repo, prd) => askJudge(repo, prd, { galaxyUrl, secret: env.stageEvents?.secret }),
    canon: liveCanon({ supabase, openrouter: env.openrouter ?? null, constituentJudge: env.constituentJudge ?? null, galaxyUrl }),
    laws: businessLawsJudge({ url: businessLawsJudgeUrl(galaxyUrl), secret: env.businessLawsJudge?.secret }),
  });
  return {
    handlers: {
      [PACK_KIND]: packHandler({ octokitFor, store: knowledgePackStore(supabase) }),
      ...checks.handlers,
      [PR_STATS_KIND]: prStatsHandler({ octokitFor, supabase }),
      [ESCALATION_KIND]: escalationHandler({ octokitFor, appOctokit: appOctokitFor(env.githubApp ?? null) }),
      [FIX_ROW_STAMP_KIND]: fixRowStampHandler({ stamp: fixRowStamper(supabase) }),
      [FLEET_BOARD_KIND]: fleetBoardHandler({ octokitFor, store: fleetBoardStore(supabase) }),
    },
    failures: checks.failures,
  };
}
