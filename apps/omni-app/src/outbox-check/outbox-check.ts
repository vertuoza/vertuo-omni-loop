// `outbox-check`: the check wiring the app's units together (PRD 28, "Flow"). It runs as the `pr-outbox` job
// of the ledger (PRD 2688, ./job.ts), its steps in order in one try:
//
//   step "in-progress"  create the check run, `in_progress`, on the head SHA — unless the base branch
//                       has no `.omni-loop/config.yml`: then the run ends there, and nothing is posted;
//                       or unless the pull request is not an Omni Loop feature PR: then the check is
//                       posted already `skipped`, and the run ends there (issue 876) — or, on a
//                       target feature PR (`Part of <plan repo>#<prd>`), already `success`, pointing
//                       to the plan PR that grades its PRD (issue 1202) — or, on a target feature PR of
//                       a product PRD (`Part of mobile-12`, PRD 1548 s8), already graded from the PRD's
//                       outbox rows on the server (./product-outbox.ts): `0 open · one gate on Mobile`,
//                       `<k> open · answer on Mobile › Questions`, or held when the server cannot be read
//   step "evaluate"     snapshot into /tmp + evaluate — one step, because /tmp does not survive steps
//   step "publish"      complete the check run; rewrite the comment unless the head moved on
//   step "escalation"   keep the escalation record (PRD 1794): what still waits on a person, handed
//                       on from "evaluate"; only on a repository that names a delegate or leadership,
//                       and after the verdict is published, so it never changes it
//   failure hook        once the 5th try threw (./job.ts): complete the check run as `failure` — never left
//                       `in_progress`; on a pull request that is not an Omni Loop feature PR, `skipped`
//                       instead, never `failure`; on a repository without the loop's config, nothing
//
// Every pull request event the webhook handles refreshes the job, so a burst of pushes and label changes is
// one evaluation of the latest state. The server event refreshes it too when an approval, a void, an item or
// a settlement changed a product PRD (../server-event/recheck.ts), so the target PRs' checks follow the
// server without a push.
//
// The app is public (PRD 359): it is installed on repositories that never asked for the loop, so a
// repository without the loop's config gets no check run and no comment, not even a `skipped` one.
//
// The installation's GitHub budget is shared with galaxy (PRD 902): a call the budget refuses, paused
// or deferred, is never sent. It is thrown, and the worker reads it as `waiting`, so nothing new is
// posted meanwhile.
//
// `runOutboxCheck` takes `octokitFor(installationId)`, so a test runs the real check against a stubbed
// GitHub; the worker runs it wired to installation tokens signed with the GitHub App's private key, its
// calls through the shared budget-aware client (`installationOctokitFor`, ../octokit-for.ts).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GithubDeferred, GithubPaused } from '@omni/github';
import { createContext } from 'omni-loop/kit/lib/context.ts';
import type { PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { businessLawFiles } from 'omni-loop/kit/lib/outbox/decision-coverage.ts';
import { NOT_ACTIVE_ON_REPO, evaluate, type Verdict } from '../evaluate/evaluate.ts';
import type { CheckRequestData } from '../jobs/payloads.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { DEFAULT_CHECK_NAME, publish, startCheck, type Published } from '../publish/publish.ts';
import { noteTo } from '../run-log/run-log.ts';
import { snapshot } from '../snapshot/snapshot.ts';
import {
  changedFiles,
  checkTarget,
  completeAsDeferred,
  completeAsProduct,
  completeAsFailure,
  completeAsSkipped,
  planPrOf,
  listComments,
  readBaseConfig,
  readPull,
  type Change,
  type Comment,
  type CheckTarget,
  type GitHubClient,
} from './github.ts';
import { deliveryFetched } from './delivery-scope.ts';
import { lawGateAt, withLawGate } from './law-locked.ts';
import { productOutboxVerdict, type OutboxReading, type ProductOutboxReader } from './product-outbox.ts';
import { heldAt, type HeldNow } from '../escalation/held.ts';
import { keepRecord } from '../escalation/record.ts';
import type { ProductPrdRef } from '../approved-check/state.ts';

/** What a run returns when it posted nothing: the repository has not installed the loop. */
const SILENT = Object.freeze({ posted: false, reason: NOT_ACTIVE_ON_REPO });

/** Why the failure hook posted nothing: GitHub could not say whether the gate runs on this pull request. */
const UNKNOWN_PR = 'omni-loop could not tell whether this is an Omni Loop feature PR';

/** What the check's body needs besides the pull request: GitHub, the product's outbox, the galaxy, the clock. */
export type OutboxDeps = {
  octokitFor: OctokitFor<GitHubClient>;
  /** A product PRD's outbox rows' reader; null when the App cannot read the server here, which holds every such check. */
  readProductOutbox?: ProductOutboxReader | null;
  /** The galaxy the check's Details link to: a product's Questions tab. */
  galaxyUrl?: string;
  now?: () => Date;
  log?: (line: string) => void;
};

/** The body's steps, by name: the job of the ledger runs each in turn, in one try (./job.ts). */
export type RunStep = {
  start: (work: () => Promise<Started>) => Promise<Started>;
  evaluate: (work: () => Promise<Evaluated>) => Promise<Evaluated>;
  publish: (work: () => Promise<Published>) => Promise<Published>;
  escalation: (work: () => Promise<string>) => Promise<string>;
};

/** What the step "in-progress" leaves: nothing when the repository has not installed the loop; else the check run, already completed when the gate does not run on the pull request. */
type Started =
  | null
  | { skipped: true; checkRunId?: number | undefined; name: string; conclusion: string }
  | { skipped: false; checkRunId: number; name: string };

/** What the step "evaluate" leaves: the verdict, and what still waits on a person. */
type Evaluated = Verdict & { held?: HeldNow };

/** What the body returns: the posted check, or `SILENT` when the repository has not installed the loop. */
export type OutboxOutcome = { posted: false; reason: string } | { checkRunId: number | undefined; name: string; conclusion: string; comment?: string; escalation?: string };

/** The check's body, the `pr-outbox` job's (./job.ts): its steps in order, each through `runStep`. */
export async function runOutboxCheck(
  { octokitFor, readProductOutbox = null, galaxyUrl = '', now = () => new Date(), log = noteTo('outbox-check') }: OutboxDeps,
  request: CheckRequestData,
  runStep: RunStep,
): Promise<OutboxOutcome> {
  const { installationId, owner, repo, prNumber, headSha } = request;

  const started = await runStep.start(async (): Promise<Started> => {
    const octokit = await octokitFor(installationId);
    const { active, name, gated, reason, deferTo, product } = await checkTarget(octokit, { owner, repo, prNumber, headSha });
    if (!active) return null;
    if (!gated && product) {
      const reading = await outboxReadingOf(readProductOutbox, request.repository, product, now, log);
      const verdict = productOutboxVerdict(product, reading, galaxyUrl);
      const [checkRunId] = await completeAsProduct(octokit, { owner, repo, headSha, name, verdict });
      return { checkRunId, name, skipped: true, conclusion: verdict.conclusion };
    }
    if (!gated && deferTo) {
      const planPr = await planPrOf(octokit, deferTo);
      const [checkRunId] = await completeAsDeferred(octokit, { owner, repo, headSha, name, plan: deferTo, planPr });
      return { checkRunId, name, skipped: true, conclusion: 'success' };
    }
    if (!gated) {
      const [checkRunId] = await completeAsSkipped(octokit, { owner, repo, headSha, name, reason });
      return { checkRunId, name, skipped: true, conclusion: 'skipped' };
    }
    const checkRunId = await startCheck(octokit, { owner, repo, headSha, name });
    return { checkRunId, name, skipped: false };
  });
  if (!started) return { ...SILENT };
  if (started.skipped) return { checkRunId: started.checkRunId, name: started.name, conclusion: started.conclusion };

  const verdict = await runStep.evaluate(async () => evaluateAt(await octokitFor(installationId), { owner, repo, prNumber, headSha }));

  const published = await runStep.publish(async () => {
    const octokit = await octokitFor(installationId);
    return publish(octokit, { owner, repo, checkRunId: started.checkRunId, pullNumber: prNumber, headSha, verdict });
  });

  const holding = verdict.held;
  const escalation = holding ? await runStep.escalation(() => recordSafely(holding, { octokitFor, installationId, owner, repo, prNumber, now, log })) : 'none';

  return { checkRunId: published.checkRunId, name: started.name, conclusion: verdict.conclusion, comment: published.comment, escalation };
}

/** A product PRD's outbox as the check reads it: reached, or held since now when the reader is missing or throws. */
async function outboxReadingOf(
  read: ProductOutboxReader | null,
  repository: string,
  prd: ProductPrdRef,
  now: () => Date,
  log: (line: string) => void,
): Promise<OutboxReading> {
  const held = (why: string): OutboxReading => {
    log(`outbox check of ${repository} for ${prd.id} is held: ${why}`);
    return { reachable: false, since: now().toISOString() };
  };
  if (!read) return held('the App cannot read the server here');
  try {
    return { reachable: true, outbox: await read(repository, prd) };
  } catch (error) {
    return held(error instanceof Error ? error.message : String(error));
  }
}

/**
 * The step "escalation": keeps the record of what still waits on a person. A failure here, a budget's
 * refusal included, is logged and the record waits for the next run: the check is already completed,
 * and a failed record must never send the run to the failure handler, which would turn it red.
 */
async function recordSafely(
  holding: HeldNow,
  { octokitFor, installationId, owner, repo, prNumber, now, log }: {
    octokitFor: OctokitFor<GitHubClient>;
    installationId: number;
    owner: string;
    repo: string;
    prNumber: PrNumber;
    now: () => Date;
    log: (line: string) => void;
  },
): Promise<string> {
  try {
    return await keepRecord(await octokitFor(installationId), { owner, repo, prNumber, now: now(), ...holding });
  } catch (error) {
    log(`escalation record of ${owner}/${repo}#${String(prNumber)} waits for the next run: ${error instanceof Error ? error.message : String(error)}`);
    return 'failed';
  }
}

/** The budget's refusal behind `error`, however deep Octokit wrapped it; null when there is none. */
function budgetRefusal(error: unknown): GithubPaused | GithubDeferred | null {
  let cause = error;
  for (let depth = 0; cause instanceof Error && depth < 4; depth += 1) {
    if (cause instanceof GithubPaused || cause instanceof GithubDeferred) return cause;
    cause = cause.cause;
  }
  return null;
}

/**
 * Runs the failure hook's work: a call the installation's budget refused (PRD 902) logs one line for the
 * pull request `where`, and is thrown as it is, never swallowed.
 */
async function sayingBudget<T>(where: string, log: (line: string) => void, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    const refused = budgetRefusal(error);
    if (refused) log(`outbox check of ${where} waits for the GitHub budget: ${refused.message}`);
    throw error;
  }
}

