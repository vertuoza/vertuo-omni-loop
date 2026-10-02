// `retro`: the Inngest function wiring the retro's units (PRD 72, "Flow"). Its own function: it never
// shares a run with "outbox-check", and never reads or writes a check run.
//
//   step "qualify"          the config at the merge SHA; a feature PR by the app's rule; its PRD folder
//   step "gather-pulls"     the sub-PRs into the feature branch
//   steps "gather-<kind>"   each kind's GitHub reads, one step per kind (`kinds/index.ts`)
//   step "facts"            `detect`: the fact sheet — memoized, so a retry never changes a number
//   step "gather-knowledge" what the judge compares with (PRD 487): the knowledge summary and the
//                           lessons of the retros already merged, both at the merge commit
//   step "narrate"          the model's prose and its verdict, from this Vercel function
//   step "guard"            each field of prose accepted, or dropped with its reason; the verdict too
//   then, when the verdict says the retro is worth a pull request:
//   step "publish-issues"   one retro issue per finding the judge kept, worst first
//   step "publish"          the branch, retro.md + retro.json in the PRD's shipped folder, then the PR
//   or else — not worth it, or not judged (no verdict, or one `guard` refused):
//   step "verdict"          no branch, no file, no PR, no issue: one comment on the merged feature PR,
//                           marked `<markers.prefix>-retro-verdict` and rewritten in place on a replay
//   step "clock-day-14"     the time, once the merge run is out
//   "wait-day-14-<n>"       a day at a time, until the merge plus `THRESHOLDS.afterMergeDays` days:
//                           each wait ends on the tick of the function's own daily schedule, or after
//                           `DAY_WAIT` with none, and then "clock-day-14-<n>" reads the time
//   the same steps, "-day-14" after each id, for the kinds of the day-14 run: an "After merge"
//                           section, issues for its new findings, committed to the retro PR while it
//                           is open, else to a new `<branch>-day-14` PR (`publish.ts`)
//   onFailure               one comment on the merged PR: "The retro could not run: <reason>"
//
// A merge that is not a feature PR ends at "qualify" and posts nothing.
//
// The day-14 run never hangs on one long sleep: the app's Inngest plan caps any sleep at seven days
// (answered on #75, playbook › architecture › Boundaries). So the same function also runs on a daily
// schedule (`DAILY`), where it does one thing: step "day-passed" sends `DAY_EVENT`, the tick that
// wakes every retro waiting for its day-14 run. No wait lasts longer than `DAY_WAIT`, so a schedule
// that misses a day, or never runs, makes the day-14 run late by that much at most, never lost.
//
// The day-14 run carries on from the merge run held in this same run: its kinds are handed the merge
// run's fact sheet (`scope.atMerge`, the churn ranges a fix is placed against); its findings are
// numbered on from the merge run's (F1… stay what they were); the model is asked again about the
// whole retro, both runs' findings, with the knowledge the merge run gathered, and when it gives
// nothing the merge run's words, its verdict included, stay; and the merge run's record is written
// again beside its own. Worth it, it commits to the merge run's PR while that is open, else opens
// one (the merge run may have been worth none); its issues are for its own kept findings, and for
// the merge run's too when the merge run opened none. Not worth it, it rewrites the verdict comment.
//
// `createRetro` takes the Inngest client and `octokitFor(installationId)`, so a test runs the real
// function against a stubbed GitHub; `followUp` adds the day-14 run and the daily schedule that wakes
// it, and a test passes its fourteen days through the clock and the waits. `retro` is the one the app
// serves, with its day-14 run.
//
// The event's data is parsed by `RetroEventSchema` before use, and every GitHub answer this file reads
// by its schema in `github.schema.ts`.
import { internalEvents } from 'inngest';
import type { Inngest } from 'inngest';
import { z } from 'zod';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { foldersLayout } from 'vertuo-omni-plan/kit/lib/layout.ts';
import { parseOrThrow } from 'vertuo-omni-plan/kit/lib/schema/parse-or-throw.ts';
import { inngest, RETRO_EVENT } from '../inngest-client.ts';
import { installationOctokit } from '../outbox-check/outbox-check.ts';
import { listComments } from '../outbox-check/github.ts';
import { firstLine } from '../outbox-check/github-schema.ts';
import { detect } from './detect.ts';
import { knowledgeSummary } from 'vertuo-omni-plan/kit/lib/knowledge/classify.ts';
import { withTreeAt } from '../knowledge-harvest/github.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { commentOnFailure, upsertComment } from '../verdict-comment/verdict-comment.ts';
import { listPullsInto } from './github.ts';
import { BlobSchema, CreatedCommentSchema, RetroDocSchema, RetroLessonsSchema, TreeSchema, parseGitHub } from './github.schema.ts';
import { guard } from './guard.ts';
import { publishIssues } from './issues.ts';
import { followUpAt } from './kinds/after-merge.ts';
import { KINDS, type Kind } from './kinds/index.ts';
import { narrate } from './narrate.ts';
import { publishRetro } from './publish.ts';
import { qualify } from './qualify.ts';
import { verdictComment } from './render.ts';
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

