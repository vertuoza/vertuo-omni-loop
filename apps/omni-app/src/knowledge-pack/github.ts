// The GitHub reads of the knowledge pack (PRD 2011 s11): the files a merged pull request changed, with a
// rename's old path; the config at the merge commit; and the pack's paths at that commit, as bytes. Every
// call goes through `octokit.request(route, params)`, the installation's budgeted client at `background`
// priority (../octokit-for.ts, PRD 902); files are read through `snapshot` (Git Data trees and blobs),
// never run.
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { CONFIG_FILE, parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import type { PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { Config } from 'vertuo-omni-plan/kit/lib/types.ts';
import { paginate, PER_PAGE } from '../retro/github.ts';
import type { GitHubClient } from '../outbox-check/github-schema.ts';
import { snapshot } from '../snapshot/snapshot.ts';
import type { ChangedPath, PackPaths } from './paths.ts';

type Repo = { owner: string; repo: string };

const PullFileSchema = z.looseObject({ filename: z.string().min(1), previous_filename: z.string().nullish() });

/** The files the pull request changed, every page, each with its old path when it was renamed. */
export async function changedPaths(octokit: GitHubClient, { owner, repo, prNumber }: Repo & { prNumber: PrNumber }): Promise<ChangedPath[]> {
  const files = await paginate(async (page: number) => {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', { owner, repo, pull_number: prNumber, per_page: PER_PAGE, page });
    return z.array(PullFileSchema).parse(data);
  });
  return files.map((file) => ({ path: file.filename, previous: file.previous_filename ?? null }));
}

/** Every file under `root`, by its path relative to it. */
function filesIn(root: string, dir = ''): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const rel = dir ? `${dir}/${name}` : name;
    return statSync(join(root, rel)).isDirectory() ? filesIn(root, rel) : [rel];
  });
}

/** Runs `fn` over a scratch folder holding `paths` at `sha`, removed afterwards. */
async function withPathsAt<T>(octokit: GitHubClient, { owner, repo, sha, paths }: Repo & { sha: string; paths: string[] }, fn: (root: string) => T): Promise<T> {
  const root = mkdtempSync(join(tmpdir(), 'omni-knowledge-pack-'));
  try {
    await snapshot(octokit, { owner, repo, ref: sha, paths, dest: root });
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** The repository's config at `sha`: the config, none when the commit has no config file, or why it does not parse. */
export async function configAt(octokit: GitHubClient, where: Repo & { sha: string }): Promise<{ config: Config } | { none: string }> {
  return withPathsAt(octokit, { ...where, paths: [CONFIG_FILE] }, (root) => {
    const files = filesIn(root);
    if (!files.includes(CONFIG_FILE)) return { none: `it has no ${CONFIG_FILE}` };
    try {
      return { config: parseConfig(readFileSync(join(root, CONFIG_FILE), 'utf8'), CONFIG_FILE, { ignoreUnknownKeys: true }) };
    } catch (error) {
      return { none: `its config does not parse: ${(error instanceof Error ? error.message : String(error)).split('\n')[0] ?? ''}` };
    }
  });
}

/** The bytes of every file of the pack's paths at `sha`, by repository path. A path the commit lacks is left out. */
export async function packBytesAt(octokit: GitHubClient, { owner, repo, sha, paths }: Repo & { sha: string; paths: PackPaths }): Promise<Map<string, Buffer>> {
  return withPathsAt(octokit, { owner, repo, sha, paths: [...paths.folders, ...paths.files] }, (root) =>
    new Map(filesIn(root).map((path) => [path, readFileSync(join(root, path))])),
  );
}
