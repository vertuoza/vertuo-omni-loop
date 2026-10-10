// `knowledge-harvest`: the Inngest function that turns a merged feature PR into a knowledge PR (PRD 82,
// "Flow"). Its own function, one run at a time per repository: it never shares a run with the retro
// or the outbox check. Every rule about the loop's files is the kit's harvest pipeline
// (`kit/lib/knowledge/pipeline.ts`), the one `omni harvest` runs; this function only reads GitHub,
// asks OpenRouter and writes through the shared git writer.
//
//   step "qualify"         the pull request's merge (who, when, which commit); a feature PR merged into
//                          `repo.defaultBranch`, by the retro's rule (`../retro/qualify.ts`)
//   step "settle"          the files the pull request changed, every page (PRD 1171), and the default
//                          branch's tip, snapshotted: settle at merge, plan the ship, list the
//                          candidates (`prepareHarvest`)
//   step "classify:<id>"   one OpenRouter call per candidate (`classifyCandidate`), the prompt listing
//                          the changed files; without a key, each is not placed and says why
//   step "law-questions"   only with galaxy's law judge, where `laws.source` is `knowledge` and a reply
//                          says whether it is worth a law (PRD 1342): each rule or invariant no changed
//                          test proves (`lawQuestions`); then one step "law-worth:<id>" each, asking
//                          `POST /api/laws/judge` (./law-judge.ts). Jev's answer counts when it decided,
//                          else the classifier's own `worthALaw`
//   step "write"          the same tip again, with every proof a reply proposed among the changed
//                          files, and the ids the other open knowledge branches take: write the
//                          knowledge, keep each proof the tip still holds, run both checks, drop what
//                          fails (`finishHarvest`)
//   step "law-issue:<id>"  one per "yes" the write returned: its law issue, labelled `labels.law`, the
//                          open one of that title reused; then step "write:laws" writes again, each
//                          "yes" `Enforced by: pending #<n>`
//   step "publish"        one commit on `branches.knowledge`, cut from that tip; one knowledge PR
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
import { classifyCandidate, finishHarvest, keptPaths, lawQuestions, noEdits, prepareHarvest, withoutWorth } from 'vertuo-omni-plan/kit/lib/knowledge/pipeline.ts';
import { addCommit, branchHead, refuseDefault, upsertPull } from '../git-write/git-write.ts';
import { HARVEST_EVENT } from '../inngest-client.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { qualify } from '../retro/qualify.ts';
import { firstLine } from '../outbox-check/github-schema.ts';
import { commentOnFailure, FailureCommentSchema, upsertComment } from '../verdict-comment/verdict-comment.ts';
import type { Classification, LawQuestion } from 'vertuo-omni-plan/kit/lib/knowledge/pipeline.ts';
import type { ChangedFile, LawIssue, LawWorth } from 'vertuo-omni-plan/kit/lib/knowledge/write.ts';
import type { IssueNumber, PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { filesIn, openLawIssue, pullFiles, readMerge, type RequestOctokit, takenElsewhere, tipOf, withTreeAt } from './github.ts';
import type { LawJudge, LawJudgement } from './law-judge.ts';
import { commitMarker, commitMessage, knowledgeBody, knowledgeTitle, toCommit } from './render.ts';
import {
  ClassificationOutSchema,
  CommentedSchema,
  CommitSchema,
  FailedHarvestEventSchema,
  HarvestEventSchema,
  LawIssueOpenedSchema,
  LawJudgementSchema,
  LawQuestionsSchema,
  parsedOr,
  PublishedSchema,
  QualifiedSchema,
  SettledSchema,
  WrittenSchema,
} from './schema.ts';
import { savedStep, type StepRun } from '../saved-step.ts';
import type { OpenRouterEnv } from '../env.ts';
import type { z } from 'zod';

/** What the "qualify" step decides: a skip, or the merged feature PR's config, PRD and merge. */
type Qualified = z.infer<typeof QualifiedSchema>;

export const HARVEST_FUNCTION_ID = 'knowledge-harvest';

/** One harvest at a time per repository, so two runs never number the same ids. */
export const CONCURRENCY = Object.freeze({ key: 'event.data.repository', limit: 1 });

/** The prefix of the failure comment's marker. The config may be what failed to read, so the kit's default. */
const MARKER_PREFIX = parseConfig('kit: 1\n').markers.prefix;
/** One of the harvest's comment markers, `<!-- <prefix>-<name> -->`. */
const marker = (prefix: string, name: string): string => `<!-- ${prefix}-${name} -->`;
export const FAILURE_MARKER = marker(MARKER_PREFIX, 'knowledge-harvest-failed');

/** The marker of the "nothing new" comment, under the repository's `markers.prefix`. */
export const verdictMarker = (prefix: string): string => marker(prefix, 'knowledge-verdict');
/** The marker under the kit's default prefix. */
export const VERDICT_MARKER = verdictMarker(MARKER_PREFIX);

/** The comment a harvest with nothing to publish leaves on the merged feature PR. */
export const nothingNewText = (count: number) =>
  `Knowledge: nothing new — ${count} ${count === 1 ? 'candidate' : 'candidates'} stayed local.`;

const today = () => new Date().toISOString().slice(0, 10);

/**
 * The proofs the replies propose that the pull request left in the tree: the files the "write" step
 * reads at the tip beside the loop's, so the writer can tell a kept proof from one gone since.
 */
function proposedProofs(classified: readonly Pick<Classification, 'reply'>[], changed: readonly ChangedFile[]): string[] {
  const kept = new Set(keptPaths(changed));
  const proposed = classified.flatMap(({ reply }) => (reply && 'enforcedBy' in reply ? (reply.enforcedBy ?? []) : []));
  return [...new Set(proposed)].filter((path) => kept.has(path)).sort();
}

/** Whether any reply says whether it is worth a law: only then is there a question for the judge. */
const asksWorth = (classified: readonly Classification[]) => classified.some(({ reply }) => reply !== null && 'worthALaw' in reply && reply.worthALaw !== undefined);

/** One question to the judge; a judge that throws counts as one that did not answer. */
async function judged(judge: LawJudge, question: LawQuestion, asked: { repo: string; ref: string }): Promise<LawJudgement> {
  try {
    return await judge(question, asked);
  } catch (error) {
    return { worth: null, reason: `the law judge failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * The `law-worth` answers that count, by candidate id: the questions listed once (step
 * "law-questions"), each asked of galaxy's judge in its own step ("law-worth:<id>"). A question the
 * judge did not answer is null: the classifier's own `worthALaw` counts.
 */
async function lawAnswers(
  step: StepRun,
  judge: LawJudge,
  { questions, repo, prd }: { questions: () => Promise<LawQuestion[]>; repo: string; prd: PrdNumber },
): Promise<Record<string, LawWorth | null>> {
  const worth: Record<string, LawWorth | null> = {};
  for (const question of await savedStep(step, 'law-questions', LawQuestionsSchema, questions)) {
    const asked = { repo, ref: `PRD ${prd} ${question.id}` };
    worth[question.id] = (await savedStep(step, `law-worth:${question.id}`, LawJudgementSchema, () => judged(judge, question, asked))).worth;
  }
  return worth;
}

/**
 * The replies as the writer reads them, each with the `law-worth` answer that counted (PRD 1342): only
 * where the laws are the knowledge (`laws`), and only galaxy's judge is asked; without it, or when it
 * does not answer, the classifier's own `worthALaw` counts.
 */
async function worthAnswered(
  step: StepRun,
  { judge, laws, classified, questions, repo, prd }: {
    judge: LawJudge | null;
    laws: boolean;
    classified: readonly Classification[];
    questions: (replies: readonly Classification[]) => Promise<LawQuestion[]>;
    repo: string;
    prd: PrdNumber;
  },
): Promise<(Classification & { worth: LawWorth | null })[]> {
  const replies = laws ? classified : withoutWorth(classified);
  const worth = judge && asksWorth(replies) ? await lawAnswers(step, judge, { questions: () => questions(replies), repo, prd }) : {};
  return replies.map((entry) => ({ ...entry, worth: worth[entry.id] ?? null }));
}

/** What the step "write" (and "write:laws") returns. */
type Written = z.infer<typeof WrittenSchema>;

/**
 * The knowledge written: a "yes" is written `Enforced by: pending #<n>` once its law issue is open, so
 * a first write ("write") names the issues to open, each opens in its own step ("law-issue:<id>"), and
 * a second write ("write:laws") numbers the laws. With no law issue, the first write is the one.
 */
async function writeWithLaws(
  step: StepRun,
  { write, open }: {
    write: (id: string, lawIssues?: Record<string, IssueNumber>) => Promise<Written>;
    open: (issue: LawIssue) => Promise<{ number: IssueNumber; created: boolean }>;
  },
): Promise<Written> {
  const first = await write('write');
  if (first.lawIssues.length === 0) return first;
  const opened: Record<string, IssueNumber> = {};
  for (const issue of first.lawIssues) {
    opened[issue.id] = (await savedStep(step, `law-issue:${issue.id}`, LawIssueOpenedSchema, () => open(issue))).number;
  }
  return write('write:laws', opened);
}

/**
 * The function, bound to its client, GitHub, OpenRouter (from the app's environment, ../env.ts; `null`:
 * every candidate is not placed), galaxy's law judge (`null`: the classifier's own `worthALaw` counts)
 * and fetch; `now` gives the harvest's day, for `Proposed:`.
 */
export function createKnowledgeHarvest({ client, octokitFor, openrouter, lawJudge = null, fetch = globalThis.fetch, now = today }: {
  client: Inngest.Any;
  octokitFor: OctokitFor<RequestOctokit>;
  openrouter: OpenRouterEnv | null;
  lawJudge?: LawJudge | null;
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
    async ({ event, step }) => {
      const parsedEvent = HarvestEventSchema.safeParse(event.data);
      if (!parsedEvent.success) {
        const [issue] = parsedEvent.error.issues;
        throw new NonRetriableError(`The harvest event is malformed: ${issue?.path.join('.') || '(event)'}: ${issue?.message ?? parsedEvent.error.message}`);
      }
      const { installationId, owner, repo, prNumber } = parsedEvent.data;
      const github = async () => octokitFor(installationId);

      const qualified = await savedStep(step, 'qualify', QualifiedSchema, async (): Promise<Qualified> => {
        const octokit = await github();
        const merge = await readMerge(octokit, { owner, repo, prNumber });
        // A merged pull request always carries its merge time; one without is read as not merged.
        if (!merge.merged || !merge.sha || !merge.at) return { skip: `#${prNumber} was closed, not merged.` };
        const found = await qualify(octokit, { owner, repo, prNumber, mergeSha: merge.sha });
        if (found.skip !== null) return { skip: found.skip };
        return {
          skip: null,
          config: found.config,
          prd: { number: found.prd.number, topic: found.prd.topic, title: found.prd.title },
          merge: { by: merge.by ?? '', at: merge.at, pr: prNumber, ...(merge.url ? { url: merge.url } : {}) },
        };
      });
      if (qualified.skip !== null) return { skipped: qualified.skip };
      const { config, prd, merge } = qualified;
      const base = config.repo.defaultBranch;
      const branch = config.branches.knowledge.replaceAll('{topic}', prd.topic);
      refuseDefault(branch, base);

      const settled = await savedStep(step, 'settle', SettledSchema, async () => {
        const octokit = await github();
        const changed = await pullFiles(octokit, { owner, repo, prNumber });
        const tip = await tipOf(octokit, { owner, repo, branch: base });
        const prepared = await withTreeAt(octokit, { owner, repo, sha: tip, config }, (ctx) => prepareHarvest({ ctx, prd: prd.number, merge, changed }));
        if (!prepared.ok) {
          throw new NonRetriableError(`PRD ${prd.number} cannot be harvested at ${base}: ${prepared.errors.join('; ')}`);
        }
        return { tip, prepared };
      });
      const { tip, prepared } = settled;

      const classified: Classification[] = [];
      for (const candidate of prepared.candidates) {
        classified.push(
          await savedStep(step, `classify:${candidate.id}`, ClassificationOutSchema, () => classifyCandidate({ candidate, summary: prepared.summary, changed: prepared.changed, openrouter, fetch })),
        );
      }

      // Worth a law? (PRD 1342) Only where the laws are the knowledge, and only galaxy's judge is asked:
      // without it, or when it does not answer, the classifier's own `worthALaw` counts.
      const also = proposedProofs(classified, prepared.changed);
      const answered = await worthAnswered(step, {
        judge: lawJudge,
        laws: config.laws.source === 'knowledge',
        classified,
        questions: async (replies) =>
          withTreeAt(await github(), { owner, repo, sha: tip, config, also }, (ctx) => lawQuestions({ ctx, prepared, classified: replies, prdTitle: prd.title })),
        repo: `${owner}/${repo}`,
        prd: prd.number,
      });

      const written = await writeWithLaws(step, {
        write: (id, lawIssues) =>
          savedStep(step, id, WrittenSchema, async () => {
            const octokit = await github();
            const taken = await takenElsewhere(octokit, { owner, repo, config, own: branch });
            return withTreeAt(octokit, { owner, repo, sha: tip, config, also }, (ctx, root) => {
              const result = finishHarvest({ ctx, prepared, classified: answered, merge, taken, date: now(), lawIssues });
              return { ...result, commit: toCommit(result.edits, filesIn(root)), taken: taken.branches };
            });
          }),
        open: async (issue) => openLawIssue(await github(), { owner, repo, label: config.labels.law, issue }),
      });

      const published = await savedStep(step, 'publish', PublishedSchema, async () => {
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
        : await savedStep(step, 'verdict', CommentedSchema, async () =>
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
    step?: StepRun | null;
  }) => {
    const failed = FailedHarvestEventSchema.safeParse(event.data.event.data ?? {});
    const { installationId, owner, repo, prNumber } = failed.success ? failed.data : {};
    if (!installationId || !prNumber) return { skipped: 'not a merge' };
    const reason = firstLine(error?.message ?? event.data.error?.message);
    const text = `The knowledge harvest could not run: ${reason}`;

    return commentOnFailure(octokitFor, step, { installationId, owner, repo }, FailureCommentSchema, async (octokit, where) => {
      const posted = await upsertComment(octokit, { ...where, prNumber, marker: FAILURE_MARKER, text });
      return { ...posted, reason };
    });
  };
}
