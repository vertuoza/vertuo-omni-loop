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
//   step "sleep-day-14"     until the merge plus `THRESHOLDS.afterMergeDays` days
//   the same steps, "-day-14" after each id, for the kinds of the day-14 run: an "After merge"
//                           section, issues for its new findings, committed to the retro PR while it
//                           is open, else to a new `<branch>-day-14` PR (`publish.mjs`)
//   onFailure               one comment on the merged PR: "The retro could not run: <reason>"
//
// A merge that is not a feature PR ends at "qualify" and posts nothing.
//
// The day-14 run carries on from the merge run held in this same run: its kinds are handed the merge
// run's fact sheet (`scope.atMerge`, the churn ranges a fix is placed against); its findings are
// numbered on from the merge run's (F1… stay what they were); the model is asked again about the
// whole retro, both runs' findings, and when it gives nothing the merge run's words stay; and the
// merge run's record is written again beside its own.
//
// `createRetro` takes the Inngest client and `octokitFor(installationId)`, so a test runs the real
// function against a stubbed GitHub; `followUp` adds the day-14 run, which a test passes its
// fourteen days' sleep through. `retro` is the one the app serves, with its day-14 run.
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
/** The step the function sleeps in, between the two runs. */
export const FOLLOW_UP_STEP = 'sleep-day-14';

/**
 * One retro at a time per repository. The spec asks for one per repository and PRD; the PRD is known
 * only once "qualify" has read the repository, so the key is the repository alone, which also keeps
 * two retros of one PRD apart. Inngest counts the steps running against it, never a run asleep, so a
 * retro waiting for its day-14 run holds nothing up.
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
      triggers: [{ event: RETRO_EVENT }],
      concurrency: CONCURRENCY,
      retries: 3,
      onFailure: createRetroFailureHandler({ octokitFor }),
    },
    async ({ event, step }) => {
      const { installationId, owner, repo, prNumber, mergeSha, mergedAt } = event.data;
      const github = async () => octokitFor(installationId);

      const qualified = await step.run('qualify', async () => qualify(await github(), { owner, repo, prNumber, mergeSha }));
      if (qualified.skip) return { skipped: qualified.skip };
      const { pr, prd, config } = qualified;

      const pulls = await step.run('gather-pulls', async () => listPullsInto(await github(), { owner, repo, base: pr.headRef }));

      const scope = { owner, repo, mergeSha, mergedAt, pr, prd, config, pulls };
      const context = { step, github, env, owner, repo, pr, prd, config, pulls };
      const first = await runRetro({ ...context, run: MERGE_RUN, kinds: kindsFor(MERGE_RUN, kinds), scope });
      const result = { prd: prd.number, ...outcome(first) };

      const laterKinds = kindsFor(FOLLOW_UP_RUN, kinds);
      if (!followUp || laterKinds.length === 0) return result;

      await step.sleepUntil(FOLLOW_UP_STEP, followUpAt(mergedAt));
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
 */
export function createRetroFailureHandler({ octokitFor }) {
  return async ({ event, error, step }) => {
    const { installationId, owner, repo, prNumber } = event.data.event.data;
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
