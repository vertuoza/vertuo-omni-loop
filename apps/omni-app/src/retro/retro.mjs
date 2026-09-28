// `retro`: the Inngest function wiring the retro's units (PRD 72, "Flow"). Its own function: it never
// shares a run with "outbox-check", and never reads or writes a check run.
//
//   step "qualify"          the config at the merge SHA; a feature PR by the app's rule; its PRD folder
//   step "gather-pulls"     the sub-PRs into the feature branch
//   steps "gather-<kind>"   each kind's GitHub reads, one step per kind (`kinds/index.mjs`)
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
//                           is open, else to a new `<branch>-day-14` PR (`publish.mjs`)
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
import { internalEvents } from 'inngest';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.mjs';
import { foldersLayout } from 'vertuo-omni-plan/kit/lib/layout.mjs';
import { inngest, RETRO_EVENT } from '../inngest-client.mjs';
import { installationOctokit } from '../outbox-check/outbox-check.mjs';
import { listComments } from '../outbox-check/github.mjs';
import { detect } from './detect.mjs';
import { knowledgeSummary } from 'vertuo-omni-plan/kit/lib/knowledge/classify.mjs';
import { withTreeAt } from '../knowledge-harvest/github.mjs';
import { upsertComment } from '../verdict-comment/verdict-comment.mjs';
import { listPullsInto } from './github.mjs';
import { guard } from './guard.mjs';
import { publishIssues } from './issues.mjs';
import { followUpAt } from './kinds/after-merge.mjs';
import { KINDS, kindsFor } from './kinds/index.mjs';
import { narrate } from './narrate.mjs';
import { publishRetro } from './publish.mjs';
import { qualify } from './qualify.mjs';
import { verdictComment } from './render.mjs';

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

const SCHEDULED = internalEvents.ScheduledTimer;

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
export const verdictMarker = (prefix) => `<!-- ${prefix}-retro-verdict -->`;
export const VERDICT_MARKER = verdictMarker(MARKER_PREFIX);

/** How the verdict comment opens: judged not worth a PR, or not judged at all. */
export const NO_NEW_LESSON = 'no new lesson';
export const NOT_JUDGED = 'not judged';

/**
 * @param {{
 *   client: import('inngest').Inngest,
 *   octokitFor: (installationId: number) => Promise<{ request: Function }> | { request: Function },
 *   env?: Record<string, string | undefined>,
 *   fetch?: typeof fetch,   the model call's fetch; the global one when not given
 *   kinds?: readonly import('./kinds/index.mjs').Kind[],
 *   followUp?: boolean,
 * }} deps
 */