export const RETRO_FUNCTION_ID = 'retro';

/** The two runs of a retro: at the merge, and fourteen days later. */
export const MERGE_RUN = 'merge';
export const FOLLOW_UP_RUN = 'day-14';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The function's daily schedule (UTC), which wakes the retros waiting for their day-14 run. */
export const DAILY = '0 6 * * *';
/** The tick the daily schedule sends: a day has passed. */
export const DAY_EVENT = 'omni-loop/retro.day-passed';
/** The step the scheduled run sends the tick in. */
export const DAY_STEP = 'day-passed';
/**
 * The longest one wait lasts when no tick comes: two days, well inside the plan's seven, so a missed
 * schedule makes the day-14 run two days late at most.
 */
export const DAY_WAIT = 2 * DAY_MS;
/** Between the two runs: the n-th wait is `<FOLLOW_UP_STEP>-<n>`; the clock read after it, `<CLOCK_STEP>-<n>`. */
export const FOLLOW_UP_STEP = 'wait-day-14';
export const CLOCK_STEP = 'clock-day-14';

/** The name of the event a cron trigger sends, as the event's name reads it: text, not the enum. */
const SCHEDULED: string = internalEvents.ScheduledTimer;

/**
 * One retro at a time per repository. The spec asks for one per repository and PRD; the PRD is known
 * only once "qualify" has read the repository, so the key is the repository alone, which also keeps
 * two retros of one PRD apart. Inngest counts the steps running against it, never a run waiting, so
 * a retro waiting for its day-14 run holds nothing up.
 */
export const CONCURRENCY = Object.freeze({ key: 'event.data.repository', limit: 1 });

/** The prefix of the failure comment's marker. The config may be what failed to read, so the kit's default. */
const MARKER_PREFIX = parseConfig('kit: 1\n').markers.prefix;
export const FAILURE_MARKER = `<!-- ${MARKER_PREFIX}-retro-failed -->`;

/** The marker of the comment a retro not worth a pull request keeps on the merged feature PR. */
export const verdictMarker = (prefix: string): string => `<!-- ${prefix}-retro-verdict -->`;
export const VERDICT_MARKER = verdictMarker(MARKER_PREFIX);

/** How the verdict comment opens: judged not worth a PR, or not judged at all. */
export const NO_NEW_LESSON = 'no new lesson';
export const NOT_JUDGED = 'not judged';

/** The data of the event `/api/github` sends for a merged pull request. */
export const RetroEventSchema = z.object({
  installationId: z.number(),
  owner: z.string(),
  repo: z.string(),
  prNumber: z.number(),
  mergeSha: z.string(),
  mergedAt: z.string().nullish(),
});

/**
 * The merged pull request a failed run was for, as the failure event carries it; a scheduled run,
 * or any other event, carries none, and a field of the wrong type reads as missing.
 */
