// A PRD joins its mission's branch (PRD 2896 s4, spec "3. Joining the mission branch"): what the merge gate (./gate.ts) reads of
// a PRD's feature pull request, and the squash-merge once it passes. Through GitHub's REST API only, as the App's installation:
//
//   read    the pull request (its state, draft, base, head and title), every check run and commit status on its head, its
//           reviews (the Reviewer's marker and the commit each is on), and the PRD's open outbox items at its head: the
//           head's `.omni-loop/config.yml` and that PRD's outbox folder only, through ../snapshot/snapshot.ts, parsed by the
//           kit's own outbox reader, never by running anything it fetched. Its other PRDs' items are never fetched
//   branch  the mission branch's own checks (PRD 2896 s7): every check run and commit status on its head, judged by ./gate.ts's
//           `checksOf`; a run that finds one failed holds the branch's joins and waits on a person
//   merge   `PUT …/pulls/{n}/merge`, squash, its commit titled as the pull request (`<title> (#<n>)`, the repository's
//           squash title), pinned to the head the gate judged: a push since then makes GitHub refuse it. A refusal (not
//           mergeable, the head moved, a conflict) is an answer, never a throw: the PRD waits, and the next run reads again.
//           A base that is the default branch is refused before any request (N-PRODUCT-15)
//   product a product PRD (PRD omni-loop-21 s7) joins each repository's mission branch: every target pull request read and judged,
//           its outbox the product PRD's items as the server holds them, then each merged only once every one passes
//
// Throws when GitHub answers out of shape or fails otherwise: the run fails, and the worker retries it.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { createContext, type Context } from 'omni-loop/kit/lib/context.ts';
import { PrNumberSchema, type PrdNumber, type PrNumber, type ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { parseFolderName } from 'omni-loop/kit/lib/layout.ts';
import { openItems } from 'omni-loop/kit/lib/outbox/status.ts';
import { messageOf, RefSchema, statusOf, type GitHubClient } from '../outbox-check/github-schema.ts';
import { readBaseConfig } from '../outbox-check/github.ts';
import { paginate, PER_PAGE } from '../retro/github.ts';
import { snapshot } from '../snapshot/snapshot.ts';
import { landedIn, saysPartOf, type LandedReads, type MergedPull } from 'omni-loop/kit/lib/ultra/landed.ts';
import { judge, type CheckRun, type CommitStatus, type Gate, type OpenItems, type PullRead } from './gate.ts';

/**
 * Where a pull request is: the installation, the repository (`owner/name`), the PRD and its pull request. A stuck repair's fix whose
 * cause is the mission's own names no PRD (PRD 3065): no outbox is read for it.
 */
export type PullAt = { installation: number; repo: string; prd: PrdNumber | null; pr: PrNumber };

/** What a merge did: merged, or why GitHub refused it. */
export type Merged = { ok: true } | { ok: false; why: string };

/** The checks on a mission branch's head: its sha, every check run and commit status. */
export type BranchChecks = { head: string; runs: readonly CheckRun[]; statuses: readonly CommitStatus[] };

/** What the supervisor asks of GitHub to join a PRD to its mission's branch. */
export type MissionJoins = {
  read: (at: PullAt) => Promise<PullRead>;
  /** The checks on the mission branch's head (PRD 2896 s7); a GitHub that cannot say leaves it out, and no branch reads red. */
  checks?: (at: { installation: number; repo: string; branch: string }) => Promise<BranchChecks>;
  merge: (at: PullAt & { head: string; title: string; base: string; defaultBranch: string }) => Promise<Merged>;
  /**
   * A product PRD's target pull requests (PRD omni-loop-21 s9b): in each of `repos`, every pull request into the mission branch whose
   * body says `Part of <id>`, as /omni:ultra-yolo opens them, in order. A GitHub that cannot say leaves it out: no product PRD joins.
   */
  targets?: (at: { installation: number; repos: readonly string[]; prd: ProductPrdId; branch: string }) => Promise<TargetPull[]>;
  /**
   * Whether product PRD `prd`'s merged work is on `branch` in one of `repos` (bug #3371, omni-loop/kit/lib/ultra/landed.ts): a
   * merged pull request saying `Part of <prd>`, or the pull request that merged its base onward, has its merge commit on the branch. A
   * GitHub that cannot say leaves it out: the PRD is read as not on the branch.
   */
  landed?: (at: { installation: number; repos: readonly string[]; prd: ProductPrdId; branch: string }) => Promise<boolean>;
};

/** `GET /repos/{owner}/{repo}/pulls`: a product PRD's target pull requests, read by their body's `Part of <id>` (PRD omni-loop-21 s9b). */
const TargetPullsSchema = z.array(z.looseObject({ number: z.number().int().positive(), body: z.string().nullish() }));

/** `GET /search/issues`: the merged pull requests a search finds, read by number (bug #3371). */
const FoundSchema = z.looseObject({ items: z.array(z.looseObject({ number: z.number().int().positive() })) });

/** `GET /repos/{owner}/{repo}/pulls…`: a pull request as omni-loop/kit/lib/ultra/landed.ts reads it, merged or not. */
const MergedSchema = z.looseObject({
  number: z.number().int().positive(),
  body: z.string().nullish(),
  merged_at: z.string().nullish(),
  merge_commit_sha: z.string().nullish(),
  base: z.looseObject({ ref: z.string() }),
  head: z.looseObject({ ref: z.string() }),
});
type Listed = z.infer<typeof MergedSchema>;

/** A pull request as a merged one, or null while it is not merged. */
const mergedOf = (one: Listed): MergedPull | null =>
  one.merged_at == null || one.merge_commit_sha == null ? null : { number: one.number, base: one.base.ref, head: one.head.ref, merge: one.merge_commit_sha };

/** Whether a pull request's body says it is part of product PRD `prd`: a `Part of <id>` line. */
const partOf = (body: string | null | undefined, prd: ProductPrdId): boolean => (body ?? '').split('\n').some((line) => line.trim() === `Part of ${prd}`);

/** `GET /repos/{owner}/{repo}/pulls/{pull_number}`: the fields the gate reads. */
const PullSchema = z.looseObject({
  html_url: z.string(),
  title: z.string(),
  state: z.string(),
  draft: z.boolean().nullish(),
  merged: z.boolean().nullish(),
  merged_at: z.string().nullish(),
  base: z.looseObject({ ref: z.string(), repo: z.looseObject({ default_branch: z.string() }) }),
  head: z.looseObject({ sha: z.string(), ref: z.string().nullish() }),
});

/** One page of `GET /repos/{owner}/{repo}/commits/{ref}/check-runs`. */
const CheckRunsSchema = z.looseObject({
  check_runs: z.array(
    z.looseObject({ id: z.number(), name: z.string(), status: z.string(), conclusion: z.string().nullish(), output: z.looseObject({ title: z.string().nullish() }).nullish() }),
  ),
});

/** `GET /repos/{owner}/{repo}/commits/{ref}/status`: the latest status of each context. */
const StatusSchema = z.looseObject({ statuses: z.array(z.looseObject({ context: z.string(), state: z.string(), description: z.string().nullish() })) });

/** One page of `GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews`, oldest first. */
const ReviewsSchema = z.array(z.looseObject({ body: z.string().nullish(), commit_id: z.string().nullish() }));

/** What GitHub answers a refused merge with: not mergeable (405), the head moved (409), or a refusal it explains (422). */
const REFUSED = new Set([405, 409, 422]);

/** Thrown when a merge would land on the default branch: the App merges into a mission branch only. */
export class DefaultBranchMergeError extends Error {
  constructor(branch: string) {
    super(`refusing to merge into ${branch}, the default branch: only a person merges there`);
    this.name = 'DefaultBranchMergeError';
  }
}

/**
 * The head's `.omni-loop/config.yml` and PRD `prd`'s outbox folder at `ref`, fetched into `folder`: the context the kit reads them
 * through, or why not, when the head holds no config that reads. Shared with ./settle.ts (PRD 2896 s10).
 */
export async function prdOutboxAt(
  octokit: GitHubClient,
  { owner, repo, ref, prd, folder }: { owner: string; repo: string; ref: string; prd: PrdNumber; folder: string },
): Promise<{ ctx: Context } | { notRead: string }> {
  const { config, error } = await readBaseConfig(octokit, { owner, repo, baseSha: ref, dest: folder, ignoreUnknownKeys: true });
  if (!config) return { notRead: error ? `its .omni-loop/config.yml cannot be read: ${error.message.split('\n')[0] ?? ''}` : 'its head has no .omni-loop/config.yml' };
  const outbox = createContext(folder, config).layout.dirs.outbox;
  // Only this PRD's folder is fetched: another PRD's file is written empty, its name kept, its blob never asked.
  const ofPrd = (path: string): boolean => parseFolderName(path.slice(outbox.length + 1).split('/')[0] ?? '')?.prd === prd;
  await snapshot(octokit, { owner, repo, ref, paths: [outbox], dest: folder, fetchIf: ofPrd });
  return { ctx: createContext(folder, config) };
}

/** The PRD's open outbox items at `ref`, by rank (null for one that does not parse); why not, when the head holds no config. */
async function openItemsAt(octokit: GitHubClient, { owner, repo, ref, prd }: { owner: string; repo: string; ref: string; prd: PrdNumber }): Promise<OpenItems> {
  const folder = mkdtempSync(join(tmpdir(), 'omni-join-'));
  try {
    const read = await prdOutboxAt(octokit, { owner, repo, ref, prd, folder });
    if ('notRead' in read) return read;
    const open = openItems(prd, read).map(({ id, rank }) => ({ id, rank }));
    return { ranks: open.map(({ rank }) => rank), open };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

/** Every check run and commit status on `ref`, as the gate reads them. */
async function checksAt(octokit: GitHubClient, { owner, repo, ref }: { owner: string; repo: string; ref: string }): Promise<{ runs: CheckRun[]; statuses: CommitStatus[] }> {
  const runs = await paginate(async (page) =>
    CheckRunsSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', { owner, repo, ref, per_page: PER_PAGE, page })).data).check_runs,
  );
  const status = StatusSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/status', { owner, repo, ref, per_page: PER_PAGE })).data);
  return {
    runs: runs.map((one) => ({ id: one.id, name: one.name, status: one.status, conclusion: one.conclusion ?? null, title: one.output?.title ?? null })),
    statuses: status.statuses.map((one) => ({ context: one.context, state: one.state, description: one.description ?? null })),
  };
}

/** One target pull request of a product PRD (PRD omni-loop-21 s7): its repository (`owner/name`) and its number. */
export type TargetPull = { repo: string; pr: PrNumber };

/** A target pull request on its repository's mission branch: merged now, or before. */
export type TargetJoined = TargetPull & { url: string };

/**
 * What a product PRD's join did: every target pull request on its repository's mission branch, or what the gate or GitHub lacks
 * for the rest, the ones on it already named.
 */
export type ProductJoin = { joined: true; pulls: TargetJoined[] } | { joined: false; pulls: TargetJoined[]; lacks: string[] };

/** A target pull request read and judged: its read, and the gate's answer on it. */
type Judged = { target: TargetPull; pull: PullRead; gate: Gate };

/** `acme/api #12: <what it lacks>`. */
const lackOf = ({ repo, pr }: TargetPull, lack: string): string => `${repo} #${String(pr)}: ${lack}`;

/**
 * A product PRD joins each repository's mission branch (PRD omni-loop-21 s7, spec "2. One mission branch per repository"): each of
 * its target pull requests (`targets`) is read and judged by the merge gate into `branch`, the mission branch every repository holds,
 * its outbox the product PRD's open items as the server holds them (`items`, given for every one: no repository outbox is read for a
 * product PRD). Only once every one passes, or is merged into its branch already, is each squash-merged, in order; one that does not
 * pass holds them all, so no repository's branch carries half a PRD. A merge GitHub refuses stops there: the ones merged before it
 * are kept, and the next run reads them as joined. A pull request into the default branch never merges (N-PRODUCT-15).
 */
export async function joinProduct(
  joins: MissionJoins,
  {
    installation,
    targets,
    branch,
    items,
    answered = new Set(),
  }: {
    installation: number;
    targets: readonly TargetPull[];
    branch: string;
    items: OpenItems;
    /** The ids of its high items the fleet's committee carried or deferred (PRD omni-loop-21 s8): answered for the mission branch only. */
    answered?: ReadonlySet<string>;
  },
): Promise<ProductJoin> {
  if (targets.length === 0) return { joined: false, pulls: [], lacks: ['its target pull requests are not known to the mission'] };
  const judged: Judged[] = [];
  for (const target of targets) {
    const pull = { ...(await joins.read({ installation, repo: target.repo, prd: null, pr: target.pr })), items };
    judged.push({ target, pull, gate: judge(pull, branch, answered) });
  }
  const lacks = judged.flatMap(({ target, gate }) => (gate.decision === 'waits' ? gate.lacks.map((lack) => lackOf(target, lack)) : []));
  if (lacks.length > 0) return { joined: false, pulls: [], lacks };
  return mergeAll(joins, installation, judged);
}

/** Each judged target pull request squash-merged into its branch, in order, one already on it kept; the first refusal stops there. */
async function mergeAll(joins: MissionJoins, installation: number, judged: readonly Judged[]): Promise<ProductJoin> {
  const pulls: TargetJoined[] = [];
  for (const { target, pull, gate } of judged) {
    const at = { installation, repo: target.repo, prd: null, pr: target.pr };
    const merged = gate.decision === 'joined' ? { ok: true as const } : await joins.merge({ ...at, head: pull.head, title: pull.title, base: pull.base, defaultBranch: pull.defaultBranch });
    if (!merged.ok) return { joined: false, pulls, lacks: [lackOf(target, merged.why)] };
    pulls.push({ ...target, url: pull.url });
  }
  return { joined: true, pulls };
}

/** What omni-loop/kit/lib/ultra/landed.ts reads of `owner/repo` through GitHub's REST API, against `branch` (bug #3371). */
function landedReads(octokit: GitHubClient, { owner, repo, branch }: { owner: string; repo: string; branch: string }): LandedReads {
  const pull = async (number: number): Promise<MergedPull | null> =>
    mergedOf(MergedSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', { owner, repo, pull_number: number })).data));
  return {
    async partOf(prd) {
      const q = `repo:${owner}/${repo} is:pr is:merged in:body "Part of ${prd}"`;
      const found = FoundSchema.parse((await octokit.request('GET /search/issues', { q, per_page: PER_PAGE })).data).items;
      const pulls = await Promise.all(found.map(async (one) => {
        const read = MergedSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', { owner, repo, pull_number: one.number })).data);
        return saysPartOf(read.body, prd) ? mergedOf(read) : null;
      }));
      return pulls.filter((one) => one !== null);
    },
    async from(head) {
      const listed = z.array(MergedSchema).parse((await octokit.request('GET /repos/{owner}/{repo}/pulls', { owner, repo, head: `${owner}:${head}`, state: 'closed', per_page: PER_PAGE })).data);
      const merged = await Promise.all(listed.filter((one) => one.merged_at != null).map((one) => pull(one.number)));
      return merged.filter((one) => one !== null);
    },
    async within(sha) {
      try {
        const compared = z.looseObject({ status: z.string() }).parse((await octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}', { owner, repo, basehead: `${sha}...${branch}`, per_page: 1 })).data);
        return compared.status === 'ahead' || compared.status === 'identical';
      } catch (error) {
        if (statusOf(error) === 404) return false;
        throw error;
      }
    },
  };
}

/** The joins of a mission, through `octokitFor(installation)`. */
export function missionJoins({ octokitFor }: { octokitFor: (installation: number) => Promise<GitHubClient> | GitHubClient }): MissionJoins {
  return {
    async read({ installation, repo: slug, prd, pr }) {
      const [owner = '', repo = ''] = slug.split('/');
      const octokit = await octokitFor(installation);
      const pull = PullSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', { owner, repo, pull_number: pr })).data);
      const ref = pull.head.sha;
      const { runs, statuses } = await checksAt(octokit, { owner, repo, ref });
      const reviews = await paginate(async (page) => ReviewsSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', { owner, repo, pull_number: pr, per_page: PER_PAGE, page })).data));
      const merged = pull.merged === true || (pull.merged_at ?? null) !== null;
      return {
        number: pr,
        url: pull.html_url,
        title: pull.title,
        state: pull.state,
        draft: pull.draft === true,
        merged,
        base: pull.base.ref,
        defaultBranch: pull.base.repo.default_branch,
        head: ref,
        ...(pull.head.ref == null ? {} : { branch: pull.head.ref }),
        runs,
        statuses,
        reviews: reviews.map((one) => ({ body: one.body ?? null, commit: one.commit_id ?? null })),
        // A merged or closed pull request merges nothing, and a fix of no PRD has no outbox: neither is read.
        items: merged || pull.state !== 'open' || prd === null ? { ranks: [] } : await openItemsAt(octokit, { owner, repo, ref, prd }),
      };
    },

    async checks({ installation, repo: slug, branch }) {
      const [owner = '', repo = ''] = slug.split('/');
      const octokit = await octokitFor(installation);
      const ref = RefSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', { owner, repo, ref: `heads/${branch}` })).data).object.sha;
      const { runs, statuses } = await checksAt(octokit, { owner, repo, ref });
      return {
        head: ref,
        runs,
        statuses,
      };
    },

    async merge({ installation, repo: slug, pr, head, title, base, defaultBranch }) {
      if (base === defaultBranch) throw new DefaultBranchMergeError(base);
      const [owner = '', repo = ''] = slug.split('/');
      const octokit = await octokitFor(installation);
      try {
        await octokit.request('PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge', { owner, repo, pull_number: pr, merge_method: 'squash', sha: head, commit_title: `${title} (#${String(pr)})` });
        return { ok: true };
      } catch (error) {
        const status = statusOf(error);
        if (typeof status === 'number' && REFUSED.has(status)) return { ok: false, why: `GitHub refused the merge: ${String(messageOf(error)).split('\n')[0] ?? ''}` };
        throw error;
      }
    },

    async targets({ installation, repos, prd, branch }) {
      const octokit = await octokitFor(installation);
      const found: TargetPull[] = [];
      for (const slug of repos) {
        const [owner = '', repo = ''] = slug.split('/');
        const pulls = await paginate(async (page) =>
          TargetPullsSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/pulls', { owner, repo, base: branch, state: 'all', per_page: PER_PAGE, page })).data),
        );
        for (const one of pulls) if (partOf(one.body, prd)) found.push({ repo: slug, pr: PrNumberSchema.parse(one.number) });
      }
      return found;
    },

    async landed({ installation, repos, prd, branch }) {
      const octokit = await octokitFor(installation);
      for (const slug of repos) {
        const [owner = '', repo = ''] = slug.split('/');
        if ((await landedIn(prd, landedReads(octokit, { owner, repo, branch }))).landed) return true;
      }
      return false;
    },
  };
}
