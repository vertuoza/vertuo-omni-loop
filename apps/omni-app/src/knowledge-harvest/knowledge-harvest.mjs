// `knowledge-harvest`: the Inngest function that turns a merged feature PR into a knowledge PR (PRD 82,
// "Flow"). Its own function, one run at a time per repository: it never shares a run with the retro
// or the outbox check. Every rule about the loop's files is the kit's harvest pipeline
// (`kit/lib/knowledge/pipeline.mjs`), the one `omni harvest` runs; this function only reads GitHub,
// asks OpenRouter and writes through the shared git writer.
//
//   step "qualify"         the pull request's merge (who, when, which commit); a feature PR merged into
//                          `repo.defaultBranch`, by the retro's rule (`../retro/qualify.mjs`)
//   step "settle"          the default branch's tip, snapshotted: settle at merge, plan the ship, list
//                          the candidates (`prepareHarvest`)
//   step "classify:<id>"   one OpenRouter call per candidate (`classifyCandidate`); without a key,
//                          each is not placed and says why
//   step "write"           the same tip again, and the ids the other open knowledge branches take:
//                          write the knowledge, run both checks, drop what fails (`finishHarvest`)
//   step "publish"         one commit on `branches.knowledge`, cut from that tip; one knowledge PR
//   step "verdict"         only when there is nothing to publish: one comment on the merged PR, marked
//                          `<markers.prefix>-knowledge-verdict`, "Knowledge: nothing new — <n>
//                          candidates stayed local." (PRD 487), rewritten in place on a replay
//   onFailure              one comment on the merged PR: "The knowledge harvest could not run: <reason>"
//
// The files are read at the tip "settle" reads, never at the merge commit: the merge only supplies
// the provenance. A replay finds the branch, sees its commit, never commits twice, and rewrites the
// PR's body. Nothing to publish opens no branch and no PR, only the verdict comment: with no
// promotion, the kit's `finishHarvest` writes no "Stays here" note. Settling and shipping never need
// the model.
import { NonRetriableError } from 'inngest';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.mjs';
import { classifyCandidate, finishHarvest, noEdits, prepareHarvest } from 'vertuo-omni-plan/kit/lib/knowledge/pipeline.mjs';
import { addCommit, branchHead, refuseDefault, upsertPull } from '../git-write/git-write.mjs';
import { HARVEST_EVENT, inngest } from '../inngest-client.mjs';
import { installationOctokit } from '../outbox-check/outbox-check.mjs';
import { qualify } from '../retro/qualify.mjs';
import { upsertComment } from '../verdict-comment/verdict-comment.mjs';
import { filesIn, readMerge, takenElsewhere, tipOf, withTreeAt } from './github.mjs';
import { commitMarker, commitMessage, knowledgeBody, knowledgeTitle, toCommit } from './render.mjs';

export const HARVEST_FUNCTION_ID = 'knowledge-harvest';

/** One harvest at a time per repository, so two runs never number the same ids. */
export const CONCURRENCY = Object.freeze({ key: 'event.data.repository', limit: 1 });

/** The prefix of the failure comment's marker. The config may be what failed to read, so the kit's default. */
const MARKER_PREFIX = parseConfig('kit: 1\n').markers.prefix;
export const FAILURE_MARKER = `<!-- ${MARKER_PREFIX}-knowledge-harvest-failed -->`;

/** The marker of the "nothing new" comment, under the repository's `markers.prefix`. */
export const verdictMarker = (prefix) => `<!-- ${prefix}-knowledge-verdict -->`;
/** The marker under the kit's default prefix. */
export const VERDICT_MARKER = verdictMarker(MARKER_PREFIX);

/** The comment a harvest with nothing to publish leaves on the merged feature PR. */
export const nothingNewText = (count) =>
  `Knowledge: nothing new — ${count} ${count === 1 ? 'candidate' : 'candidates'} stayed local.`;

const today = () => new Date().toISOString().slice(0, 10);

/**
 * @param {{
 *   client: import('inngest').Inngest,
 *   octokitFor: (installationId: number) => Promise<{ request: Function }> | { request: Function },
 *   env?: Record<string, string | undefined>,
 *   fetch?: typeof globalThis.fetch,
 *   now?: () => string,
 * }} deps `now` gives the harvest's day, for `Proposed:`.
 */