const FailedEventSchema = z
  .object({
    installationId: z.number().optional().catch(undefined),
    owner: z.string().optional().catch(undefined),
    repo: z.string().optional().catch(undefined),
    prNumber: z.number().optional().catch(undefined),
  })
  .catch({});

/** The step tools the retro uses. Every value it hands `run` is plain JSON, so it comes back as given. */
type RetroStep = {
  run<T>(id: string, fn: () => T | Promise<T>): Promise<T>;
  sendEvent(id: string, payload: { name: string; data: Record<string, never> }): Promise<unknown>;
  waitForEvent(id: string, options: { event: string; timeout: number }): Promise<{ ts?: number } | null>;
};

type Env = Record<string, string | undefined>;

export type RetroDeps = {
  client: Inngest.Any;
  octokitFor: OctokitFor<Octokit>;
  env?: Env;
  /** The model call's fetch; the global one when not given. */
  fetch?: typeof fetch;
  kinds?: readonly Kind[];
  followUp?: boolean;
};

/** What the judge said, as the retro acts on it. */
export type VerdictOutcome = { worthIt: boolean; judged: boolean; reason: string };

type Published = Awaited<ReturnType<typeof publishRetro>>;
type Commented = Awaited<ReturnType<typeof upsertComment>>;

/** One run of the retro, as the run after it reads it. */
type RunResult = {
  sheet: FactSheet;
  prose: Prose | null;
  known: Known;
  record: RunRecord & { issues: IssueLinks };
  published: Published | null;
  comment: Commented | null;
  verdict: VerdictOutcome;
};

export function createRetro({ client, octokitFor, env = process.env, fetch, kinds = KINDS, followUp = false }: RetroDeps) {
  return client.createFunction(
    {
      id: RETRO_FUNCTION_ID,
      name: 'omni-loop · retro',
      triggers: followUp ? [{ event: RETRO_EVENT }, { cron: DAILY }] : [{ event: RETRO_EVENT }],
      concurrency: CONCURRENCY,
      retries: 3,
      onFailure: createRetroFailureHandler({ octokitFor }),
    },
    async ({ event, step: tools }) => {
      const step = tools as RetroStep; // ts-allow: Inngest types step.run's result as its JSON form; every value the retro hands it is plain JSON already
      if (event.name === SCHEDULED) {
        await step.sendEvent(DAY_STEP, { name: DAY_EVENT, data: {} });
        return { sent: DAY_EVENT };
      }

      const { installationId, owner, repo, prNumber, mergeSha, mergedAt } = parseEvent(event.data);
      const github = async () => octokitFor(installationId);

      const qualified = await step.run('qualify', async () => qualify(await github(), { owner, repo, prNumber, mergeSha }));
      if (qualified.skip !== null) return { skipped: qualified.skip };
      const { pr, prd, config } = qualified;

      const pulls = await step.run('gather-pulls', async () => listPullsInto(await github(), { owner, repo, base: pr.headRef }));

      const scope: Scope = { owner, repo, mergeSha, mergedAt: mergedAt ?? pr.mergedAt, pr, prd, config, pulls };
      const context = { step, github, env, fetch, owner, repo, pr, prd, config, pulls };
      const first = await runRetro({ ...context, run: MERGE_RUN, kinds: kindsIn(MERGE_RUN, kinds), scope });
      const result = { prd: prd.number, ...outcome(first) };

      const laterKinds = kindsIn(FOLLOW_UP_RUN, kinds);
      if (!followUp || laterKinds.length === 0) return result;

      await waitForDay(step, followUpAt(scope.mergedAt));
      const later = await runRetro({
        ...context,
        run: FOLLOW_UP_RUN,
        kinds: laterKinds,
        scope: { ...scope, atMerge: first.sheet },
        earlier: first,
      });
      return { ...result, followUp: outcome(later) };
    },
  );
}

/** The kinds that take part in one run, in registry order, as `kindsFor` picks them from any list. */
function kindsIn(run: Run, kinds: readonly Kind[]): Kind[] {
  return kinds.filter((kind) => kind.runs.includes(run));
}

