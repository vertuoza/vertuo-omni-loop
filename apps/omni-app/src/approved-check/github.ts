// The GitHub reads of the `omni/approved` check on a ◆ PRD of a repository (PRD 1612). Every call goes through
// the one Octokit seam, `octokit.request(route, params)`, so a test stubs one function, and in the App
// through the installation's shared budget client (../octokit-for.ts).
//
// Nothing here runs repository code or clones (PRD 28, decision 5): the PRD's folder is read at the
// head through Git trees and blobs (`snapshot`), and the config through the kit's own schema.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { parseFolderName } from 'vertuo-omni-plan/kit/lib/layout.ts';
import { parsePr, type PrNumber, type PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { Config } from 'vertuo-omni-plan/kit/lib/types.ts';
import { prdDirs } from '../evaluate/evaluate.ts';
import { readBaseConfig, readPull, type PullFacts } from '../outbox-check/github.ts';
import { PullsPageSchema, statusOf, TreeSchema, type GitHubClient, type Repo } from '../outbox-check/github-schema.ts';
import { paginate, PER_PAGE } from '../retro/github.ts';
import { partOf } from './subject.ts';

/** A pull request, by its repository and number. */
export type PullRef = Repo & { prNumber: PrNumber };

/** The config of `ref` (a base branch's sha), or null when it has none or a broken one. */
export async function configAt(octokit: GitHubClient, { owner, repo, ref }: Repo & { ref: string }): Promise<Config | null> {
  const folder = mkdtempSync(join(tmpdir(), 'omni-approved-config-'));
  try {
    return (await readBaseConfig(octokit, { owner, repo, baseSha: ref, dest: folder })).config;
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

/** The names of the folders directly under `dir` at `ref`; none when it is not there. Reads no blob. */
async function folderNamesAt(octokit: GitHubClient, { owner, repo, ref, dir }: Repo & { ref: string; dir: string }): Promise<string[]> {
  let entries = await treeAt(octokit, { owner, repo, sha: ref });
  for (const segment of dir.split('/').filter(Boolean)) {
    const entry = entries.find((candidate) => candidate.path === segment && candidate.type === 'tree');
    if (!entry) return [];
    entries = await treeAt(octokit, { owner, repo, sha: entry.sha });
  }
  return entries.filter((entry) => entry.type === 'tree').map((entry) => entry.path);
}

async function treeAt(octokit: GitHubClient, { owner, repo, sha }: Repo & { sha: string }) {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', { owner, repo, tree_sha: sha });
  return TreeSchema.parse(data).tree;
}

/** The folder at `ref` of the PRD `which` picks among the folder names, inbox first, then shipped; null
 * when none holds it. */
export async function prdFolderAt(
  octokit: GitHubClient,
  { owner, repo, ref, config, which }: Repo & { ref: string; config: Config; which: (folder: { prd: PrdNumber; topic: string }) => boolean },
): Promise<{ prd: PrdNumber; dir: string } | null> {
  for (const dir of prdDirs(config)) {
    for (const name of await folderNamesAt(octokit, { owner, repo, ref, dir })) {
      const folder = parseFolderName(name);
      if (folder && which(folder)) return { prd: folder.prd, dir: `${dir}/${name}` };
    }
  }
  return null;
}

/** Every open pull request of `owner/repo`, number and body. */
async function openPulls(octokit: GitHubClient, { owner, repo }: Repo) {
  return paginate((page) =>
    octokit
      .request('GET /repos/{owner}/{repo}/pulls', { owner, repo, state: 'open', per_page: PER_PAGE, page })
      .then(({ data }) => PullsPageSchema.parse(data)),
  );
}

const closes = (prd: PrdNumber) => new RegExp(`Closes #${Number(prd)}(?!\\d)`);

/** The PRD's feature PR, as a target PR reads it: an open pull request of `slug` saying `Closes #<prd>`
 * into the default branch its own base's config names, with that config. `held` when there is none,
 * or this installation cannot read `slug` (GitHub answers 403 or 404). */
export async function featurePullOf(
  octokit: GitHubClient,
  { slug, prd }: { slug: string; prd: PrdNumber },
): Promise<{ pull: PullFacts; config: Config } | { held: string }> {
  const [owner = '', repo = ''] = slug.split('/');
  try {
    for (const { number, body } of await openPulls(octokit, { owner, repo })) {
      if (!closes(prd).test(body ?? '')) continue;
      const pull = await readPull(octokit, { owner, repo, prNumber: parsePr(number) });
      const config = await configAt(octokit, { owner, repo, ref: pull.baseSha });
      if (config && pull.baseRef === config.repo.defaultBranch) return { pull, config };
    }
  } catch (error) {
    const status = statusOf(error);
    if (status === 403 || status === 404) return { held: `${slug} cannot be read from this installation (${status})` };
    throw error;
  }
  return { held: `${slug} has no open feature PR for PRD ${Number(prd)}` };
}

/** `GET /search/issues`: each pull request found, its number, body and repository. */
const SearchSchema = z.looseObject({
  items: z.array(z.looseObject({ number: z.number(), body: z.string().nullish(), repository_url: z.string(), pull_request: z.unknown().optional() })),
});

/** The open pull requests of PRD `prd` of `owner/repo` the check runs on: its feature PRs here (saying
 * `Closes #<prd>`), and the target PRs of the same account whose body starts `Part of <owner/repo>#<prd>`.
 * The check itself decides which of them it posts on. */
export async function openPullsOfPrd(octokit: GitHubClient, { owner, repo, prd }: Repo & { prd: PrdNumber }): Promise<PullRef[]> {
  const slug = `${owner}/${repo}`;
  const here = (await openPulls(octokit, { owner, repo }))
    .filter((pull) => closes(prd).test(pull.body ?? ''))
    .map((pull) => ({ owner, repo, prNumber: parsePr(pull.number) }));
  const { data } = await octokit.request('GET /search/issues', {
    q: `"Part of ${slug}#${Number(prd)}" is:pr is:open user:${owner}`,
    per_page: PER_PAGE,
  });
  const targets = SearchSchema.parse(data).items.flatMap((item) => {
    const [targetRepo = '', targetOwner = ''] = item.repository_url.split('/').reverse();
    const part = partOf(item.body ?? '', `${targetOwner}/${targetRepo}`);
    if (item.pull_request === undefined || !part || part.repo.toLowerCase() !== slug.toLowerCase() || part.prd !== prd) return [];
    return [{ owner: targetOwner, repo: targetRepo, prNumber: parsePr(item.number) }];
  });
  return [...here, ...targets];
}