export function createRetro({ client, octokitFor, env = process.env, fetch = undefined, kinds = KINDS, followUp = false }) {
  return client.createFunction(
    {
      id: RETRO_FUNCTION_ID,
      name: 'omni-loop · retro',
      triggers: followUp ? [{ event: RETRO_EVENT }, { cron: DAILY }] : [{ event: RETRO_EVENT }],
      concurrency: CONCURRENCY,
      retries: 3,
      onFailure: createRetroFailureHandler({ octokitFor }),
    },
    async ({ event, step }) => {
      if (event.name === SCHEDULED) {
        await step.sendEvent(DAY_STEP, { name: DAY_EVENT, data: {} });
        return { sent: DAY_EVENT };
      }

      const { installationId, owner, repo, prNumber, mergeSha, mergedAt } = event.data;
      const github = async () => octokitFor(installationId);

      const qualified = await step.run('qualify', async () => qualify(await github(), { owner, repo, prNumber, mergeSha }));
      if (qualified.skip) return { skipped: qualified.skip };
      const { pr, prd, config } = qualified;

      const pulls = await step.run('gather-pulls', async () => listPullsInto(await github(), { owner, repo, base: pr.headRef }));

      const scope = { owner, repo, mergeSha, mergedAt: mergedAt ?? pr.mergedAt, pr, prd, config, pulls };
      const context = { step, github, env, fetch, owner, repo, pr, prd, config, pulls };
      const first = await runRetro({ ...context, run: MERGE_RUN, kinds: kindsFor(MERGE_RUN, kinds), scope });
      const result = { prd: prd.number, ...outcome(first) };

      const laterKinds = kindsFor(FOLLOW_UP_RUN, kinds);
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

/**
 * Waits until `due` a day at a time, never on one long sleep: each wait ends on the daily schedule's
 * tick, or after `DAY_WAIT` with none, and the tick's time, or the clock read after a wait no tick
 * ended, says whether the day has come. A run already past `due`, like a late replay, does not wait.
 */
async function waitForDay(step, due) {
  const until = Date.parse(due);
  let now = await step.run(CLOCK_STEP, () => Date.now());
  for (let turn = 1; now < until; turn += 1) {
    const tick = await step.waitForEvent(`${FOLLOW_UP_STEP}-${turn}`, { event: DAY_EVENT, timeout: DAY_WAIT });
    now = tick?.ts ?? (await step.run(`${CLOCK_STEP}-${turn}`, () => Date.now()));
  }
}

/**
 * One run of the retro, from its kinds' reads to its published PR. `earlier` is the run it follows,
 * when there is one: its findings are numbered on from, asked about again, and published again.
 */
async function runRetro({ step, github, env, fetch, owner, repo, pr, prd, config, pulls, run, kinds, scope, earlier = null }) {
  const id = (name) => (run === MERGE_RUN ? name : `${name}-${run}`);

  const records = {};
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
    dropped: guarded.dropped ?? [],
  };
  const base = { ...sheet, narration, verdict: prose?.verdict ?? null, lessons: lessonsOf(prose) };
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

  const record = { ...base, issues: issues ?? {} };
  const published = await step.run(id('publish'), async () =>
    publishRetro(await github(), { owner, repo, config, prd: { ...prd, folder }, pr, record, prose, earlier: earlier ? [earlier.record] : [] }),
  );
  return { sheet, prose, known, record, published, comment: null, verdict };
}

/**
 * What the judge said, as the retro acts on it: worth a pull request or not, judged or not, and why.
 * Only a verdict `guard` accepted is judged; no prose, or a refused verdict, is not judged.
 * @returns {{ worthIt: boolean, judged: boolean, reason: string }}
 */
export function verdictOf(prose, narrationReason) {
  const verdict = prose?.verdict;
  if (!prose) return { worthIt: false, judged: false, reason: narrationReason ?? 'the prose was refused' };
  if (!verdict || typeof verdict.worthIt !== 'boolean') {
    return { worthIt: false, judged: false, reason: `the verdict was refused: ${verdict?.dropped ?? 'it gives no verdict'}` };
  }
  return { worthIt: verdict.worthIt, judged: true, reason: verdict.reason };
}

/** The lessons `guard` accepted, as `retro.json` keeps them for the retros after this one. */
function lessonsOf(prose) {
  return (prose?.lessons ?? [])
    .filter((lesson) => typeof lesson?.text === 'string' && lesson.text && !lesson.text.startsWith('_Dropped: '))
    .map((lesson) => ({ text: lesson.text, findings: [...(lesson.findings ?? [])] }));
}

/**
 * What the judge compares a retro with, read at the merge commit `sha`: the knowledge summary (the
 * kit's `knowledgeSummary`, over the knowledge folder snapshotted through the harvest's `withTreeAt`)
 * and the lessons of the retros already merged (every `lessons[].text` of each run in the
 * `retro.json` files of the shipped folder), oldest PRD first, each once. Only the config and the
 * knowledge folders are snapshotted, never the whole delivery folder: of it, the shipped folder is
 * listed in one request and only its `retro.json` files are read.
 * @returns {Promise<{ knowledge: { principles: object[], laws: object[], decisions: object[] }, lessons: string[] }>}
 */
export async function gatherKnowledge(octokit, { owner, repo, sha, config }) {
  const narrowed = { ...config, paths: { ...config.paths, delivery: null, playbook: null, glossary: null } };
  const summary = await withTreeAt(octokit, { owner, repo, sha, config: narrowed }, (ctx) => knowledgeSummary({ ctx }));
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
 * @returns {Promise<string[]>}
 */
async function retroFilesAt(octokit, { owner, repo, sha, dir }) {
  let treeSha = sha;
  for (const name of dir.split('/').filter(Boolean)) {
    const { data } = await octokit.request(TREE, { owner, repo, tree_sha: treeSha });
    const entry = data.tree.find((candidate) => candidate.path === name && candidate.type === 'tree');
    if (!entry) return [];
    treeSha = entry.sha;
  }
  const { data } = await octokit.request(TREE, { owner, repo, tree_sha: treeSha, recursive: '1' });
  const files = data.tree
    .filter((entry) => entry.type === 'blob' && RETRO_JSON.test(entry.path))
    .sort((a, b) => a.path.localeCompare(b.path));
  const texts = [];
  for (const file of files) {
    const { data: blob } = await octokit.request(BLOB, { owner, repo, file_sha: file.sha });
    texts.push(Buffer.from(blob.content ?? '', blob.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8'));
  }
  return texts;
}

/** Every `lessons[].text` of the runs in these `retro.json` texts, in order, each once; a file that is not JSON gives none. */
export function lessonsIn(texts) {
  const seen = new Set();
  const out = [];
  for (const text of texts) {
    let doc = null;
    try {
      doc = text ? JSON.parse(text) : null;
    } catch {
      doc = null;
    }
    const runs = Array.isArray(doc?.runs) ? doc.runs : [];
    for (const lesson of runs.flatMap((run) => (Array.isArray(run?.lessons) ? run.lessons : []))) {
      if (typeof lesson?.text !== 'string' || !lesson.text || seen.has(lesson.text)) continue;
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
export function retroFolder(prd, config) {
  return `${foldersLayout('', config.paths).dirs.shipped}/${prd.folder.split('/').at(-1)}`;
}

/** The fact sheet naming `folder` as the one its retro is written into. */
function inFolder(sheet, folder) {
  return sheet.prd?.folder === folder ? sheet : { ...sheet, prd: { ...sheet.prd, folder } };
}

/** A run's fact sheet with its findings numbered on from the `count` findings of the runs before it. */
function numberedAfter(sheet, count) {
  if (count === 0) return sheet;
  return { ...sheet, findings: sheet.findings.map((finding, index) => ({ ...finding, ref: `F${count + index + 1}` })) };
}

/** What a run did, as the function returns it: what it published, or the verdict comment it left. */
function outcome({ sheet, record, published, comment, verdict }) {
  const counts = { findings: sheet.findings.length, issues: Object.keys(record.issues).length };
  if (published) return { ...counts, ...published };
  return { ...counts, verdict: verdict.judged ? NO_NEW_LESSON : NOT_JUDGED, comment };
}

/**
 * The failure handler: once the run has failed after its retries, one comment on the merged PR —
 * "The retro could not run: <reason>" — rewritten in place on a later failure, never a second one.
 * A scheduled run has no merged PR, so its failure leaves no comment.
 */
export function createRetroFailureHandler({ octokitFor }) {
  return async ({ event, error, step }) => {
    const { installationId, owner, repo, prNumber } = event.data.event.data ?? {};
    if (!installationId || !prNumber) return { skipped: 'not a merge' };
    const reason = firstLine(error?.message ?? event.data.error?.message);
    const body = `${FAILURE_MARKER}\nThe retro could not run: ${reason}\n`;

    const run = (id, fn) => (step?.run ? step.run(id, fn) : fn());
    return run('comment-failure', async () => {
      const octokit = await octokitFor(installationId);
      const comments = await listComments(octokit, { owner, repo, prNumber });
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
      const { data } = await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        owner,
        repo,
        issue_number: prNumber,
        body,
      });
      return { commentId: data.id, reason, created: true };
    });
  };
}

function firstLine(reason) {
  const text = String(reason ?? 'unknown error').trim();
  return text.split('\n')[0] || 'unknown error';
}

export const retro = createRetro({ client: inngest, octokitFor: installationOctokit, followUp: true });
