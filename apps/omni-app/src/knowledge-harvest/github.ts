// The GitHub reads of the knowledge harvest: the merge's facts from the pull request itself, the
// default branch's tip, the loop's folders at a commit as a local tree the kit's units read, and the
// ids the open knowledge branches already take. Every call goes through the one Octokit seam the
// app's units use, `octokit.request(route, params)`; files are read through `snapshot`, as text,
// never run.
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONFIG_FILE, loadConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { createContext } from 'vertuo-omni-plan/kit/lib/context.ts';
import { readKnowledge } from 'vertuo-omni-plan/kit/lib/knowledge/registers.ts';
import { readDecisions } from 'vertuo-omni-plan/kit/lib/playbook/decisions.ts';
import { paginate, PER_PAGE } from '../retro/github.ts';
import { topicOf } from '../retro/qualify.ts';
import type { Config } from 'vertuo-omni-plan/kit/lib/types.ts';
import { snapshot } from '../snapshot/snapshot.ts';
import { OpenPullSchema, parsedOr, PullMergeSchema, RefSchema } from './schema.ts';

/** The one seam of GitHub the harvest reads and writes through: a REST route and its parameters. */
export type RequestOctokit = { request: (route: string, params?: Record<string, unknown>) => Promise<{ data: unknown }> };

/** A kit context over a tree on disk. */
type Context = ReturnType<typeof createContext>;

/** The merge's facts, as the pull request holds them. */
export type MergeFacts = { merged: boolean; by: string | null; at: string | null; sha: string | null; url: string | null };

/** Who merged the pull request, when, at which commit, and where it lives. */
export async function readMerge(
  octokit: RequestOctokit,
  { owner, repo, prNumber }: { owner: string; repo: string; prNumber: number },
): Promise<MergeFacts> {
  const { data: answer } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', { owner, repo, pull_number: prNumber });
  const data = parsedOr(PullMergeSchema, answer, `GitHub answered #${prNumber} unexpectedly`);
  return {
    merged: data.merged === true || Boolean(data.merged_at),
    by: data.merged_by?.login ?? null,
    at: data.merged_at ?? null,
    sha: data.merge_commit_sha ?? null,
    url: data.html_url ?? null,
  };
}

/** The commit a branch points at. */
export async function tipOf(octokit: RequestOctokit, { owner, repo, branch }: { owner: string; repo: string; branch: string }): Promise<string> {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', { owner, repo, ref: `heads/${branch}` });
  return parsedOr(RefSchema, data, `GitHub answered the branch ${branch} unexpectedly`).object.sha;
}

/** The loop's own paths a harvest reads: the config, the delivery folder, the knowledge base. */
export function loopPaths(config: Config): string[] {
  const { paths } = config;
  return [CONFIG_FILE, paths.delivery, paths.knowledge, paths.adr, paths.playbook, paths.glossary].filter(
    (path): path is string => typeof path === 'string' && path.length > 0,
  );
}

/**
 * Runs `fn` with a kit context over the loop's paths at `sha`, snapshotted into a scratch folder that
 * is removed afterwards. The context's config is the one at `sha`; `config` only names what to read.
 */
export async function withTreeAt<T>(
  octokit: RequestOctokit,
  { owner, repo, sha, config }: { owner: string; repo: string; sha: string; config: Config },
  fn: (ctx: Context, root: string) => T | Promise<T>,
): Promise<T> {
  const root = mkdtempSync(join(tmpdir(), 'omni-harvest-tree-'));
  try {
    await snapshot(octokit, { owner, repo, ref: sha, paths: loopPaths(config), dest: root });
    return await fn(createContext(root, loadConfig(root)), root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** Every file under `root`, relative to it, sorted. */
export function filesIn(root: string, dir = ''): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(root, dir))) {
    const rel = dir ? `${dir}/${name}` : name;
    if (statSync(join(root, rel)).isDirectory()) out.push(...filesIn(root, rel));
    else out.push(rel);
  }
  return out.sort();
}

/**
 * The record numbers and register ids every other open knowledge branch already takes, so this run
 * numbers past them. A knowledge branch is an open pull request into the default branch whose head
 * matches `branches.knowledge`; `own` is this run's branch, left out so a replay numbers as it did.
 */
export async function takenElsewhere(
  octokit: RequestOctokit,
  { owner, repo, config, own }: { owner: string; repo: string; config: Config; own: string },
): Promise<{ records: string[]; ids: string[]; branches: string[] }> {
  const pulls = await paginate((page: number) =>
    octokit
      .request('GET /repos/{owner}/{repo}/pulls', {
        owner,
        repo,
        base: config.repo.defaultBranch,
        state: 'open',
        per_page: PER_PAGE,
        page,
      })
      .then(({ data }) => data),
  );
  const branches = [...new Set(parsedOr(OpenPullSchema.array(), pulls, 'GitHub answered the open pull requests unexpectedly').map((pull) => pull.head?.ref))]
    .filter((ref): ref is string => Boolean(ref) && ref !== own && topicOf(ref, config.branches.knowledge) !== null)
    .sort();

  const records = new Set<string>();
  const ids = new Set<string>();
  const paths = [config.paths.knowledge, config.paths.adr].filter((path): path is string => Boolean(path));
  for (const branch of branches) {
    const sha = await tipOf(octokit, { owner, repo, branch });
    const root = mkdtempSync(join(tmpdir(), 'omni-harvest-taken-'));
    try {
      await snapshot(octokit, { owner, repo, ref: sha, paths, dest: root });
      const ctx = createContext(root, config);
      for (const entry of readKnowledge({ ctx }).entries) ids.add(entry.id);
      for (const record of readDecisions({ ctx }).records) records.add(record.number);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
  return { records: [...records].sort(), ids: [...ids].sort(), branches };
}