/** The event's data, parsed; an event missing a field fails, naming it. */
function parseEvent(data: unknown): z.infer<typeof RetroEventSchema> {
  return parseOrThrow(RetroEventSchema, data, `The ${RETRO_EVENT} event carries an unexpected shape`);
}

/**
 * Waits until `due` a day at a time, never on one long sleep: each wait ends on the daily schedule's
 * tick, or after `DAY_WAIT` with none, and the tick's time, or the clock read after a wait no tick
 * ended, says whether the day has come. A run already past `due`, like a late replay, does not wait.
 */
async function waitForDay(step: RetroStep, due: string): Promise<void> {
  const until = Date.parse(due);
  let now = await step.run(CLOCK_STEP, () => Date.now());
  for (let turn = 1; now < until; turn += 1) {
    const tick = await step.waitForEvent(`${FOLLOW_UP_STEP}-${turn}`, { event: DAY_EVENT, timeout: DAY_WAIT });
    now = tick?.ts ?? (await step.run(`${CLOCK_STEP}-${turn}`, () => Date.now()));
  }
}

type RunInput = {
  step: RetroStep;
  github: () => Promise<Octokit>;
  env: Env;
  fetch: typeof fetch | undefined;
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
};

/**
 * One run of the retro, from its kinds' reads to its published PR. `earlier` is the run it follows,
 * when there is one: its findings are numbered on from, asked about again, and published again.
 */
async function runRetro({ step, github, env, fetch, owner, repo, pr, prd, config, pulls, run, kinds, scope, earlier = null }: RunInput): Promise<RunResult> {
  const id = (name: string) => (run === MERGE_RUN ? name : `${name}-${run}`);

  const records: Record<string, unknown> = {};
  for (const kind of kinds) {
    records[kind.id] = (await step.run(id(`gather-${kind.id}`), async () => kind.gather(await github(), scope))) ?? null;
  }

  // Read from where the PRD's folder was at the merge; written, always, into its shipped folder.
  const folder = retroFolder(prd, config);
  const before = earlier?.sheet.findings ?? [];
  const sheet = await step.run(id('facts'), () =>
    inFolder(numberedAfter(detect({ run, pr, prd, config, pulls, records, kinds }), before.length), folder),
  );

  // The model writes the words of the whole retro, so at day 14 it is given both runs' findings,
  // and the knowledge the merge run gathered.
  const whole = earlier ? { ...sheet, findings: [...before, ...sheet.findings] } : sheet;
  const known =
    earlier?.known ??
    (await step.run(id('gather-knowledge'), async () => gatherKnowledge(await github(), { owner, repo, sha: scope.mergeSha, config })));
  const narrated = await step.run(id('narrate'), () =>
    narrate({ sheet: whole, prd: { title: prd.title, problem: prd.problem }, knowledge: known.knowledge, lessons: known.lessons, env, fetch }),
  );
  const guarded = await step.run(id('guard'), () => guard({ reply: narrated.reply ?? null, sheet: whole }));
  const prose = guarded.prose ?? earlier?.prose ?? null;
  const verdict = verdictOf(prose, narrated.reason);

  const narration = {
    model: narrated.model ?? null,
    reason: guarded.prose ? null : (narrated.reason ?? 'the prose was refused'),
    dropped: guarded.dropped,
  };
  const base: RunRecord = { ...sheet, narration, verdict: prose?.verdict ?? null, lessons: lessonsOf(prose) };
  const runs = [...(earlier ? [earlier.record] : []), base];

  if (!verdict.worthIt) {
    const comment = await step.run(id('verdict'), async () =>
      upsertComment(await github(), {
        owner,
        repo,
        prNumber: pr.number,
        marker: verdictMarker(config.markers.prefix),
        text: verdictComment({ judged: verdict.judged, reason: verdict.reason, runs, prose }),
      }),
    );
    return { sheet, prose, known, record: { ...base, issues: {} }, published: null, comment, verdict };
  }

  // The merge run's kept findings get their issues at day 14 when the merge run opened none.
  const retroPath = `${folder}/retro.md`;
  const issueSheet = earlier && !earlier.published ? whole : sheet;
  const issues = await step.run(id('publish-issues'), async () =>
    publishIssues(await github(), { owner, repo, config, sheet: issueSheet, prose, retroPath }),
  );

  const record = { ...base, issues };
  const published = await step.run(id('publish'), async () =>
    publishRetro(await github(), { owner, repo, config, prd: { ...prd, folder }, pr, record, prose, earlier: earlier ? [earlier.record] : [] }),
  );
  return { sheet, prose, known, record, published, comment: null, verdict };
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
 * kit's `knowledgeSummary`, over the knowledge folder snapshotted through the harvest's `withTreeAt`)
 * and the lessons of the retros already merged (every `lessons[].text` of each run in the
 * `retro.json` files of the shipped folder), oldest PRD first, each once. Only the config and the
 * knowledge folders are snapshotted, never the whole delivery folder: of it, the shipped folder is
 * listed in one request and only its `retro.json` files are read.
 */
