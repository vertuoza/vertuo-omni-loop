// A person drops a PRD from the mission branch (PRD 2896 s7, spec "4. Keeping up, landing, dropping", criterion 11). Through
// GitHub's REST API only, as the App's installation: nothing is cloned, and the default branch is never written (N-PRODUCT-15).
//
//   the commits   the branch is a straight line, one squash commit per PRD (./join.ts), each titled `<title> (#<n>)`: a PRD's
//                 commit is the one whose title names its feature pull request. Those of the PRDs dropped are found on it; one
//                 that is not there has left the branch already, and nothing of it is removed again
//   the removal   by rebase, as ./keep-up.ts replays a branch: from the parent of the first commit dropped, each commit after
//                 it is replayed in order, the dropped ones left out. A replay is a cherry-pick: a scratch commit holding the
//                 tree so far on the commit's own parent is merged with the commit (`POST …/merges`), so git's three-way merge
//                 is taken from that parent and applies the commit's own change alone. A commit that no longer changes anything
//                 is left out. A conflict (a PRD kept that was built on one dropped) changes no branch and names the commit
//   the write     the rebased line is written with force only once every commit replayed, and only while the branch's head is
//                 still the one read (the lease: read again just before the write; another head and nothing is written, the
//                 next run reads it again). The scratch branch, `<mission branch>--drop`, is removed whatever happened
//   the reopening each PRD removed gets its feature pull request opened again against the mission branch, from its feature
//                 branch (cut again at its last head when it was deleted with the merge), as a new pull request, since GitHub
//                 never reopens a merged one: its title, its body and a line saying why. One GitHub refuses to open (nothing to
//                 merge, one open already) is told, never a throw
//
// Throws when GitHub refuses otherwise or answers out of shape: the run fails, and the worker retries it.
import { z } from 'zod';
import { PrNumberSchema, type PrdNumber, type PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { messageOf, PullWrittenSchema, ShaSchema, statusOf, type GitHubClient } from '../outbox-check/github-schema.ts';
import { missionRepo } from './branch.ts';
import { onRepo, type On } from './keep-up.ts';
import { prOfTitle } from './landing.ts';

/** A PRD to drop, with the feature pull request whose squash commit is on the branch. */
export type DropPrd = { prd: PrdNumber; pr: PrNumber };

/** Where a drop is: the installation, the repository (`owner/name`), the mission branch and the PRDs to take off it. */
export type DropAt = { installation: number; repo: string; branch: string; prds: readonly DropPrd[] };

/** What became of one PRD's feature pull request: opened again as `pr`, or why it was not (`why`). */
export type Reopened = { prd: PrdNumber; pr: PrNumber | null; url: string | null; why: string | null };

/** What a drop did: the PRDs off the branch (`removed`, their commits taken out; `absent`, already off it) with their pull requests reopened, or why nothing changed. */
export type Dropped = { ok: true; removed: PrdNumber[]; absent: PrdNumber[]; reopened: Reopened[] } | { ok: false; why: string };

/** What the supervisor asks of GitHub to take PRDs off a mission branch. */
export type MissionDrops = { drop: (at: DropAt) => Promise<Dropped> };

const PullSchema = z.looseObject({ number: PrNumberSchema, title: z.string(), body: z.string().nullish(), head: z.looseObject({ ref: z.string(), sha: z.string() }) });

/** The most commits a mission branch replays: as ./keep-up.ts. */
const MAX_COMMITS = 100;

/** One commit of the branch, as a compare lists it: its sha, its parent, its message and its author. */
type Listed = { sha: string; parent: string; message: string; author: { name: string; email: string; date: string } | undefined; pr: PrNumber | null };

/** The branch's commits since the default branch, oldest first; why not when it cannot be replayed (too long, a merge commit). */
async function listed(on: On, { branch, defaultBranch }: { branch: string; defaultBranch: string }): Promise<{ head: string; commits: Listed[] } | string> {
  const head = await on.head(branch);
  if (head === null) return `${branch} is not cut`;
  const compared = await on.compare(defaultBranch, head);
  if (compared.ahead_by > MAX_COMMITS || compared.commits.length < compared.ahead_by) return `${branch} holds ${String(compared.ahead_by)} commits, more than the ${String(MAX_COMMITS)} the app replays`;
  const merge = compared.commits.find(({ parents }) => parents.length !== 1);
  if (merge !== undefined) return `${branch} holds a merge commit, ${merge.sha.slice(0, 7)}: a mission branch is never merged into`;
  return {
    head,
    commits: compared.commits.map((one) => ({ sha: one.sha, parent: one.parents[0]?.sha ?? '', message: one.commit.message, author: one.commit.author ?? undefined, pr: prOfTitle(one.commit.message) })),
  };
}

/**
 * The branch's commits with `removed` taken out: each one after the first removed replayed on the line so far, as a cherry-pick.
 * The new head, or what stopped it (the conflict of the first commit that does not apply).
 */
async function replay(on: On, { commits, first, removed }: { commits: readonly Listed[]; first: number; removed: ReadonlySet<number> }): Promise<string | { conflict: string }> {
  const { owner, repo } = on;
  const dropped = commits[first];
  if (dropped === undefined) throw new Error('nothing to replay');
  let last = dropped.parent;
  let tree = (await on.commit(last)).tree.sha;
  for (const [at, one] of commits.entries()) {
    if (at <= first || removed.has(at)) continue;
    // A scratch commit on this commit's own parent holding the tree so far: merging the commit into it takes git's three-way
    // merge from that parent, so only the commit's own change is applied.
    const scratch = ShaSchema.parse((await on.octokit.request('POST /repos/{owner}/{repo}/git/commits', { owner, repo, message: 'omni: dropping', tree, parents: [one.parent] })).data).sha;
    const merged = await on.mergedTree(scratch, one.sha);
    if (merged === null) return { conflict: one.message.split('\n')[0] ?? one.sha };
    if (merged === tree) continue;
    const made = await on.octokit.request('POST /repos/{owner}/{repo}/git/commits', { owner, repo, message: one.message, tree: merged, parents: [last], ...(one.author === undefined ? {} : { author: one.author }) });
    last = ShaSchema.parse(made.data).sha;
    tree = merged;
  }
  return last;
}

/** A feature pull request opened again against the mission branch, once its PRD is off it. */
async function reopen(octokit: GitHubClient, { owner, repo, branch, drop }: { owner: string; repo: string; branch: string; drop: DropPrd }): Promise<Reopened> {
  const none = (why: string): Reopened => ({ prd: drop.prd, pr: null, url: null, why });
  const read = PullSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', { owner, repo, pull_number: drop.pr })).data);
  const { ref, sha } = read.head;
  try {
    await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', { owner, repo, ref: `heads/${ref}` });
  } catch (error) {
    if (statusOf(error) !== 404) throw error;
    // The branch went with the merge: cut again at the head the pull request had.
    await octokit.request('POST /repos/{owner}/{repo}/git/refs', { owner, repo, ref: `refs/heads/${ref}`, sha });
  }
  const body = `${read.body ?? ''}\n\nPRD ${String(drop.prd)} was dropped from \`${branch}\` (was #${String(drop.pr)}): this pull request is opened again against it, and the PRD stays dropped until a person sends it again.\n`;
  try {
    const opened = PullWrittenSchema.parse((await octokit.request('POST /repos/{owner}/{repo}/pulls', { owner, repo, head: ref, base: branch, title: read.title, body, draft: false })).data);
    return { prd: drop.prd, pr: opened.number, url: opened.html_url, why: null };
  } catch (error) {
    if (statusOf(error) !== 422) throw error;
    return none(`GitHub refused to open #${String(drop.pr)} again: ${String(messageOf(error)).split('\n')[0] ?? ''}`);
  }
}

/** The mission branches, dropped from through `octokitFor(installation)`. */
export function missionDrops({ octokitFor }: { octokitFor: (installation: number) => Promise<GitHubClient> | GitHubClient }): MissionDrops {
  return {
    async drop({ installation, repo: slug, branch, prds }) {
      const { octokit, owner, repo, defaultBranch } = await missionRepo(octokitFor, { installation, repo: slug, branch });
      const on = onRepo(octokit, { owner, repo }, `${branch}--drop`);
      try {
        const read = await listed(on, { branch, defaultBranch });
        if (typeof read === 'string') return { ok: false, why: read };
        const found = prds.map((one) => ({ one, index: read.commits.findIndex(({ pr }) => pr === one.pr) }));
        const gone = found.filter(({ index }) => index >= 0);
        const absent = found.filter(({ index }) => index < 0).map(({ one }) => one.prd);
        if (gone.length > 0) {
          const last = await replay(on, { commits: read.commits, first: Math.min(...gone.map(({ index }) => index)), removed: new Set(gone.map(({ index }) => index)) });
          if (typeof last !== 'string') return { ok: false, why: `${branch} cannot do without ${gone.map(({ one }) => `PRD ${String(one.prd)}`).join(', ')} dropped: "${last.conflict}" conflicts once they are off it; drop the PRD built on them too, and nothing changed` };
          // The lease: the head read again just before the write; another one and nothing is written.
          if ((await on.head(branch)) !== read.head) return { ok: false, why: `${branch} moved while it was being rebased: the next run reads it again` };
          await on.write(branch, last, true);
        }
        const reopened: Reopened[] = [];
        for (const { one } of gone) reopened.push(await reopen(octokit, { owner, repo, branch, drop: one }));
        return { ok: true, removed: gone.map(({ one }) => one.prd), absent, reopened };
      } finally {
        await on.dropScratch();
      }
    },
  };
}
