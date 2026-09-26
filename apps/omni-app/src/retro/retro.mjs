// `retro`: the Inngest function wiring the retro's units (PRD 72, "Flow"). Its own function: it never
// shares a run with "outbox-check", and never reads or writes a check run.
//
//   step "qualify"          the config at the merge SHA; a feature PR by the app's rule; its PRD folder
//   step "gather-pulls"     the sub-PRs into the feature branch
//   steps "gather-<kind>"   each kind's GitHub reads, one step per kind (`kinds/index.mjs`)
//   step "facts"            `detect`: the fact sheet — memoized, so a retry never changes a number
//   step "narrate"          the model's prose, from this Vercel function
//   step "guard"            each field of prose accepted, or dropped with its reason
//   step "publish-issues"   one retro issue per finding, worst first
//   step "publish"          the branch, retro.md + retro.json, then the PR
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
// whole retro, both runs' findings, and when it gives nothing the merge run's words stay; and the
// merge run's record is written again beside its own.
//
// `createRetro` takes the Inngest client and `octokitFor(installationId)`, so a test runs the real
// function against a stubbed GitHub; `followUp` adds the day-14 run and the daily schedule that wakes
// it, and a test passes its fourteen days through the clock and the waits. `retro` is the one the app
// serves, with its day-14 run.
import { internalEvents } from 'inngest';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.mjs';
import { inngest, RETRO_EVENT } from '../inngest-client.mjs';
import { installationOctokit } from '../outbox-check/outbox-check.mjs';
import { listComments } from '../outbox-check/github.mjs';
import { detect } from './detect.mjs';
import { listPullsInto } from './github.mjs';
import { guard } from './guard.mjs';
import { publishIssues } from './issues.mjs';
import { followUpAt } from './kinds/after-merge.mjs';
import { KINDS, kindsFor } from './kinds/index.mjs';
import { narrate } from './narrate.mjs';
import { publishRetro } from './publish.mjs';
import { qualify } from './qualify.mjs';

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

/**
 * @param {{
 *   client: import('inngest').Inngest,
 *   octokitFor: (installationId: number) => Promise<{ request: Function }> | { request: Function },
 *   env?: Record<string, string | undefined>,
 *   kinds?: readonly import('./kinds/index.mjs').Kind[],
 *   followUp?: boolean,
 * }} deps
 */
export function createRetro({ client, octokitFor, env = process.env, kinds = KINDS, followUp = false }) {
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
      const context = { step, github, env, owner, repo, pr, prd, config, pulls };
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
async function runRetro({ step, github, env, owner, repo, pr, prd, config, pulls, run, kinds, scope, earlier = null }) {
  const id = (name) => (run === MERGE_RUN ? name : `${name}-${run}`);

  const records = {};
  for (const kind of kinds) {
    records[kind.id] = (await step.run(id(`gather-${kind.id}`), async () => kind.gather(await github(), scope))) ?? null;
  }

  const before = earlier?.sheet.findings ?? [];
  const sheet = await step.run(id('facts'), () =>
    numberedAfter(detect({ run, pr, prd, config, pulls, records, kinds }), before.length),
  );

  // The model writes the words of the whole retro, so at day 14 it is given both runs' findings.
  const whole = earlier ? { ...sheet, findings: [...before, ...sheet.findings] } : sheet;
  const narrated = await step.run(id('narrate'), () =>
    narrate({ sheet: whole, prd: { title: prd.title, problem: prd.problem }, env }),
  );
  const guarded = await step.run(id('guard'), () => guard({ reply: narrated.reply ?? null, sheet: whole }));
  const prose = guarded.prose ?? earlier?.prose ?? null;

  const retroPath = `${prd.folder}/retro.md`;
  const issues = await step.run(id('publish-issues'), async () =>
    publishIssues(await github(), { owner, repo, config, sheet, prose, retroPath }),
  );

  const record = {
    ...sheet,
    narration: {
      model: narrated.model ?? null,
      reason: guarded.prose ? null : (narrated.reason ?? 'the prose was refused'),
      dropped: guarded.dropped ?? [],
    },
    issues: issues ?? {},
  };
  const published = await step.run(id('publish'), async () =>
    publishRetro(await github(), { owner, repo, config, prd, pr, record, prose, earlier: earlier ? [earlier.record] : [] }),
  );
  return { sheet, prose, record, published };
}

/** A run's fact sheet with its findings numbered on from the `count` findings of the runs before it. */
function numberedAfter(sheet, count) {
  if (count === 0) return sheet;
  return { ...sheet, findings: sheet.findings.map((finding, index) => ({ ...finding, ref: `F${count + index + 1}` })) };
}

/** What a run did, as the function returns it. */
function outcome({ sheet, record, published }) {
  return { findings: sheet.findings.length, issues: Object.keys(record.issues).length, ...published };
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
