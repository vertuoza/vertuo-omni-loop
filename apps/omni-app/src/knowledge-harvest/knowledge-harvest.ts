// `knowledge-harvest`: the Inngest function that turns a merged feature PR into a knowledge PR (PRD 82,
// "Flow"). Its own function, one run at a time per repository: it never shares a run with the retro
// or the outbox check. Every rule about the loop's files is the kit's harvest pipeline
// (`kit/lib/knowledge/pipeline.ts`), the one `omni harvest` runs; this function only reads GitHub,
// asks OpenRouter and writes through the shared git writer.
//
//   step "qualify"         the pull request's merge (who, when, which commit); a feature PR merged into
//                          `repo.defaultBranch`, by the retro's rule (`../retro/qualify.ts`)
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
import { type Inngest, NonRetriableError } from 'inngest';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { classifyCandidate, finishHarvest, noEdits, prepareHarvest } from 'vertuo-omni-plan/kit/lib/knowledge/pipeline.ts';
import { addCommit, branchHead, refuseDefault, upsertPull } from '../git-write/git-write.ts';
import { HARVEST_EVENT, inngest } from '../inngest-client.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { installationOctokit } from '../outbox-check/outbox-check.ts';
import { qualify } from '../retro/qualify.ts';
import { firstLine } from '../outbox-check/github-schema.ts';
import { commentOnFailure, upsertComment } from '../verdict-comment/verdict-comment.ts';
import type { Classification } from 'vertuo-omni-plan/kit/lib/knowledge/pipeline.ts';
import type { Config } from 'vertuo-omni-plan/kit/lib/types.ts';
import { filesIn, readMerge, type RequestOctokit, takenElsewhere, tipOf, withTreeAt } from './github.ts';
import { commitMarker, commitMessage, knowledgeBody, knowledgeTitle, toCommit } from './render.ts';
import { CommitSchema, FailedHarvestEventSchema, HarvestEventSchema, parsedOr } from './schema.ts';

/** The part of an Inngest step the harvest runs: one memoized, retried unit, its output as JSON. */
type HarvestStep = { run: <T>(id: string, fn: () => T | Promise<T>) => Promise<T> };

/** What the "qualify" step decides: a skip, or the merged feature PR's config, PRD and merge. */
type Qualified =
  | { skip: string }
  | { skip: null; config: Config; prd: { number: number; topic: string; title: string }; merge: { by: string; at: string; pr: number; url?: string } };

export const HARVEST_FUNCTION_ID = 'knowledge-harvest';

/** One harvest at a time per repository, so two runs never number the same ids. */
export const CONCURRENCY = Object.freeze({ key: 'event.data.repository', limit: 1 });

/** The prefix of the failure comment's marker. The config may be what failed to read, so the kit's default. */
const MARKER_PREFIX = parseConfig('kit: 1\n').markers.prefix;
export const FAILURE_MARKER = `<!-- ${MARKER_PREFIX}-knowledge-harvest-failed -->`;

/** The marker of the "nothing new" comment, under the repository's `markers.prefix`. */
export const verdictMarker = (prefix: string) => `<!-- ${prefix}-knowledge-verdict -->`;
/** The marker under the kit's default prefix. */
export const VERDICT_MARKER = verdictMarker(MARKER_PREFIX);

/** The comment a harvest with nothing to publish leaves on the merged feature PR. */
export const nothingNewText = (count: number) =>
  `Knowledge: nothing new — ${count} ${count === 1 ? 'candidate' : 'candidates'} stayed local.`;

const today = () => new Date().toISOString().slice(0, 10);

/** The function, bound to its client, GitHub, the environment and fetch; `now` gives the harvest's day, for `Proposed:`. */
export function createKnowledgeHarvest({ client, octokitFor, env = process.env, fetch = globalThis.fetch, now = today }: {
  client: Inngest.Any;
  octokitFor: OctokitFor<RequestOctokit>;
  env?: Record<string, string | undefined>;
  fetch?: typeof globalThis.fetch;
  now?: () => string;
}) {
  return client.createFunction(
    {
      id: HARVEST_FUNCTION_ID,
      name: 'omni-loop · knowledge harvest',
      triggers: [{ event: HARVEST_EVENT }],
      concurrency: CONCURRENCY,
      retries: 3,
      onFailure: createHarvestFailureHandler({ octokitFor }),
    },
    async ({ event, step: inngestStep }) => {
      const parsedEvent = HarvestEventSchema.safeParse(event.data);
      if (!parsedEvent.success) {
        const [issue] = parsedEvent.error.issues;
        throw new NonRetriableError(`The harvest event is malformed: ${issue?.path.join('.') || '(event)'}: ${issue?.message ?? parsedEvent.error.message}`);
      }
      const { installationId, owner, repo, prNumber } = parsedEvent.data;
      const step = inngestStep as HarvestStep; // ts-allow: Inngest's step answers each output as JSON, and every output the harvest steps is JSON already
      const github = async () => octokitFor(installationId);

      const qualified = await step.run('qualify', async (): Promise<Qualified> => {
        const octokit = await github();
        const merge = await readMerge(octokit, { owner, repo, prNumber });
        if (!merge.merged || !merge.sha) return { skip: `#${prNumber} was closed, not merged.` };
        const found = await qualify(octokit, { owner, repo, prNumber, mergeSha: merge.sha });
        if (found.skip !== null) return { skip: found.skip };
        return {
          skip: null,
          config: found.config,
          prd: { number: found.prd.number, topic: found.prd.topic, title: found.prd.title },
          merge: { by: merge.by ?? '', at: merge.at as string, pr: prNumber, ...(merge.url ? { url: merge.url } : {}) }, // ts-allow: a merged pull request always carries its merge time
        };
      });
      if (qualified.skip !== null) return { skipped: qualified.skip };
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

      const classified: Classification[] = [];
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
        const { message } = parsedOr(CommitSchema, headCommit, `GitHub answered the commit ${head} unexpectedly`);
        const already = head !== tip && (message ?? '').includes(commitMarker(merge.pr));
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
export function createHarvestFailureHandler({ octokitFor }: { octokitFor: OctokitFor<RequestOctokit> }) {
  return async ({ event, error, step }: {
    event: { data: { event: { data?: unknown }; error?: { message?: string } | null } };
    error?: { message?: string } | null;
    step?: HarvestStep | null;
  }) => {
    const failed = FailedHarvestEventSchema.safeParse(event.data.event.data ?? {});
    const { installationId, owner, repo, prNumber } = failed.success ? failed.data : {};
    if (!installationId || !prNumber) return { skipped: 'not a merge' };
    const reason = firstLine(error?.message ?? event.data.error?.message);
    const text = `The knowledge harvest could not run: ${reason}`;

    return commentOnFailure(octokitFor, step, { installationId, owner, repo }, async (octokit, where) => {
      const posted = await upsertComment(octokit, { ...where, prNumber, marker: FAILURE_MARKER, text });
      return { ...posted, reason };
    });
  };
}

export const knowledgeHarvest = createKnowledgeHarvest({ client: inngest, octokitFor: installationOctokit });
