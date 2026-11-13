// `retro`: the job of the ledger wiring the retro's units (PRD 72, "Flow"; moved to the ledger by PRD omni-loop-4
// s3). `/api/github` adds one job for a pull request merged into the default branch, keyed `<owner/name>#<pr>`,
// lower case, in the lane `<owner/name>`: one retro at a time per repository, so two runs never number the same
// ids, and a retro waiting for its day 14 holds nothing up (a lane holds only a running job). Its payload is
// where and when the pull request merged, never a token (L-GDPR-2). It never reads or writes a check run.
//
//   step "qualify"          the config at the merge SHA; a feature PR by the app's rule; its PRD folder
//   step "gather-pulls"     the sub-PRs into the feature branch
//   steps "target-<name>"   a multi-repository PRD's targets (PRD 1130, `targets.read.ts`): each one's
//                           installation, looked up as the App, then its feature PRs and sub-PRs
//   steps "gather-<kind>"   each kind's GitHub reads, one step per kind (`kinds/index.ts`), then
//                           "gather-<kind>-<name>" for each target read, as its installation
//   step "facts"            `detect`: the fact sheet — saved, so a retry never changes a number; saved without
//                           its excerpts (the red runs' log tails, `excerpts.ts`), put back from the gathers'
//                           saved records as it is read, so a step stays under the ledger's 1 MB (#2780)
//   step "gather-knowledge" what the judge compares with (PRD 487): the knowledge summary and the
//                           lessons of the retros already merged, both at the merge commit
//   step "narrate"          the model's prose and its verdict, from this Vercel function
//   step "guard"            each field of prose accepted, or dropped with its reason; the verdict too
//   step "published-before" only for a retro owed at the switch (`owed`, added by ../jobs/gaps.ts): the
//                           retro PR from the retro branch, and the verdict comment, that already exist;
//                           either one, and the merge run publishes nothing (below)
//   then, when the verdict says the retro is worth a pull request:
//   step "publish-issues"   one retro issue per finding the judge kept, worst first
//   step "publish"          the branch, retro.md + retro.json in the PRD's shipped folder, then the PR;
//                           while it is open and holds a kept lesson with no outcome (PRD 2338), its
//                           body carries `/omni:retro-apply --retro <retro PR>` (`apply.ts`)
//   step "queue-apply"      that line, queued once as a runner job sent by the app, for the
//                           installation's workspace (`runner-queue.ts`); only with a database
//   or else — not worth it, or not judged (no verdict, or one `guard` refused):
//   step "verdict"          no branch, no file, no PR, no issue: one comment on the merged feature PR,
//                           marked `<markers.prefix>-retro-verdict` and rewritten in place on a replay
//   steps "comment-target-<name>"  a multi-repository PRD's read targets: one comment on each one's
//                           merged feature PR, the retro's link and its findings (`target-comment.ts`)
//   then the run ends `later`, due the merge plus `THRESHOLDS.afterMergeDays` days (`followUpAt`): one wait,
//                           of fourteen days, under the ledger's cap of 20; the clock is read again on
//                           every run, never saved, so the run after the wait reads the day it runs on
//   the same steps, "-day-14" after each id, for the kinds of the day-14 run: an "After merge"
//                           section, issues for its new findings, committed to the retro PR while it
//                           is open, else to a new `<branch>-day-14` PR (`publish.ts`)
//   failure hook            one comment on the merged PR: "The retro could not run: <reason>"
//
// A merge that is not a feature PR ends `skipped` at "qualify" and posts nothing.
//
// Every step's value is saved on the ledger under the job's claim (../saved-step.ts `jobSteps`), so the run after
// the wait replays the merge run from its saved steps, publishing nothing again, and carries on with the day-14
// steps. A retry, or a replay of a failed job, carries on after its last saved step in the same way.
//
// The day-14 run carries on from the merge run: its kinds are handed the merge run's fact sheet (`scope.atMerge`,
// the churn ranges a fix is placed against); its findings are numbered on from the merge run's (F1… stay what they
// were); the model is asked again about the whole retro, both runs' findings, with the knowledge the merge run
// gathered, and when it gives nothing the merge run's words, its verdict included, stay; and the merge run's record
// is written again beside its own. Worth it, it commits to the merge run's PR while that is open, else opens one
// (the merge run may have been worth none); its issues are for its own kept findings, and for the merge run's too
// when the merge run opened none. Not worth it, it rewrites the verdict comment.
//
// A retro owed at the switch (PRD omni-loop-4 s3, spec "What is owed at the switch"): a feature PR merged in the
// last fourteen days with no `retro` job gets one from the hourly comparison, `owed`. The earlier runner may already have
// published its merge run: when its retro PR or its verdict comment exists, the merge run reads its facts and
// words again but publishes nothing, comments on no target, and goes straight to its day-14 wait.
//
// `retroHandler` takes `octokitFor(installationId)`, so a test runs the real retro against a stubbed GitHub;
// `followUp` adds the day-14 run, and `now` is the clock a test passes its fourteen days through.
//
// The payload is parsed by `RetroPayloadSchema` before use, and every GitHub answer this file reads by its schema
// in `github.schema.ts`. Every value a step returns is read back through its schema in `retro.schema.ts`
// (`savedStep`): the ledger saves it as JSON, and the day-14 run reads the merge run's values back fourteen days
// later, maybe after a deploy that changed what the step returns.
import { z } from 'zod';
import { parseConfig } from 'omni-loop/kit/lib/config.ts';
import { foldersLayout } from 'omni-loop/kit/lib/layout.ts';
import { parseOrThrow } from 'omni-loop/kit/lib/schema/parse-or-throw.ts';
import { PrNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { pullsFrom } from '../git-write/git-write.ts';
import type { NewJob } from '../jobs/ledger.ts';
import type { FailureHook, JobHandler, JobResult } from '../jobs/worker.ts';
import { listComments } from '../outbox-check/github.ts';
import { detect } from './detect.ts';
import { withExcerptsOf, withoutExcerpts } from './excerpts.ts';
import { knowledgeSummary } from 'omni-loop/kit/lib/knowledge/classify.ts';
import { playbookLines } from 'omni-loop/kit/lib/playbook/lines.ts';
import { withTreeAt } from '../knowledge-harvest/github.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { memorySteps, savedStep, type StepRun } from '../saved-step.ts';
import { failureCommentHook, upsertComment } from '../verdict-comment/verdict-comment.ts';
import { listPullsInto } from './github.ts';
import { BlobSchema, RetroDocSchema, RetroLessonsSchema, TreeSchema, parseGitHub } from './github.schema.ts';
import {
  CommentedSchema,
  FactSheetSchema,
  GuardedSchema,
  IssueLinksSchema,
  KnownSchema,
  NarratedSchema,
  PublishedBeforeSchema,
  PublishedSchema,
  PullsIntoSchema,
  QualifiedSchema,
  QueuedSchema,
} from './retro.schema.ts';
import type { ApplyQueue } from './runner-queue.ts';
import { guard } from './guard.ts';
import { publishIssues } from './issues.ts';
import { followUpAt } from './kinds/after-merge.ts';
import { KINDS, type Kind } from './kinds/index.ts';
import { narrate } from './narrate.ts';
import { publishRetro } from './publish.ts';
import { qualify } from './qualify.ts';
import { withTargets, type TargetRecords } from './targets.detect.ts';
import { gatherTarget, readTargets, type AppOctokit } from './targets.read.ts';
import { verdictComment } from './render.ts';
import { commentTargets } from './target-comment.ts';
import type { OpenRouterEnv } from '../env.ts';
import type {
  Config,
  FactSheet,
  FeaturePull,
  IssueLinks,
  Known,
  Lesson,
  Octokit,
  PrdFacts,
  Prose,
  PullInto,
  Run,
  RunRecord,
  Scope,
} from './retro.types.ts';

export const RETRO_KIND = 'retro';

/** The two runs of a retro: at the merge, and fourteen days later. */
export const MERGE_RUN = 'merge';
export const FOLLOW_UP_RUN = 'day-14';

/** A retro's tries (3 retries, and the first): the 4th that throws fails it. */
const MAX_TRIES = 4;

/** The prefix of the failure comment's marker. The config may be what failed to read, so the kit's default. */
const MARKER_PREFIX = parseConfig('kit: 1\n').markers.prefix;
export const FAILURE_MARKER = `<!-- ${MARKER_PREFIX}-retro-failed -->`;

/** The marker of the comment a retro not worth a pull request keeps on the merged feature PR. */
export const verdictMarker = (prefix: string): string => `<!-- ${prefix}-retro-verdict -->`;
export const VERDICT_MARKER = verdictMarker(MARKER_PREFIX);

/** How the verdict comment opens: judged not worth a PR, or not judged at all. */
export const NO_NEW_LESSON = 'no new lesson';
export const NOT_JUDGED = 'not judged';

/**
 * The payload of a `retro` job: where and when the pull request merged; `owed` when the hourly comparison added it
 * at the switch (../jobs/gaps.ts), not `/api/github`.
 */
export const RetroPayloadSchema = z.object({
  installationId: z.number(),
  owner: z.string(),
  repo: z.string(),
  prNumber: PrNumberSchema,
  mergeSha: z.string(),
  mergedAt: z.string().nullish(),
  owed: z.boolean().optional(),
});

/** Where and when a pull request merged, and whether its retro is owed at the switch. */
export type RetroPayload = z.infer<typeof RetroPayloadSchema>;

/**
 * The job of one merged pull request: one retro at a time per repository (its lane), a delivery sent twice one
 * job, and the comparison's add of a retro `/api/github` already added none.
 */
export function retroJob({ installationId, owner, repo, prNumber, mergeSha, mergedAt, owed = false }: RetroPayload): NewJob {
  const subject = `${owner}/${repo}`.toLowerCase();
  return {
    kind: RETRO_KIND,
    key: `${subject}#${String(prNumber)}`,
    subject,
    lane: subject,
    payload: { installationId, owner, repo, repository: `${owner}/${repo}`, prNumber, mergeSha, mergedAt: mergedAt ?? null, ...(owed ? { owed: true } : {}) },
    maxTries: MAX_TRIES,
  };
}

export type RetroDeps = {
  octokitFor: OctokitFor<Octokit>;
  /** The App's own client, which looks up its installation on each target of a multi-repository PRD (PRD 1130). */
  appOctokit?: AppOctokit | null;
  /** OpenRouter, from the app's environment (../env.ts); `null`: every retro goes out facts only. */
  openrouter: OpenRouterEnv | null;
  /** The model call's fetch; the global one when not given. */
  fetch?: typeof fetch;
  kinds?: readonly Kind[];
  followUp?: boolean;
  /**
   * The runner queue (PRD 2338, `runner-queue.ts`), on the app's database; `null`: no job is queued,
   * and the retro PR's body still carries the line for a person to run.
   */
  queue?: ApplyQueue | null;
  /** The clock, in milliseconds: read on every run, never saved, so the run after the wait knows its day. */
  now?: () => number;
};

/** What the judge said, as the retro acts on it. */
export type VerdictOutcome = { worthIt: boolean; judged: boolean; reason: string };

type Published = z.infer<typeof PublishedSchema>;
type Commented = z.infer<typeof CommentedSchema>;
type Queued = z.infer<typeof QueuedSchema>;

/** One run of the retro, as the run after it reads it. */
type RunResult = {
  sheet: FactSheet;
  prose: Prose | null;
  known: Known;
  record: RunRecord & { issues: IssueLinks };
  published: Published | null;
  comment: Commented | null;
  verdict: VerdictOutcome;
  /** The runner job the retro PR's line was queued as (PRD 2338); `null` when none was asked for. */
  queued: Queued | null;
};

/**
 * The handler of the `retro` kind: one run of the retro on the job's saved steps. A skip ends the job `skipped`;
 * a merge run whose day 14 has not come ends it `later`, due that day; else it is `done`.
 */
export function retroHandler(deps: RetroDeps): JobHandler {
  return async (job, run) => jobResultOf(await retro(deps, job.payload, run?.step ?? memorySteps()));
}

/** How a run of the retro ends its job: `skipped` with why, `later` on the day it waits until, else `done`. */
export function jobResultOf(ran: object): JobResult {
  if ('skipped' in ran && typeof ran.skipped === 'string') return { outcome: 'skipped', reason: ran.skipped };
  if ('waitsUntil' in ran && typeof ran.waitsUntil === 'string') return { outcome: 'later', at: new Date(ran.waitsUntil), progress: {} };
  return { outcome: 'done' };
}

/**
 * One run of the retro of the merged pull request `payload` names, its steps saved on `step`: the merge run, then,
 * with `followUp`, the day-14 run once its day has come, or the day it waits until.
 */
export async function retro(
  { octokitFor, appOctokit = null, openrouter, fetch, kinds = KINDS, followUp = false, queue = null, now = Date.now }: RetroDeps,
  payload: unknown,
  step: StepRun,
) {
  const { installationId, owner, repo, prNumber, mergeSha, mergedAt, owed = false } = parsePayload(payload);
  const github = async () => octokitFor(installationId);

  const qualified = await savedStep(step, 'qualify', QualifiedSchema, async () => qualify(await github(), { owner, repo, prNumber, mergeSha }));
  if (qualified.skip !== null) return { skipped: qualified.skip };
  const { pr, prd, config } = qualified;

  const pulls = await savedStep(step, 'gather-pulls', PullsIntoSchema, async () => listPullsInto(await github(), { owner, repo, base: pr.headRef }));

  const targets = await readTargets({ step, appOctokit, octokitFor, planSlug: `${owner}/${repo}`, scope: { config, prd } });
  const scope: Scope = { owner, repo, mergeSha, mergedAt: mergedAt ?? pr.mergedAt, pr, prd, config, pulls, ...(targets.length > 0 ? { targets } : {}) };
  const context = { step, github, octokitFor, openrouter, fetch, queue, installationId, owner, repo, pr, prd, config, pulls };
  const first = await runRetro({ ...context, run: MERGE_RUN, kinds: kindsIn(MERGE_RUN, kinds), scope, owed });
  const result = { prd: prd.number, ...outcome(first) };

  const laterKinds = kindsIn(FOLLOW_UP_RUN, kinds);
  if (!followUp || laterKinds.length === 0) return result;

  const due = followUpAt(scope.mergedAt);
  if (now() < Date.parse(due)) return { ...result, waitsUntil: due };
  const later = await runRetro({
    ...context,
    run: FOLLOW_UP_RUN,
    kinds: laterKinds,
    scope: { ...scope, atMerge: first.sheet },
    earlier: first,
  });
  return { ...result, followUp: outcome(later) };
}

/** The kinds that take part in one run, in registry order, as `kindsFor` picks them from any list. */
function kindsIn(run: Run, kinds: readonly Kind[]): Kind[] {
  return kinds.filter((kind) => kind.runs.includes(run));
}

/** The job's payload, parsed; a payload missing a field fails, naming it. */
function parsePayload(payload: unknown): RetroPayload {
  return parseOrThrow(RetroPayloadSchema, payload, 'The retro job carries an unexpected payload');
}

type RunInput = {
  step: StepRun;
  github: () => Promise<Octokit>;
  octokitFor: OctokitFor<Octokit>;
  openrouter: OpenRouterEnv | null;
  fetch: typeof fetch | undefined;
  queue: ApplyQueue | null;
  /** The installation the retro runs as: its workspace is the one a queued job goes to. */
  installationId: number;
  owner: string;
  repo: string;
  pr: FeaturePull;
  prd: PrdFacts;
  config: Config;
  pulls: PullInto[];
  run: Run;
  kinds: readonly Kind[];
  scope: Scope;
  earlier?: RunResult | null;
  /** A merge run owed at the switch: it publishes nothing when its retro PR or verdict comment already exists. */
  owed?: boolean;
};

/**
 * One run of the retro, from its kinds' reads to its published PR. `earlier` is the run it follows,
 * when there is one: its findings are numbered on from, asked about again, and published again.
 */
async function runRetro(input: RunInput): Promise<RunResult> {
  const id = (name: string) => (input.run === MERGE_RUN ? name : `${name}-${input.run}`);
  // Read from where the PRD's folder was at the merge; written, always, into its shipped folder.
  const folder = retroFolder(input.prd, input.config);
  const sheet = await factSheet(input, id, folder);
  const judged = await judgeSheet(input, id, sheet);
  const before = input.owed && input.run === MERGE_RUN ? await publishedBefore(input) : null;
  if (before) return keptRun(sheet, judged, before);
  const result = judged.verdict.worthIt ? await publishRun(input, id, folder, sheet, judged) : await commentRun(input, id, sheet, judged);
  await commentOnTargets(input, id, judged.whole, result);
  return result;
}

type Before = z.infer<typeof PublishedBeforeSchema>;

/**
 * What a retro owed at the switch finds already published (step "published-before"): the newest pull request from
 * the retro branch, whatever its state, and the verdict comment on the merged feature PR; null when neither exists,
 * and the merge run publishes as any other.
 */
async function publishedBefore({ step, github, owner, repo, pr, prd, config }: RunInput): Promise<Before | null> {
  const found = await savedStep(step, 'published-before', PublishedBeforeSchema, async () => {
    const octokit = await github();
    const branch = config.branches.retro.replaceAll('{topic}', prd.topic);
    const [pull] = await pullsFrom(octokit, { owner, repo, branch, base: config.repo.defaultBranch });
    const marker = verdictMarker(config.markers.prefix);
    const comment = (await listComments(octokit, { owner, repo, prNumber: pr.number })).find((one) => one.body.includes(marker));
    return {
      pr: pull ? { branch, commit: pull.head?.sha ?? pr.mergeSha, number: pull.number, url: pull.html_url } : null,
      comment: comment ? { commentId: comment.id } : null,
    };
  });
  return found.pr || found.comment ? found : null;
}

/**
 * The merge run of a retro the earlier runner already published: its facts and words, and what it published then, kept as
 * found. Nothing is written again: no issue, no commit, no comment, none on a target.
 */
function keptRun(sheet: FactSheet, { prose, known, verdict, base }: Judged, { pr, comment }: Before): RunResult {
  const published = pr ? { branch: pr.branch, committed: false, commit: pr.commit, pr: { number: pr.number, url: pr.url, created: false }, apply: null } : null;
  return { sheet, prose, known, record: { ...base, issues: {} }, published, comment: comment ? { ...comment, created: false } : null, verdict, queued: null };
}

/**
 * One comment on each read target's merged feature PR (PRD 1130, `target-comment.ts`): the retro's
 * link, its PR when one was published, else the plan PR its verdict is on, and that repository's
 * findings of both runs, with the issues either opened. Nothing for a PRD of one repository.
 */
async function commentOnTargets({ step, octokitFor, owner, repo, pr, prd, config, scope, earlier }: RunInput, id: StepId, whole: FactSheet, result: RunResult) {
  const retroPr = result.published?.pr ?? earlier?.published?.pr ?? null;
  const link = retroPr ? { label: `retro PR #${retroPr.number}`, url: retroPr.url } : { label: `the verdict on ${owner}/${repo}#${pr.number}`, url: pr.url };
  const issues = { ...earlier?.record.issues, ...result.record.issues };
  await commentTargets({ step, octokitFor, id, targets: scope.targets ?? [], prefix: config.markers.prefix, prd, link, findings: whole.findings, issues });
}

/** The id of a step of one run: the merge run's as named, the day-14 run's with its run after it. */
type StepId = (name: string) => string;

/** What judging a run's fact sheet gave: the sheet the model was asked about, its prose, the knowledge, the verdict and the record. */
type Judged = { whole: FactSheet; prose: Prose | null; known: Known; verdict: VerdictOutcome; base: RunRecord };

/** The run's fact sheet: each kind's records gathered, then detected, its findings numbered on from the run before. */
async function factSheet(input: RunInput, id: StepId, folder: string): Promise<FactSheet> {
  const { step, github, owner, repo, pr, prd, config, pulls, run, kinds, scope, earlier } = input;
  const records: Record<string, unknown> = {};
  for (const kind of kinds) {
    records[kind.id] = await savedStep(step, id(`gather-${kind.id}`), kind.records.nullable(), async () => (await kind.gather(await github(), scope)) ?? null);
  }
  const targets = await targetRecords(input);
  const before = earlier?.sheet.findings ?? [];
  let sheet: FactSheet | undefined;
  const made = (): FactSheet => {
    sheet ??= inFolder(
      numberedAfter(withTargets(detect({ run, pr, prd, config, pulls, records, kinds }), { planSlug: `${owner}/${repo}`, targets, run, kinds, scope }), before.length),
      folder,
    );
    return sheet;
  };
  // Saved without its excerpts, copies of what the gather steps saved (#2780), then put back from the same sheet.
  const saved = await savedStep(step, id('facts'), FactSheetSchema, () => FactSheetSchema.parse(withoutExcerpts(made())));
  return FactSheetSchema.parse(withExcerptsOf(saved, made()));
}

/** What each target's kinds gathered, in the merge run only (PRD 1130); a target not read gathers nothing. */
async function targetRecords({ step, octokitFor, run, kinds, scope }: RunInput): Promise<TargetRecords[]> {
  if (run !== MERGE_RUN) return [];
  const out: TargetRecords[] = [];
  for (const target of scope.targets ?? []) {
    out.push({ target, records: target.read ? await gatherTarget({ step, octokitFor, kinds, scope }, target) : null });
  }
  return out;
}

/** The model's words on the run, guarded, and the verdict they give. */
async function judgeSheet({ step, github, openrouter, fetch, owner, repo, prd, config, scope, earlier }: RunInput, id: StepId, sheet: FactSheet): Promise<Judged> {
  // The model writes the words of the whole retro, so at day 14 it is given both runs' findings,
  // and the knowledge the merge run gathered.
  const whole = earlier ? { ...sheet, findings: [...earlier.sheet.findings, ...sheet.findings] } : sheet;
  const known =
    earlier?.known ??
    (await savedStep(step, id('gather-knowledge'), KnownSchema, async () => gatherKnowledge(await github(), { owner, repo, sha: scope.mergeSha, config })));
  const narrated = await savedStep(step, id('narrate'), NarratedSchema, () =>
    narrate({ sheet: whole, prd: { title: prd.title, problem: prd.problem }, knowledge: known.knowledge, lessons: known.lessons, openrouter, fetch }),
  );
  const guarded = await savedStep(step, id('guard'), GuardedSchema, () => guard({ reply: narrated.reply ?? null, sheet: whole }));
  const prose = guarded.prose ?? earlier?.prose ?? null;
  return { whole, prose, known, verdict: verdictOf(prose, narrated.reason), base: recordOf(sheet, prose, narrated, guarded) };
}

/** The run's record before its issues: the sheet, the narration's outcome, the verdict and the lessons kept. */
function recordOf(sheet: FactSheet, prose: Prose | null, narrated: z.infer<typeof NarratedSchema>, guarded: z.infer<typeof GuardedSchema>): RunRecord {
  const narration = {
    model: narrated.model ?? null,
    reason: guarded.prose ? null : (narrated.reason ?? 'the prose was refused'),
    dropped: guarded.dropped,
  };
  return { ...sheet, narration, verdict: prose?.verdict ?? null, lessons: lessonsOf(prose) };
}

/** A run not worth a pull request: one comment on the feature PR, saying why. */
async function commentRun({ step, github, owner, repo, pr, config, earlier }: RunInput, id: StepId, sheet: FactSheet, { prose, known, verdict, base }: Judged): Promise<RunResult> {
  const runs = [...(earlier ? [earlier.record] : []), base];
  const comment = await savedStep(step, id('verdict'), CommentedSchema, async () =>
    upsertComment(await github(), {
      owner,
      repo,
      prNumber: pr.number,
      marker: verdictMarker(config.markers.prefix),
      text: verdictComment({ judged: verdict.judged, reason: verdict.reason, runs, prose }),
    }),
  );
  return { sheet, prose, known, record: { ...base, issues: {} }, published: null, comment, verdict, queued: null };
}

/**
 * A run worth a pull request: its findings' issues, then the retro's branch and PR and, while that PR
 * is open and holds a kept lesson with no outcome, the runner job that settles them (`queueApply`).
 */
async function publishRun(
  { step, github, queue, installationId, owner, repo, pr, prd, config, earlier }: RunInput,
  id: StepId,
  folder: string,
  sheet: FactSheet,
  { whole, prose, known, verdict, base }: Judged,
): Promise<RunResult> {
  // The merge run's kept findings get their issues at day 14 when the merge run opened none.
  const retroPath = `${folder}/retro.md`;
  const issueSheet = earlier && !earlier.published ? whole : sheet;
  const issues = await savedStep(step, id('publish-issues'), IssueLinksSchema, async () =>
    publishIssues(await github(), { owner, repo, config, sheet: issueSheet, prose, retroPath }),
  );

  const record = { ...base, issues };
  const published = await savedStep(step, id('publish'), PublishedSchema, async () =>
    publishRetro(await github(), { owner, repo, config, prd: { ...prd, folder }, pr, record, prose, earlier: earlier ? [earlier.record] : [] }),
  );
  const line = published.apply ?? null;
  const queued = queue && line ? await savedStep(step, id('queue-apply'), QueuedSchema, () => queue({ installationId, repository: `${owner}/${repo}`, line })) : null;
  return { sheet, prose, known, record, published, comment: null, verdict, queued };
}

/**
 * What the judge said, as the retro acts on it: worth a pull request or not, judged or not, and why.
 * Only a verdict `guard` accepted is judged; no prose, or a refused verdict, is not judged.
 */
export function verdictOf(prose: Prose | null, narrationReason?: string | null): VerdictOutcome {
  const verdict = prose?.verdict;
  if (!prose) return { worthIt: false, judged: false, reason: narrationReason ?? 'the prose was refused' };
  if (!verdict || !('worthIt' in verdict) || typeof verdict.worthIt !== 'boolean') {
    const dropped = verdict && 'dropped' in verdict ? verdict.dropped : undefined;
    return { worthIt: false, judged: false, reason: `the verdict was refused: ${dropped ?? 'it gives no verdict'}` };
  }
  return { worthIt: verdict.worthIt, judged: true, reason: verdict.reason };
}

/** The lessons `guard` accepted, as `retro.json` keeps them for the retros after this one. */
function lessonsOf(prose: Prose | null): Lesson[] {
  return (prose?.lessons ?? [])
    .filter((lesson) => lesson.text && !lesson.text.startsWith('_Dropped: '))
    .map((lesson) => ({ text: lesson.text, findings: [...lesson.findings] }));
}

/**
 * What the judge compares a retro with, read at the merge commit `sha`: the knowledge summary (the
 * kit's `knowledgeSummary`, over the knowledge folder snapshotted through the harvest's `withTreeAt`),
 * the playbook's rules, one line each (the kit's `playbookLines`: a rule kept only in a form was once
 * judged "stated nowhere", #2207), and the lessons of the retros already merged (every `lessons[].text` of each run in the
 * `retro.json` files of the shipped folder), oldest PRD first, each once. Only the config and the
 * knowledge folders are snapshotted, never the whole delivery folder: of it, the shipped folder is
 * listed in one request and only its `retro.json` files are read.
 */
export async function gatherKnowledge(
  octokit: Octokit,
  { owner, repo, sha, config }: { owner: string; repo: string; sha: string; config: Config },
): Promise<Known> {
  const narrowed = { ...config, paths: { ...config.paths, delivery: null, glossary: null } };
  const summary = await withTreeAt(octokit, { owner, repo, sha, config: narrowed }, (ctx) => ({
    ...knowledgeSummary({ ctx }),
    playbook: playbookLines({ ctx }),
  }));
  const shipped = foldersLayout('', config.paths).dirs.shipped;
  return {
    knowledge: { principles: summary.principles, laws: summary.laws, decisions: summary.decisions, playbook: summary.playbook },
    lessons: lessonsIn(await retroFilesAt(octokit, { owner, repo, sha, dir: shipped })),
  };
}

const TREE = 'GET /repos/{owner}/{repo}/git/trees/{tree_sha}';
const BLOB = 'GET /repos/{owner}/{repo}/git/blobs/{file_sha}';
const RETRO_JSON = /^[^/]+\/retro\.json$/;

/**
 * The text of every `<folder>/retro.json` directly under `dir` at `sha`, by folder name: the tree
 * walked down to `dir`, `dir` listed in one recursive request, then one blob read per file. Nothing
 * when the commit holds no `dir`.
 */
async function retroFilesAt(octokit: Octokit, { owner, repo, sha, dir }: { owner: string; repo: string; sha: string; dir: string }): Promise<string[]> {
  let treeSha = sha;
  for (const name of dir.split('/').filter(Boolean)) {
    const data = parseGitHub(TreeSchema, (await octokit.request(TREE, { owner, repo, tree_sha: treeSha })).data, TREE);
    const entry = data.tree.find((candidate) => candidate.path === name && candidate.type === 'tree');
    if (!entry) return [];
    treeSha = entry.sha;
  }
  const data = parseGitHub(TreeSchema, (await octokit.request(TREE, { owner, repo, tree_sha: treeSha, recursive: '1' })).data, TREE);
  const files = data.tree
    .filter((entry) => entry.type === 'blob' && RETRO_JSON.test(entry.path))
    .sort((a, b) => a.path.localeCompare(b.path));
  const texts = [];
  for (const file of files) {
    const blob = parseGitHub(BlobSchema, (await octokit.request(BLOB, { owner, repo, file_sha: file.sha })).data, BLOB);
    texts.push(Buffer.from(blob.content ?? '', blob.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8'));
  }
  return texts;
}

/** Every `lessons[].text` of the runs in these `retro.json` texts, in order, each once; a file that is not JSON gives none. */
export function lessonsIn(texts: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const text of texts) {
    let doc: unknown = null;
    try {
      doc = text ? JSON.parse(text) : null;
    } catch {
      doc = null;
    }
    const runs = RetroDocSchema.parse(doc).runs;
    for (const lesson of runs.flatMap((run) => RetroLessonsSchema.parse(run).lessons)) {
      if (typeof lesson.text !== 'string' || !lesson.text || seen.has(lesson.text)) continue;
      seen.add(lesson.text);
      out.push(lesson.text);
    }
  }
  return out;
}

/**
 * The folder a retro is written into: the PRD's shipped folder, always (PRD 82). A PRD merged
 * without being shipped is shipped by the knowledge harvest on the same merge, so its retro waits
 * for it there rather than in the inbox.
 */
export function retroFolder(prd: { folder: string }, config: Config): string {
  return `${foldersLayout('', config.paths).dirs.shipped}/${prd.folder.split('/').at(-1)}`;
}

/** The fact sheet naming `folder` as the one its retro is written into. */
function inFolder(sheet: FactSheet, folder: string): FactSheet {
  return sheet.prd.folder === folder ? sheet : { ...sheet, prd: { ...sheet.prd, folder } };
}

/** A run's fact sheet with its findings numbered on from the `count` findings of the runs before it. */
function numberedAfter(sheet: FactSheet, count: number): FactSheet {
  if (count === 0) return sheet;
  return { ...sheet, findings: sheet.findings.map((finding, index) => ({ ...finding, ref: `F${count + index + 1}` })) };
}

/** What a run did, as the function returns it: what it published, or the verdict comment it left. */
function outcome({ sheet, record, published, comment, verdict, queued }: RunResult) {
  const counts = { findings: sheet.findings.length, issues: Object.keys(record.issues).length };
  if (published) return { ...counts, ...published, ...(queued ? { queued } : {}) };
  return { ...counts, verdict: verdict.judged ? NO_NEW_LESSON : NOT_JUDGED, comment };
}

/**
 * The failure hook of the `retro` kind: once the job ended failed, one comment on the merged PR, "The retro could
 * not run: <reason>", rewritten in place on a later failure, never a second one.
 */
export function retroFailureHook({ octokitFor }: { octokitFor: OctokitFor<Octokit> }): FailureHook {
  return failureCommentHook(octokitFor, { schema: RetroPayloadSchema, marker: FAILURE_MARKER, what: 'The retro' });
}