/**
 * The step "evaluate": snapshot the base branch's config and the head's delivery folder into /tmp,
 * gather the pull request's facts, comments and changed files, and let `evaluate` decide. The
 * temporary folders are removed whatever happens. Beside the verdict, `held` is what still waits on a
 * person (PRD 1794), read from what was graded; absent where the gate graded nothing.
 */
async function evaluateAt(
  octokit: GitHubClient,
  { owner, repo, prNumber, headSha }: { owner: string; repo: string; prNumber: PrNumber; headSha: string },
): Promise<Verdict & { held?: HeldNow }> {
  const pr = await readPull(octokit, { owner, repo, prNumber });
  const base = mkdtempSync(join(tmpdir(), 'omni-base-'));
  const head = mkdtempSync(join(tmpdir(), 'omni-head-'));
  try {
    const { config } = await readBaseConfig(octokit, { owner, repo, baseSha: pr.baseSha, dest: base });

    let comments: Comment[] = [];
    let changes: Change[] | null = null;
    if (config) {
      // With laws in the knowledge folder (PRD 1342), the gate reads it at both ends of the range: a
      // law's proof at the head, a law demoted since the base. The rules still come from the base.
      const knowledge = config.laws.source === 'knowledge' ? [config.paths.knowledge] : [];
      if (knowledge.length > 0) await snapshot(octokit, { owner, repo, ref: pr.baseSha, paths: knowledge, dest: base });
      const fetchIf = deliveryFetched(config, pr);
      await snapshot(octokit, { owner, repo, ref: headSha, paths: [config.paths.delivery, ...knowledge], dest: head, fetchIf });
      comments = await listComments(octokit, { owner, repo, prNumber });
      changes = await changedFiles(octokit, { owner, repo, baseSha: pr.baseSha, headSha });
    }

    const verdict = evaluate({
      base,
      head,
      pr: { baseRef: pr.baseRef, headRef: pr.headRef, headSha, labels: pr.labels },
      changes,
      comments,
    });
    // A change to a locked law (PRD 1726) is cleared by its CODEOWNERS' review alone, whatever `evaluate` said.
    // A pull request `evaluate` skips is still held when it changes a business law (PRD 2632): `checkTarget` gated it for that.
    if (!config || changes === null) return verdict;
    if (verdict.conclusion === 'skipped' && businessLawFiles(changes, { ctx: createContext(head, config) }).length === 0) return verdict;
    const gate = await lawGateAt(octokit, { owner, repo, prNumber, baseSha: pr.baseSha, headSha, config, base, head, changes });
    const held = heldAt({ config, head, pr, gate });
    return held === null ? withLawGate(verdict, gate) : { ...withLawGate(verdict, gate), held };
  } finally {
    rmSync(base, { recursive: true, force: true });
    rmSync(head, { recursive: true, force: true });
  }
}

