// The mission branch follows the default branch (PRD 2896 s5, spec "4. Keeping up", criterion 8). Through GitHub's REST API
// only, as the App's installation: nothing is cloned, and the default branch is never written (N-PRODUCT-15).
//
//   the branch    when the default branch moved, the mission branch is rebased onto its new tip. It is a straight line, one
//                 squash commit per PRD (./join.ts), so each commit is replayed in order: merged into a scratch branch at the
//                 new tip (`POST …/merges`, git's three-way merge from the old fork point), its tree then committed on the one
//                 before it, its message and author kept; one that changes nothing there is dropped (a PRD the default
//                 branch holds already, after a landing, PRD 2896 s6). A branch with no commit of its own is moved without force. The
//                 rebased line is written with force only once every commit replayed, and only while the branch's head is
//                 still the one read (the lease: read again just before the write; another head and nothing is written,
//                 the next run reads it again). A merge commit on the branch holds it: the branch is never merged into
//   a conflict    changes no branch. The files both sides changed are named; when every one of them is a generated output
//                 (the `generated` entries of the default branch's `.omni-loop/config.yml`, kit/lib/generated/stale.ts) the
//                 conflict is one a rebuild settles. With sources among them, the commit is merged again with its generated
//                 outputs set to the new tip's (a probe, thrown away): clean, the sources merged and the conflict was only
//                 in generated paths; a conflict still, it is a person's, naming the sources
//   each feature  once the branch is in step, each open feature pull request into it that is behind is brought onto its
//                 tip with GitHub's Update branch, which merges the tip in, under the lease of the head it read
//                 (`expected_head_sha`): a feature branch is merged into before it is squashed, never force-pushed under
//                 the job building on it. A conflict is told apart as the branch's is, and changes nothing
//
// The scratch branch, `<mission branch>--keep-up`, is removed before the run ends, whatever happened.
// Throws when GitHub refuses otherwise or answers out of shape: the run fails, and the worker retries it.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { splitGenerated, type GeneratedEntry } from 'omni-loop/kit/lib/generated/stale.ts';
import type { PrdNumber, PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { missionRepo } from './branch.ts';
import { messageOf, RefSchema, ShaSchema, statusOf, type GitHubClient } from '../outbox-check/github-schema.ts';
import { readBaseConfig } from '../outbox-check/github.ts';

/** A feature pull request of the mission, by its PRD. */
export type FeatureAt = { prd: PrdNumber; pr: PrNumber };

/** Where a mission branch is: the installation, the repository (`owner/name`), the branch and the mission's open feature pull requests. */
export type KeepUpAt = { installation: number; repo: string; branch: string; features: readonly FeatureAt[] };

/** A conflict: whether it is only in generated paths, and the files both sides changed (only the generated ones, or only the others). */
export type Conflict = { generated: boolean; files: string[] };

/** What became of one feature branch: on the tip already, brought onto it, left (closed, another base, moved meanwhile), or conflicting. */
export type FeatureKept = ({ kept: 'in-step' | 'updated' | 'skipped' } | ({ kept: 'conflict' } & Conflict)) & FeatureAt;

/** What a keeping up did. `since` is when the branch's head was committed: what was sent for it after then was sent for this head. */
export type KeptUp =
  | { branch: 'in-step' | 'rebased'; defaultBranch: string; since: string; features: FeatureKept[] }
  | ({ branch: 'conflict'; defaultBranch: string; title: string } & Conflict)
  | { branch: 'held'; defaultBranch: string; why: string };

/** What the supervisor asks of GitHub for the mission branch to follow the default branch. */
export type MissionKeepUps = { keepUp: (at: KeepUpAt) => Promise<KeptUp> };

export type Where = { owner: string; repo: string };

/** The most commits a mission branch replays: one per PRD, so a scope of PRDs, far below GitHub's 250 a compare lists. */
const MAX_COMMITS = 100;

const CompareSchema = z.looseObject({
  merge_base_commit: z.looseObject({ sha: z.string() }),
  ahead_by: z.number(),
  behind_by: z.number(),
  commits: z.array(
    z.looseObject({
      sha: z.string(),
      parents: z.array(z.looseObject({ sha: z.string() })),
      commit: z.looseObject({ message: z.string(), author: z.looseObject({ name: z.string(), email: z.string(), date: z.string() }).nullish() }),
    }),
  ),
  files: z.array(z.looseObject({ filename: z.string(), status: z.string(), sha: z.string().nullish() })).nullish(),
});
type Compare = z.infer<typeof CompareSchema>;
type ChangedFile = NonNullable<Compare['files']>[number];
const CommitSchema = z.looseObject({ tree: z.looseObject({ sha: z.string() }), committer: z.looseObject({ date: z.string() }).nullish() });
const MergedSchema = z.looseObject({ commit: z.looseObject({ tree: z.looseObject({ sha: z.string() }) }) });
const PullSchema = z.looseObject({ state: z.string(), base: z.looseObject({ ref: z.string() }), head: z.looseObject({ sha: z.string() }) });

/** The generated outputs the repository declares at `ref`: its `.omni-loop/config.yml`'s `generated` entries, none without one. */
async function generatedAt(octokit: GitHubClient, { owner, repo, ref }: Where & { ref: string }): Promise<readonly GeneratedEntry[]> {
  const folder = mkdtempSync(join(tmpdir(), 'omni-keep-up-'));
  try {
    const { config } = await readBaseConfig(octokit, { owner, repo, baseSha: ref, dest: folder, ignoreUnknownKeys: true });
    return config?.generated ?? [];
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

/** The calls a keeping up makes, on one repository, with its scratch branch. */
export function onRepo(octokit: GitHubClient, where: Where, scratch: string) {
  const { owner, repo } = where;
  let scratched = false;
  const head = async (branch: string): Promise<string | null> => {
    try {
      return RefSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', { owner, repo, ref: `heads/${branch}` })).data).object.sha;
    } catch (error) {
      if (statusOf(error) === 404) return null;
      throw error;
    }
  };
  const compare = async (base: string, tip: string): Promise<Compare> =>
    CompareSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}', { owner, repo, basehead: `${base}...${tip}` })).data);
  const commit = async (sha: string) => CommitSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/git/commits/{commit_sha}', { owner, repo, commit_sha: sha })).data);
  const write = async (branch: string, sha: string, force: boolean): Promise<void> => {
    await octokit.request('PATCH /repos/{owner}/{repo}/git/refs/{ref}', { owner, repo, ref: `heads/${branch}`, sha, force });
  };
  /** The scratch branch at `sha`: cut, or moved there. */
  const scratchAt = async (sha: string): Promise<void> => {
    if (!scratched && (await head(scratch)) === null) await octokit.request('POST /repos/{owner}/{repo}/git/refs', { owner, repo, ref: `refs/heads/${scratch}`, sha });
    else await write(scratch, sha, true);
    scratched = true;
  };
  /** `sha` merged into the scratch branch at `into`: the merged tree, or null on a conflict. */
  const mergedTree = async (into: string, sha: string): Promise<string | null> => {
    await scratchAt(into);
    try {
      const { data } = await octokit.request('POST /repos/{owner}/{repo}/merges', { owner, repo, base: scratch, head: sha, commit_message: 'omni: keeping the mission branch up' });
      // Nothing to merge (204): `sha` is in `into` already, and its tree is `into`'s.
      return data === null || data === undefined || data === '' ? (await commit(into)).tree.sha : MergedSchema.parse(data).commit.tree.sha;
    } catch (error) {
      if (statusOf(error) === 409) return null;
      throw error;
    }
  };
  const dropScratch = async (): Promise<void> => {
    if (!scratched) return;
    try {
      await octokit.request('DELETE /repos/{owner}/{repo}/git/refs/{ref}', { owner, repo, ref: `heads/${scratch}` });
    } catch (error) {
      if (statusOf(error) !== 422 && statusOf(error) !== 404) throw error;
    }
  };
  return { octokit, owner, repo, head, compare, commit, write, mergedTree, dropScratch };
}

export type On = ReturnType<typeof onRepo>;

/**
 * What a conflict of `tip` (merged into `into`, from `mergeBase`) is in: the files both sides changed, then, when sources sit
 * beside generated outputs among them, the probe: `tip` with its generated outputs set to `into`'s, merged again.
 */
async function conflictOf(on: On, { into, tip, mergeBase, entries }: { into: string; tip: string; mergeBase: string; entries: readonly GeneratedEntry[] }): Promise<Conflict> {
  const ours = new Map(((await on.compare(mergeBase, into)).files ?? []).map((file) => [file.filename, file]));
  // A file both sides changed alike (the same blob, as a PRD's own changes on a feature branch and on the rebased branch) never conflicts.
  const differ = (file: ChangedFile): boolean => {
    const mine = ours.get(file.filename);
    return mine !== undefined && (mine.sha ?? null) !== (file.sha ?? null);
  };
  const both = ((await on.compare(mergeBase, tip)).files ?? []).filter(differ).map(({ filename }) => filename);
  const { generated, other } = splitGenerated(entries, both);
  if (generated.length === 0) return { generated: false, files: other };
  if (other.length === 0) return { generated: true, files: generated };
  const entry = (path: string): { path: string; mode: string; type: 'blob'; sha: string | null } => {
    const file: ChangedFile | undefined = ours.get(path);
    return { path, mode: '100644', type: 'blob', sha: file === undefined || file.status === 'removed' ? null : (file.sha ?? null) };
  };
  const { owner, repo } = on;
  const tree = ShaSchema.parse((await on.octokit.request('POST /repos/{owner}/{repo}/git/trees', { owner, repo, base_tree: (await on.commit(tip)).tree.sha, tree: generated.map(entry) })).data).sha;
  const probe = ShaSchema.parse((await on.octokit.request('POST /repos/{owner}/{repo}/git/commits', { owner, repo, message: 'omni: probe', tree, parents: [tip] })).data).sha;
  return (await on.mergedTree(into, probe)) === null ? { generated: false, files: other } : { generated: true, files: generated };
}

/** Why a branch that is behind cannot be replayed (more commits than the app rebases, a merge commit); null when it can. */
function unreplayable({ ahead_by: ahead, commits }: Compare): string | null {
  if (ahead > MAX_COMMITS || commits.length < ahead) return `it holds ${String(ahead)} commits, more than the ${String(MAX_COMMITS)} the app rebases`;
  const merge = commits.find(({ parents }) => parents.length !== 1);
  return merge === undefined ? null : `it holds a merge commit, ${merge.sha.slice(0, 7)}: a mission branch is never merged into`;
}

/**
 * Each commit of the branch replayed onto `tip`, in order: the new head, or the conflict of the first that does not merge. A
 * commit that changes nothing on what it is replayed onto is dropped, as git's rebase drops it: after a landing by Rebase and
 * merge (PRD 2896 s6) the default branch holds a copy of each PRD's commit, and the branch keeps only the PRDs that joined after.
 */
async function replay(on: On, { tip, compared, defaultBranch, entries }: { tip: string; compared: Compare; defaultBranch: string; entries: readonly GeneratedEntry[] }): Promise<KeptUp | string> {
  let last = tip;
  let lastTree = (await on.commit(tip)).tree.sha;
  for (const one of compared.commits) {
    const tree = await on.mergedTree(tip, one.sha);
    const title = one.commit.message.split('\n')[0] ?? '';
    if (tree === null) return { branch: 'conflict', defaultBranch, title, ...(await conflictOf(on, { into: tip, tip: one.sha, mergeBase: compared.merge_base_commit.sha, entries })) };
    if (tree === lastTree) continue;
    const author = one.commit.author ?? undefined;
    const made = await on.octokit.request('POST /repos/{owner}/{repo}/git/commits', { owner: on.owner, repo: on.repo, message: one.commit.message, tree, parents: [last], ...(author === undefined ? {} : { author }) });
    last = ShaSchema.parse(made.data).sha;
    lastTree = tree;
  }
  return last;
}

/** The mission branch, rebased onto `tip` when it is behind; its head after, or what holds it. */
async function rebaseBranch(on: On, { branch, tip, defaultBranch, entries }: { branch: string; tip: string; defaultBranch: string; entries: readonly GeneratedEntry[] }): Promise<KeptUp | { head: string; rebased: boolean }> {
  const read = await on.head(branch);
  if (read === null) return { branch: 'held', defaultBranch, why: 'it is not cut yet' };
  const compared = await on.compare(tip, read);
  if (compared.behind_by === 0) return { head: read, rebased: false };
  if (compared.ahead_by === 0) {
    await on.write(branch, tip, false);
    return { head: tip, rebased: true };
  }
  const why = unreplayable(compared);
  if (why !== null) return { branch: 'held', defaultBranch, why };
  const last = await replay(on, { tip, compared, defaultBranch, entries });
  if (typeof last !== 'string') return last;
  // The lease: the head read again just before the write; another one and nothing is written.
  if ((await on.head(branch)) !== read) return { branch: 'held', defaultBranch, why: 'it moved while it was being rebased: the next run reads it again' };
  await on.write(branch, last, true);
  return { head: last, rebased: true };
}

/** One feature pull request, brought onto the mission branch's head `tip` when it is behind it. */
async function keepFeature(on: On, { feature, branch, tip, entries }: { feature: FeatureAt; branch: string; tip: string; entries: readonly GeneratedEntry[] }): Promise<FeatureKept> {
  const { owner, repo } = on;
  const pull = PullSchema.parse((await on.octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', { owner, repo, pull_number: feature.pr })).data);
  if (pull.state !== 'open' || pull.base.ref !== branch) return { ...feature, kept: 'skipped' };
  const compared = await on.compare(tip, pull.head.sha);
  if (compared.behind_by === 0) return { ...feature, kept: 'in-step' };
  try {
    await on.octokit.request('PUT /repos/{owner}/{repo}/pulls/{pull_number}/update-branch', { owner, repo, pull_number: feature.pr, expected_head_sha: pull.head.sha });
    return { ...feature, kept: 'updated' };
  } catch (error) {
    if (statusOf(error) !== 422) throw error;
    // Its head moved since it was read: the next run reads it again.
    if (/expected head sha/i.test(String(messageOf(error)))) return { ...feature, kept: 'skipped' };
    return { ...feature, kept: 'conflict', ...(await conflictOf(on, { into: tip, tip: pull.head.sha, mergeBase: compared.merge_base_commit.sha, entries })) };
  }
}

/** The mission branches, kept up through `octokitFor(installation)`; `generatedOf` reads the repository's generated outputs. */
export function missionKeepUps({
  octokitFor,
  generatedOf = generatedAt,
}: {
  octokitFor: (installation: number) => Promise<GitHubClient> | GitHubClient;
  generatedOf?: (octokit: GitHubClient, at: Where & { ref: string }) => Promise<readonly GeneratedEntry[]>;
}): MissionKeepUps {
  return {
    async keepUp({ installation, repo: slug, branch, features }) {
      const { octokit, owner, repo, defaultBranch } = await missionRepo(octokitFor, { installation, repo: slug, branch });
      const on = onRepo(octokit, { owner, repo }, `${branch}--keep-up`);
      try {
        const tip = await on.head(defaultBranch);
        if (tip === null) throw new Error(`${slug} has no ${defaultBranch} branch`);
        const entries = await generatedOf(octokit, { owner, repo, ref: tip });
        const rebased = await rebaseBranch(on, { branch, tip, defaultBranch, entries });
        if ('branch' in rebased) return rebased;
        const kept: FeatureKept[] = [];
        for (const feature of features) kept.push(await keepFeature(on, { feature, branch, tip: rebased.head, entries }));
        const since = (await on.commit(rebased.head)).committer?.date ?? new Date(0).toISOString();
        return { branch: rebased.rebased ? 'rebased' : 'in-step', defaultBranch, since, features: kept };
      } finally {
        await on.dropScratch();
      }
    },
  };
}

// ── What it says ─────────────────────────────────────────────────────────────────

/** The most files a wait names. */
const FILES_NAMED = 5;

/** `a, b, c`, the first five, and how many more. */
function filesWords(files: readonly string[]): string {
  const named = files.slice(0, FILES_NAMED).join(', ');
  return files.length > FILES_NAMED ? `${named} and ${String(files.length - FILES_NAMED)} more` : named;
}

/**
 * What a person must do for mission branch `branch` and its feature branches to follow the default branch, one line each; none
 * when nothing waits on one. A feature branch that conflicts only in generated paths waits on no person: a job rebuilds them.
 */
export function keptWaits(kept: KeptUp, branch: string): string[] {
  const cannot = `${branch} cannot follow ${kept.defaultBranch}`;
  if (kept.branch === 'held') return [`${cannot}: ${kept.why}`];
  if (kept.branch === 'conflict') {
    const where = kept.generated ? `only in generated files: ${filesWords(kept.files)}, which no runner job rebuilds on a mission branch yet; rebase it and rebuild them by hand` : `in ${filesWords(kept.files)}`;
    return [`${cannot}: "${kept.title}" conflicts with it ${where}; no branch changed`];
  }
  return kept.features.flatMap((one) => (one.kept === 'conflict' && !one.generated ? [`PRD ${String(one.prd)}: #${String(one.pr)} conflicts with ${branch} in ${filesWords(one.files)}`] : []));
}

/** The job that rebases a feature branch conflicting only in generated paths and rebuilds them: its care, on the mission branch. */
export const careLine = (prd: PrdNumber, branch: string): string => `/omni:pr-care ${String(prd)} --once --base ${branch}`;