export function createKnowledgeHarvest({ client, octokitFor, env = process.env, fetch = globalThis.fetch, now = today }) {
  return client.createFunction(
    {
      id: HARVEST_FUNCTION_ID,
      name: 'omni-loop · knowledge harvest',
      triggers: [{ event: HARVEST_EVENT }],
      concurrency: CONCURRENCY,
      retries: 3,
      onFailure: createHarvestFailureHandler({ octokitFor }),
    },
    async ({ event, step }) => {
      const { installationId, owner, repo, prNumber } = event.data;
      const github = async () => octokitFor(installationId);

      const qualified = await step.run('qualify', async () => {
        const octokit = await github();
        const merge = await readMerge(octokit, { owner, repo, prNumber });
        if (!merge.merged || !merge.sha) return { skip: `#${prNumber} was closed, not merged.` };
        const found = await qualify(octokit, { owner, repo, prNumber, mergeSha: merge.sha });
        if (found.skip) return { skip: found.skip };
        return {
          skip: null,
          config: found.config,
          prd: { number: found.prd.number, topic: found.prd.topic, title: found.prd.title },
          merge: { by: merge.by ?? '', at: merge.at, pr: prNumber, ...(merge.url ? { url: merge.url } : {}) },
        };
      });
      if (qualified.skip) return { skipped: qualified.skip };
      const { config, prd, merge } = qualified;
      const base = config.repo.defaultBranch;
      const branch = config.branches.knowledge.replaceAll('{topic}', prd.topic);
      refuseDefault(branch, base);

      const settled = await step.run('settle', async () => {
        const octokit = await github();
        const tip = await tipOf(octokit, { owner, repo, branch: base });
        const prepared = await withTreeAt(octokit, { owner, repo, sha: tip, config }, (ctx) => prepareHarvest({ ctx, prd: prd.number, merge }));
        if (!prepared.ok) {
          throw new NonRetriableError(`PRD ${prd.number} cannot be harvested at ${base}: ${prepared.errors.join('; ')}`);
        }
        return { tip, prepared };
      });
      const { tip, prepared } = settled;

      const classified = [];
      for (const candidate of prepared.candidates) {
        classified.push(
          await step.run(`classify:${candidate.id}`, () => classifyCandidate({ candidate, summary: prepared.summary, env, fetch })),
        );
      }

      const written = await step.run('write', async () => {
        const octokit = await github();
        const taken = await takenElsewhere(octokit, { owner, repo, config, own: branch });
        return withTreeAt(octokit, { owner, repo, sha: tip, config }, (ctx, root) => {
          const result = finishHarvest({ ctx, prepared, classified, merge, taken, date: now() });
          return { ...result, commit: toCommit(result.edits, filesIn(root)), taken: taken.branches };
        });
      });

      const published = await step.run('publish', async () => {
        if (noEdits(written.edits)) return null;
        const octokit = await github();
        const head = await branchHead(octokit, { owner, repo, branch, from: tip, defaultBranch: base });
        const { data: headCommit } = await octokit.request('GET /repos/{owner}/{repo}/git/commits/{commit_sha}', {
          owner,
          repo,
          commit_sha: head,
        });
        const already = head !== tip && String(headCommit.message ?? '').includes(commitMarker(merge.pr));
        const commit = already
          ? head
          : await addCommit(octokit, {
              owner,
              repo,
              branch,
              parent: head,
              defaultBranch: base,
              message: commitMessage({ prd, merge }),
              ...written.commit,
            });
        const body = knowledgeBody({
          prd,
          merge,
          settled: prepared.settled,
          shipped: prepared.shipped,
          placed: written.placed,
          notPlaced: written.notPlaced,
          checks: written.checks,
          delivery: config.paths.delivery,
        });
        const pull = await upsertPull(octokit, { owner, repo, branch, base, head: commit, title: knowledgeTitle(prd), body });
        if (pull.open) {
          await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', {
            owner,
            repo,
            issue_number: pull.number,
            labels: [config.labels.knowledge],
          });
        }
        return { branch, commit, committed: !already, pr: { number: pull.number, url: pull.url, created: pull.created } };
      });

      const verdict = published
        ? null
        : await step.run('verdict', async () =>
            upsertComment(await github(), {
              owner,
              repo,
              prNumber,
              marker: verdictMarker(config.markers.prefix),
              text: nothingNewText(prepared.candidates.length),
            }),
          );

      return {
        prd: prd.number,
        settled: prepared.settled.length,
        shipped: prepared.shipped.length > 0,
        placed: written.placed.length,
        notPlaced: written.notPlaced.length,
        published,
        verdict,
      };
    },
  );
}

/**
 * The failure handler: once the run has failed after its retries, one comment on the merged PR —
 * "The knowledge harvest could not run: <reason>" — rewritten in place on a later failure, never a
 * second one.
 */
export function createHarvestFailureHandler({ octokitFor }) {
  return async ({ event, error, step }) => {
    const { installationId, owner, repo, prNumber } = event.data.event.data ?? {};
    if (!installationId || !prNumber) return { skipped: 'not a merge' };
    const reason = firstLine(error?.message ?? event.data.error?.message);
    const text = `The knowledge harvest could not run: ${reason}`;

    const run = (id, fn) => (step?.run ? step.run(id, fn) : fn());
    return run('comment-failure', async () => {
      const octokit = await octokitFor(installationId);
      const posted = await upsertComment(octokit, { owner, repo, prNumber, marker: FAILURE_MARKER, text });
      return { ...posted, reason };
    });
  };
}

function firstLine(reason) {
  const text = String(reason ?? 'unknown error').trim();
  return text.split('\n')[0] || 'unknown error';
}

export const knowledgeHarvest = createKnowledgeHarvest({ client: inngest, octokitFor: installationOctokit });