/**
 * The `pr-outbox` job's failure hook's work (./job.ts): once the 5th try threw, complete the check as
 * `failure` with the reason ("omni-loop could not evaluate: …"); on a pull request the gate does not run on,
 * `skipped` instead (issue 876), or `success` on a target feature PR (issue 1202), but `failure` on a
 * product PRD's target PR, whose outbox the check grades (PRD 1548 s8).
 *
 * A call the installation's budget refuses (PRD 902) is never swallowed: it is logged and thrown (issue 1970).
 */
export function failOutboxCheck(octokit: GitHubClient, { owner, repo, prNumber, headSha }: CheckRequestData, reason: unknown, log: (line: string) => void) {
  return sayingBudget(`${owner}/${repo}#${String(prNumber)}`, log, async () => {
    const target = await targetOrUnknown(octokit, { owner, repo, prNumber, headSha });
    if (target && !target.active) return { ...SILENT };
    if (target && !target.gated) return completeUngated(octokit, { owner, repo, headSha, target, reason });
    // Gated, or unknown: an open check run of this name was started by step "in-progress", on a gated
    // pull request only, so failing it is safe. A new failed check is created only once the pull
    // request is known to be gated: never red on one that is not (issue 876).
    if (target) {
      const checkRunIds = await completeAsFailure(octokit, { owner, repo, headSha, name: target.name, reason });
      return { checkRunIds, name: target.name, reason };
    }
    const name = DEFAULT_CHECK_NAME;
    const checkRunIds = await openRunsFailed(octokit, { owner, repo, headSha, name, reason });
    if (checkRunIds.length === 0) return { posted: false, reason: UNKNOWN_PR };
    return { checkRunIds, name, reason };
  });
}

