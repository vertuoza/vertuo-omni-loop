// The GitHub reads of the knowledge harvest: the merge's facts from the pull request itself, the
// default branch's tip, the loop's folders at a commit as a local tree the kit's units read, and the
// ids the open knowledge branches already take. Every call goes through the one Octokit seam the
// app's units use, `octokit.request(route, params)`; files are read through `snapshot`, as text,
// never run.
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONFIG_FILE, loadConfig } from 'vertuo-omni-plan/kit/lib/config.mjs';
import { createContext } from 'vertuo-omni-plan/kit/lib/context.mjs';
import { readKnowledge } from 'vertuo-omni-plan/kit/lib/knowledge/registers.mjs';
import { readDecisions } from 'vertuo-omni-plan/kit/lib/playbook/decisions.mjs';
import { paginate, PER_PAGE } from '../retro/github.mjs';
import { topicOf } from '../retro/qualify.mjs';
import { snapshot } from '../snapshot/snapshot.mjs';

/**
 * Who merged the pull request, when, at which commit, and where it lives.
 * @returns {Promise<{ merged: boolean, by: string | null, at: string | null, sha: string | null, url: string | null }>}
 */
export async function readMerge(octokit, { owner, repo, prNumber }) {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', { owner, repo, pull_number: prNumber });
  return {
    merged: data.merged === true || Boolean(data.merged_at),
    by: data.merged_by?.login ?? null,
    at: data.merged_at ?? null,
    sha: data.merge_commit_sha ?? null,
    url: data.html_url ?? null,
  };
}

/** The commit a branch points at. */
export async function tipOf(octokit, { owner, repo, branch }) {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', { owner, repo, ref: `heads/${branch}` });
  return data.object.sha;
}

/** The loop's own paths a harvest reads: the config, the delivery folder, the knowledge base. */
export function loopPaths(config) {
  const { paths } = config;
  return [CONFIG_FILE, paths.delivery, paths.knowledge, paths.adr, paths.playbook, paths.glossary].filter(
    (path) => typeof path === 'string' && path.length > 0,
  );
}

/**
 * Runs `fn` with a kit context over the loop's paths at `sha`, snapshotted into a scratch folder that
 * is removed afterwards. The context's config is the one at `sha`; `config` only names what to read.
 */
export async function withTreeAt(octokit, { owner, repo, sha, config }, fn) {
  const root = mkdtempSync(join(tmpdir(), 'omni-harvest-tree-'));
  try {
    await snapshot(octokit, { owner, repo, ref: sha, paths: loopPaths(config), dest: root });
    return await fn(createContext(root, loadConfig(root)), root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** Every file under `root`, relative to it, sorted. */
export function filesIn(root, dir = '') {
  const out = [];
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
 * @returns {Promise<{ records: string[], ids: string[], branches: string[] }>}
 */
export async function takenElsewhere(octokit, { owner, repo, config, own }) {
  const pulls = await paginate((page) =>
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
  const branches = [...new Set(pulls.map((pull) => pull.head?.ref))]
    .filter((ref) => ref && ref !== own && topicOf(ref, config.branches.knowledge) !== null)
    .sort();

  const records = new Set();
  const ids = new Set();
  const paths = [config.paths.knowledge, config.paths.adr].filter(Boolean);
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
