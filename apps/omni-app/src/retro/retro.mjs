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
//   onFailure               one comment on the merged PR: "The retro could not run: <reason>"
//
// A merge that is not a feature PR ends at "qualify" and posts nothing. The day-14 run (slice s8)
// continues this function with a sleep and the kinds of the "day-14" run.
//
// `createRetro` takes the Inngest client and `octokitFor(installationId)`, so a test runs the real
// function against a stubbed GitHub; `retro` is the one the app serves.
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.mjs';
import { inngest, RETRO_EVENT } from '../inngest-client.mjs';
import { installationOctokit } from '../outbox-check/outbox-check.mjs';
import { listComments } from '../outbox-check/github.mjs';
import { detect } from './detect.mjs';
import { listPullsInto } from './github.mjs';
import { guard } from './guard.mjs';
import { publishIssues } from './issues.mjs';
import { KINDS, kindsFor } from './kinds/index.mjs';
import { narrate } from './narrate.mjs';
import { publishRetro } from './publish.mjs';
import { qualify } from './qualify.mjs';

export const RETRO_FUNCTION_ID = 'retro';

/**
 * One retro at a time per repository. The spec asks for one per repository and PRD; the PRD is known
 * only once "qualify" has read the repository, so the key is the repository alone, which also keeps
 * two retros of one PRD apart.
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
 * }} deps
 */
export function createRetro({ client, octokitFor, env = process.env, kinds = KINDS }) {
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

      const run = 'merge';
      const runKinds = kindsFor(run, kinds);
      const scope = { owner, repo, mergeSha, mergedAt, pr, prd, config, pulls };
      const records = {};
      for (const kind of runKinds) {
        records[kind.id] = (await step.run(`gather-${kind.id}`, async () => kind.gather(await github(), scope))) ?? null;
      }

      const sheet = await step.run('facts', () => detect({ run, pr, prd, config, pulls, records, kinds: runKinds }));

      const narrated = await step.run('narrate', () =>
        narrate({ sheet, prd: { title: prd.title, problem: prd.problem }, env }),
      );
      const guarded = await step.run('guard', () => guard({ reply: narrated.reply ?? null, sheet }));
      const prose = guarded.prose ?? null;

      const retroPath = `${prd.folder}/retro.md`;
      const issues = await step.run('publish-issues', async () =>
        publishIssues(await github(), { owner, repo, config, sheet, prose, retroPath }),
      );

      const record = {
        ...sheet,
        narration: {
          model: narrated.model ?? null,
          reason: prose ? null : (narrated.reason ?? 'the prose was refused'),
          dropped: guarded.dropped ?? [],
        },
        issues: issues ?? {},
      };
      const published = await step.run('publish', async () =>
        publishRetro(await github(), { owner, repo, config, prd, pr, record, prose }),
      );

      return { prd: prd.number, findings: sheet.findings.length, issues: Object.keys(record.issues).length, ...published };
    },
  );
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

export const retro = createRetro({ client: inngest, octokitFor: installationOctokit });