/** What the pull request is to the check, or null when GitHub cannot say; a budget's refusal is thrown, never swallowed. */
async function targetOrUnknown(octokit: GitHubClient, at: { owner: string; repo: string; prNumber: PrNumber; headSha: string }): Promise<CheckTarget | null> {
  try {
    return await checkTarget(octokit, at);
  } catch (error) {
    if (budgetRefusal(error)) throw error;
    // The failure may be GitHub itself: what the pull request is stays unknown.
    return null;
  }
}

/** The open check runs of `name` completed as failure, none created; `[]` when GitHub refuses, but a budget's refusal is thrown. */
async function openRunsFailed(
  octokit: GitHubClient,
  at: { owner: string; repo: string; headSha: string; name: string; reason: unknown },
): Promise<number[]> {
  try {
    return await completeAsFailure(octokit, { ...at, create: false });
  } catch (error) {
    if (budgetRefusal(error)) throw error;
    // GitHub still refuses: there is nothing this handler can safely write.
    return [];
  }
}

/**
 * The failure handler's completion of a pull request the gate does not run on: `success` pointing to
 * the plan PR on a target feature PR (issue 1202), `skipped` on any other (issue 876) — but `failure`,
 * with why the run failed, on a product PRD's target PR, whose outbox rows are its gate (PRD 1548 s8).
 */
async function completeUngated(
  octokit: GitHubClient,
  { owner, repo, headSha, target, reason: failed }: { owner: string; repo: string; headSha: string; target: CheckTarget; reason: unknown },
) {
  const { name, reason, deferTo } = target;
  if (target.product) {
    const checkRunIds = await completeAsFailure(octokit, { owner, repo, headSha, name, reason: failed });
    return { checkRunIds, name, reason: failed };
  }
  if (deferTo) {
    const checkRunIds = await completeAsDeferred(octokit, { owner, repo, headSha, name, plan: deferTo, planPr: await planPrOf(octokit, deferTo) });
    return { checkRunIds, name, conclusion: 'success' };
  }
  const checkRunIds = await completeAsSkipped(octokit, { owner, repo, headSha, name, reason });
  return { checkRunIds, name, conclusion: 'skipped' };
}