export async function gatherKnowledge(
  octokit: Octokit,
  { owner, repo, sha, config }: { owner: string; repo: string; sha: string; config: Config },
): Promise<Known> {
  const narrowed = { ...config, paths: { ...config.paths, delivery: null, playbook: null, glossary: null } };
  const summary = await withTreeAt(octokit, { owner, repo, sha, config: narrowed }, (ctx: Parameters<typeof knowledgeSummary>[0]['ctx']) =>
    knowledgeSummary({ ctx }),
  );
  const shipped = foldersLayout('', config.paths).dirs.shipped;
  return {
    knowledge: { principles: summary.principles, laws: summary.laws, decisions: summary.decisions },
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
function outcome({ sheet, record, published, comment, verdict }: RunResult) {
  const counts = { findings: sheet.findings.length, issues: Object.keys(record.issues).length };
  if (published) return { ...counts, ...published };
  return { ...counts, verdict: verdict.judged ? NO_NEW_LESSON : NOT_JUDGED, comment };
}

/** The failure handler's input: the failure event Inngest sends, and its step tools when it gives them. */
type FailureInput = {
  event: { data: { event: { data?: unknown }; error?: { message?: string } | null } };
  error?: { message?: string } | null;
  step?: { run?: <T>(id: string, fn: () => Promise<T>) => Promise<T> } | null;
};

/**
 * The failure handler: once the run has failed after its retries, one comment on the merged PR —
 * "The retro could not run: <reason>" — rewritten in place on a later failure, never a second one.
 * A scheduled run has no merged PR, so its failure leaves no comment.
 */
export function createRetroFailureHandler({ octokitFor }: { octokitFor: OctokitFor<Octokit> }) {
  return async ({ event, error, step }: FailureInput) => {
    const { installationId, owner, repo, prNumber } = FailedEventSchema.parse(event.data.event.data ?? {});
    if (!installationId || !prNumber) return { skipped: 'not a merge' };
    const reason = firstLine(error?.message ?? event.data.error?.message);
    const body = `${FAILURE_MARKER}\nThe retro could not run: ${reason}\n`;

    return commentOnFailure(octokitFor, step, { installationId, owner, repo }, async (octokit, where) => {
      const comments = await listComments(octokit, { ...where, prNumber });
      const existing = comments.find((comment) => comment.body.includes(FAILURE_MARKER));
      if (existing) {
        await octokit.request('PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}', {
          owner,
          repo,
          comment_id: existing.id,
          body,
        });
        return { commentId: existing.id, reason, created: false };
      }
      const COMMENT = 'POST /repos/{owner}/{repo}/issues/{issue_number}/comments';
      const { data } = await octokit.request(COMMENT, {
        owner,
        repo,
        issue_number: prNumber,
        body,
      });
      return { commentId: parseGitHub(CreatedCommentSchema, data, COMMENT).id, reason, created: true };
    });
  };
}

export const retro = createRetro({ client: inngest, octokitFor: installationOctokit, followUp: true });
