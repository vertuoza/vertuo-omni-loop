// `knowledge-harvest`: the job of the ledger that turns a merged feature PR into a knowledge PR (PRD 82,
// "Flow"; moved to the ledger by PRD omni-loop-4 s2). `/api/github` adds one job for a merged pull request, keyed
// `<owner/name>#<pr>`, lower case, in the lane `<owner/name>`: one harvest at a time per repository, so two runs
// never number the same ids. Its payload is where the pull request merged, never a token (L-GDPR-2). The run is
// cut into steps the worker saves on the ledger (../saved-step.ts `jobSteps`), so a retry never asks the model
// twice for the same step. Every rule about the loop's files is the kit's harvest pipeline
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
//   failure hook           one comment on the merged PR: "The knowledge harvest could not run: <reason>"
//
// A landing (PRD 2896 s6): a mission pull request merged into the default branch carries several PRDs, one squash commit each
// (./landing.ts). Its one harvest covers every one: step "tip" reads the default branch's tip once, then each PRD, in the order
// it landed, runs the steps above under `prd-<n>:` (its files read from its own feature pull request), writing on a tree that
// holds what the PRDs before it wrote, so no id is numbered twice; then one "publish" on `branches.knowledge` filled with
// `landing-<n>`, one commit and one knowledge PR whose body has a section per PRD. A feature PR merged into a mission branch
// is never harvested on its own: only its landing is.
//
// The files are read at the tip "settle" reads, never at the merge commit: the merge only supplies
// the provenance. A replay finds the branch, sees its commit, never commits twice, and rewrites the
// PR's body. Nothing to publish opens no branch and no PR, only the verdict comment: with no
// promotion, the kit's `finishHarvest` writes no "Stays here" note. Settling and shipping never need
// the model.
import { parseConfig } from 'omni-loop/kit/lib/config.ts';
import { applyHarvestEdits, classifyCandidate, finishHarvest, keptPaths, lawQuestions, noEdits, prepareHarvest, withoutWorth } from 'omni-loop/kit/lib/knowledge/pipeline.ts';
import { addCommit, branchHead, refuseDefault, upsertPull } from '../git-write/git-write.ts';
import type { NewJob } from '../jobs/ledger.ts';
import type { FailureHook, JobHandler, JobResult } from '../jobs/worker.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { qualify } from '../retro/qualify.ts';
import { failureCommentHook, upsertComment } from '../verdict-comment/verdict-comment.ts';
import type { Classification, HarvestEdits, LawQuestion } from 'omni-loop/kit/lib/knowledge/pipeline.ts';
import type { ChangedFile, LawIssue, LawWorth } from 'omni-loop/kit/lib/knowledge/write.ts';
import type { IssueNumber, PrdNumber, PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { filesIn, openLawIssue, pullFiles, readMerge, type RequestOctokit, takenElsewhere, tipOf, withTreeAt } from './github.ts';
import type { LawJudge, LawJudgement } from './law-judge.ts';
import { qualifyLanding, type LandingPrd } from './landing.ts';
import { afterEdits, commitMarker, commitMessage, knowledgeBody, knowledgeTitle, landingBody, landingCommitMessage, landingTitle, toCommit } from './render.ts';
import {
  ClassificationOutSchema,
  CommentedSchema,
  CommitSchema,
  HarvestEventSchema,
  LawIssueOpenedSchema,
  LawJudgementSchema,
  LawQuestionsSchema,
  parsedOr,
  PublishedSchema,
  QualifiedSchema,
  SettledSchema,
  TipSchema,
  WrittenSchema,
} from './schema.ts';
import { memorySteps, savedStep, type StepRun } from '../saved-step.ts';
import type { OpenRouterEnv } from '../env.ts';
import type { z } from 'zod';

/** Where a pull request merged. */
type HarvestData = z.infer<typeof HarvestEventSchema>;

/** What the "qualify" step decides: a skip, or the merged feature PR's config, PRD and merge. */
type Qualified = z.infer<typeof QualifiedSchema>;

export const HARVEST_KIND = 'knowledge-harvest';

/** A harvest's tries (3 retries, and the first): the 4th that throws fails it. */
const MAX_TRIES = 4;

/** The job of one merged pull request: one harvest at a time per repository (its lane), a delivery sent twice one job. */
export function harvestJob({ installationId, owner, repo, prNumber }: HarvestData): NewJob {
  const subject = `${owner}/${repo}`.toLowerCase();
  return { kind: HARVEST_KIND, key: `${subject}#${String(prNumber)}`, subject, lane: subject, payload: { installationId, owner, repo, repository: `${owner}/${repo}`, prNumber }, maxTries: MAX_TRIES };
}

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
  { questions, repo, prd, prefix }: { questions: () => Promise<LawQuestion[]>; repo: string; prd: PrdNumber; prefix: string },
): Promise<Record<string, LawWorth | null>> {
  const worth: Record<string, LawWorth | null> = {};
  for (const question of await savedStep(step, `${prefix}law-questions`, LawQuestionsSchema, questions)) {
    const asked = { repo, ref: `PRD ${prd} ${question.id}` };
    worth[question.id] = (await savedStep(step, `${prefix}law-worth:${question.id}`, LawJudgementSchema, () => judged(judge, question, asked))).worth;
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
  { judge, laws, classified, questions, repo, prd, prefix }: {
    judge: LawJudge | null;
    laws: boolean;
    classified: readonly Classification[];
    questions: (replies: readonly Classification[]) => Promise<LawQuestion[]>;
    repo: string;
    prd: PrdNumber;
    prefix: string;
  },
): Promise<(Classification & { worth: LawWorth | null })[]> {
  const replies = laws ? classified : withoutWorth(classified);
  const worth = judge && asksWorth(replies) ? await lawAnswers(step, judge, { questions: () => questions(replies), repo, prd, prefix }) : {};
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
  { write, open, prefix }: {
    write: (id: string, lawIssues?: Record<string, IssueNumber>) => Promise<Written>;
    open: (issue: LawIssue) => Promise<{ number: IssueNumber; created: boolean }>;
    prefix: string;
  },
): Promise<Written> {
  const first = await write(`${prefix}write`);
  if (first.lawIssues.length === 0) return first;
  const opened: Record<string, IssueNumber> = {};
  for (const issue of first.lawIssues) {
    opened[issue.id] = (await savedStep(step, `${prefix}law-issue:${issue.id}`, LawIssueOpenedSchema, () => open(issue))).number;
  }
  return write(`${prefix}write:laws`, opened);
}

/** What the harvest reads beside GitHub: OpenRouter (`null`: every candidate is not placed), galaxy's law judge (`null`: the classifier's own `worthALaw` counts) and fetch; `now` gives the harvest's day, for `Proposed:`. */
export type HarvestDeps = {
  octokitFor: OctokitFor<RequestOctokit>;
  openrouter: OpenRouterEnv | null;
  lawJudge?: LawJudge | null;
  fetch?: typeof globalThis.fetch;
  now?: () => string;
};

/** The handler of the `knowledge-harvest` kind: one run of the harvest on the job's saved steps; a skip ends the job `skipped`. */
export function harvestHandler(deps: HarvestDeps): JobHandler {
  return async (job, run): Promise<JobResult> => {
    const outcome = await harvest(deps, job.payload, run?.step ?? memorySteps());
    return 'skipped' in outcome ? { outcome: 'skipped', reason: outcome.skipped } : { outcome: 'done' };
  };
}

/** One run of the harvest of the merged pull request `payload` names, its steps saved on `step`. */
export async function harvest(
  { octokitFor, openrouter, lawJudge = null, fetch = globalThis.fetch, now = today }: HarvestDeps,
  payload: unknown,
  step: StepRun,
) {
  const parsedEvent = HarvestEventSchema.safeParse(payload);
  if (!parsedEvent.success) {
    const [issue] = parsedEvent.error.issues;
    throw new Error(`The harvest job is malformed: ${issue?.path.join('.') || '(payload)'}: ${issue?.message ?? parsedEvent.error.message}`);
  }
  const { installationId, owner, repo, prNumber } = parsedEvent.data;
  const github = async () => octokitFor(installationId);

  const qualified = await savedStep(step, 'qualify', QualifiedSchema, async (): Promise<Qualified> => {
    const octokit = await github();
    const merge = await readMerge(octokit, { owner, repo, prNumber });
    // A merged pull request always carries its merge time; one without is read as not merged.
    if (!merge.merged || !merge.sha || !merge.at) return { skip: `#${prNumber} was closed, not merged.` };
    const found = await qualify(octokit, { owner, repo, prNumber, mergeSha: merge.sha });
    const provenance = { by: merge.by ?? '', at: merge.at, pr: prNumber, ...(merge.url ? { url: merge.url } : {}) };
    if (found.skip === null) return { skip: null, config: found.config, prd: { number: found.prd.number, topic: found.prd.topic, title: found.prd.title }, merge: provenance };
    // No feature PR: a mission pull request may be a landing (PRD 2896 s6), which the harvest covers whole.
    const landing = await qualifyLanding(octokit, { owner, repo, pr: found.pr ?? null, mergeSha: merge.sha, otherwise: found.skip });
    return landing.skip === null ? { skip: null, config: landing.config, landing: { branch: landing.branch, prds: landing.prds }, merge: provenance } : landing;
  });
  if (qualified.skip !== null) return { skipped: qualified.skip };
  const run: HarvestRun = { step, github, owner, repo, prNumber, config: qualified.config, merge: qualified.merge, openrouter, lawJudge, fetch, now };
  if ('landing' in qualified) return harvestLanding(run, qualified.landing.prds);
  const { config, prd, merge } = qualified;
  const base = config.repo.defaultBranch;
  const branch = config.branches.knowledge.replaceAll('{topic}', prd.topic);
  refuseDefault(branch, base);

  const { tip, prepared, written } = await harvestPrd(run, { prd, pr: prNumber, branch, fetched: prd.number, prefix: '', prior: null, tip: async () => tipOf(await github(), { owner, repo, branch: base }) });

  const published = await savedStep(step, 'publish', PublishedSchema, async () => {
    if (noEdits(written.edits)) return null;
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
    return publishKnowledge(await github(), { run, branch, tip, commit: written.commit, message: commitMessage({ prd, merge }), title: knowledgeTitle(prd), body });
  });

  const verdict = published ? null : await nothingNew(run, prepared.candidates.length);

  return {
    prd: prd.number,
    settled: prepared.settled.length,
    shipped: prepared.shipped.length > 0,
    placed: written.placed.length,
    notPlaced: written.notPlaced.length,
    published,
    verdict,
  };
}

/** What every step of a harvest reads: its steps, GitHub, the merged pull request, its config and merge, and the model. */
type HarvestRun = {
  step: StepRun;
  github: () => Promise<RequestOctokit>;
  owner: string;
  repo: string;
  prNumber: PrNumber;
  config: Extract<Qualified, { skip: null }>['config'];
  merge: Extract<Qualified, { skip: null }>['merge'];
  openrouter: OpenRouterEnv | null;
  lawJudge: LawJudge | null;
  fetch: typeof globalThis.fetch;
  now: () => string;
};

/** What a PRD's harvest made: the tip it read, what it prepared there, and the knowledge it wrote. */
type PrdHarvested = { tip: string; prepared: z.infer<typeof SettledSchema>['prepared']; written: Written };

/**
 * One PRD's harvest, its steps named under `prefix` (none for a feature PR; `prd-<n>:` for each PRD of a landing): settle at the
 * tip, classify each candidate, ask whether each is worth a law, then write. `pr` is the pull request whose files it read: the
 * feature PR's. `prior` is what the PRDs before it in a landing wrote (PRD 2896 s6), applied to the tree it writes on, so no id
 * it numbers is one they took. `fetched` names the PRDs whose folders the tree holds.
 */
async function harvestPrd(
  run: HarvestRun,
  { prd, pr, branch, fetched, prefix, prior, tip: tipAt }: { prd: { number: PrdNumber; title: string }; pr: PrNumber; branch: string; fetched: PrdNumber | readonly PrdNumber[]; prefix: string; prior: HarvestEdits | null; tip: () => Promise<string> },
): Promise<PrdHarvested> {
  const { step, github, owner, repo, config, merge, openrouter, lawJudge, fetch, now } = run;
  const base = config.repo.defaultBranch;
  const settled = await savedStep(step, `${prefix}settle`, SettledSchema, async () => {
    const octokit = await github();
    const changed = await pullFiles(octokit, { owner, repo, prNumber: pr });
    const tip = await tipAt();
    const prepared = await withTreeAt(octokit, { owner, repo, sha: tip, config, prd: fetched }, (ctx) => prepareHarvest({ ctx, prd: prd.number, merge, changed }));
    if (!prepared.ok) {
      throw new Error(`PRD ${prd.number} cannot be harvested at ${base}: ${prepared.errors.join('; ')}`);
    }
    return { tip, prepared };
  });
  const { tip, prepared } = settled;

  const classified: Classification[] = [];
  for (const candidate of prepared.candidates) {
    classified.push(
      await savedStep(step, `${prefix}classify:${candidate.id}`, ClassificationOutSchema, () => classifyCandidate({ candidate, summary: prepared.summary, changed: prepared.changed, openrouter, fetch })),
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
      withTreeAt(await github(), { owner, repo, sha: tip, config, also, prd: fetched }, (ctx) => lawQuestions({ ctx, prepared, classified: replies, prdTitle: prd.title })),
    repo: `${owner}/${repo}`,
    prd: prd.number,
    prefix,
  });

  const written = await writeWithLaws(step, {
    prefix,
    write: (id, lawIssues) =>
      savedStep(step, id, WrittenSchema, async () => {
        const octokit = await github();
        const taken = await takenElsewhere(octokit, { owner, repo, config, own: branch });
        return withTreeAt(octokit, { owner, repo, sha: tip, config, also, prd: fetched }, (ctx, root) => {
          const before = filesIn(root);
          if (prior !== null) applyHarvestEdits({ root, edits: prior });
          const result = finishHarvest({ ctx, prepared, classified: answered, merge, taken, date: now(), lawIssues });
          return { ...result, commit: toCommit(result.edits, before), taken: taken.branches };
        });
      }),
    open: async (issue) => openLawIssue(await github(), { owner, repo, label: config.labels.law, issue }),
  });
  return { tip, prepared, written };
}

/**
 * The knowledge PR from `branch`, cut from `tip`: one commit carrying `commit`, unless the branch's head is already the harvest of
 * this merge (a replay), then the open PR rewritten or a new one opened, labelled `labels.knowledge` while open.
 */
async function publishKnowledge(
  octokit: RequestOctokit,
  { run, branch, tip, commit: files, message, title, body }: { run: HarvestRun; branch: string; tip: string; commit: Written['commit']; message: string; title: string; body: string },
): Promise<z.infer<typeof PublishedSchema>> {
  const { owner, repo, config, merge } = run;
  const base = config.repo.defaultBranch;
  const head = await branchHead(octokit, { owner, repo, branch, from: tip, defaultBranch: base });
  const { data: headCommit } = await octokit.request('GET /repos/{owner}/{repo}/git/commits/{commit_sha}', { owner, repo, commit_sha: head });
  const { message: headMessage } = parsedOr(CommitSchema, headCommit, `GitHub answered the commit ${head} unexpectedly`);
  const already = head !== tip && (headMessage ?? '').includes(commitMarker(merge.pr));
  const commit = already ? head : await addCommit(octokit, { owner, repo, branch, parent: head, defaultBranch: base, message, ...files });
  const pull = await upsertPull(octokit, { owner, repo, branch, base, head: commit, title, body });
  if (pull.open) {
    await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', { owner, repo, issue_number: pull.number, labels: [config.labels.knowledge] });
  }
  return { branch, commit, committed: !already, pr: { number: pull.number, url: pull.url, created: pull.created } };
}

/** The "nothing new" comment on the merged pull request, rewritten in place on a replay: `count` candidates stayed local. */
const nothingNew = async (run: HarvestRun, count: number) =>
  savedStep(run.step, 'verdict', CommentedSchema, async () =>
    upsertComment(await run.github(), { owner: run.owner, repo: run.repo, prNumber: run.prNumber, marker: verdictMarker(run.config.markers.prefix), text: nothingNewText(count) }),
  );

/**
 * The harvest of a landing (PRD 2896 s6, criterion 10): the mission pull request merged into the default branch, once, covering
 * every PRD it landed. Each PRD is harvested in the order it landed, at the one tip read first, its steps under `prd-<n>:`, on a
 * tree holding what the PRDs before it wrote, so every new id is numbered once; then one commit on `branches.knowledge` filled
 * with `landing-<n>` and one knowledge PR. Nothing to publish leaves the "nothing new" comment on the mission pull request.
 */
async function harvestLanding(run: HarvestRun, prds: readonly LandingPrd[]) {
  const { step, github, owner, repo, config, merge, prNumber } = run;
  const base = config.repo.defaultBranch;
  const branch = config.branches.knowledge.replaceAll('{topic}', `landing-${String(prNumber)}`);
  refuseDefault(branch, base);
  const numbers = prds.map(({ number }) => number);
  const tip = await savedStep(step, 'tip', TipSchema, async () => tipOf(await github(), { owner, repo, branch: base }));
  let edits: HarvestEdits | null = null;
  const parts: (PrdHarvested & { prd: LandingPrd })[] = [];
  for (const prd of prds) {
    const done = await harvestPrd(run, { prd, pr: prd.pr, branch, fetched: numbers, prefix: `prd-${String(prd.number)}:`, prior: edits, tip: () => Promise.resolve(tip) });
    parts.push({ ...done, prd });
    edits = afterEdits(edits, done.written.edits);
  }
  const all = edits;
  const published = await savedStep(step, 'publish', PublishedSchema, async () => {
    if (all === null || noEdits(all)) return null;
    const octokit = await github();
    const before = await withTreeAt(octokit, { owner, repo, sha: tip, config, prd: numbers }, (_ctx, root) => filesIn(root));
    const sections = parts.map(({ prd, prepared, written }) => ({
      prd,
      body: knowledgeBody({ prd, merge, settled: prepared.settled, shipped: prepared.shipped, placed: written.placed, notPlaced: written.notPlaced, checks: written.checks, delivery: config.paths.delivery }),
    }));
    return publishKnowledge(octokit, { run, branch, tip, commit: toCommit(all, before), message: landingCommitMessage({ merge, prds }), title: landingTitle({ merge, prds }), body: landingBody({ merge, parts: sections }) });
  });
  const sum = (count: (part: PrdHarvested) => number): number => parts.reduce((total, part) => total + count(part), 0);
  const verdict = published ? null : await nothingNew(run, sum(({ prepared }) => prepared.candidates.length));
  return {
    prds: numbers,
    settled: sum(({ prepared }) => prepared.settled.length),
    shipped: parts.some(({ prepared }) => prepared.shipped.length > 0),
    placed: sum(({ written }) => written.placed.length),
    notPlaced: sum(({ written }) => written.notPlaced.length),
    published,
    verdict,
  };
}

/**
 * The failure hook of the `knowledge-harvest` kind: once the job ended failed, one comment on the merged PR,
 * "The knowledge harvest could not run: <reason>", rewritten in place on a later failure, never a second one.
 */
export function harvestFailureHook({ octokitFor }: { octokitFor: OctokitFor<RequestOctokit> }): FailureHook {
  return failureCommentHook(octokitFor, { schema: HarvestEventSchema, marker: FAILURE_MARKER, what: 'The knowledge harvest' });
}
