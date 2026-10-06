// The GitHub reads the retro shares between its steps: a pull request, the pull requests into a
// branch, a folder's entries and a few files at one commit. Every call goes through the one Octokit
// seam the app's other units use, `octokit.request(route, params)`, so a test stubs one function or
// replays a recording.
//
// Nothing here runs repository code (PRD 72, decision 10): files are read through `snapshot` or the
// contents API and handed back as text, never executed. Each kind of finding (`kinds/`) reads what
// else it needs through the same seam, and may use `paginate` from here. Every answer is parsed by
// its schema in `github.schema.ts` before it is read.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { snapshot } from '../snapshot/snapshot.ts';
import { ContentSchema, PullSchema, PullsSchema, TreeSchema, parseGitHub } from './github.schema.ts';
import type { Octokit, Pull, PullInto } from './retro.types.ts';

export const PER_PAGE = 100;
/** Pages read at most from a paginated list: 3,000 entries. */
export const MAX_PAGES = 30;

const TREE = 'GET /repos/{owner}/{repo}/git/trees/{tree_sha}';
const PULL = 'GET /repos/{owner}/{repo}/pulls/{pull_number}';
const PULLS = 'GET /repos/{owner}/{repo}/pulls';
const CONTENTS = 'GET /repos/{owner}/{repo}/contents/{path}';

type Repo = { owner: string; repo: string };

/** Every item of a paginated list, `fetchPage(page)` giving one page's items. */
export async function paginate<T>(fetchPage: (page: number) => Promise<readonly T[]>): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const items = await fetchPage(page);
    all.push(...items);
    if (items.length < PER_PAGE) break;
  }
  return all;
}

/** A pull request as the retro reads it. */
export async function readPull(octokit: Octokit, { owner, repo, prNumber }: Repo & { prNumber: PrNumber }): Promise<Pull> {
  const { data: answer } = await octokit.request(PULL, {
    owner,
    repo,
    pull_number: prNumber,
  });
  const data = parseGitHub(PullSchema, answer, PULL);
  return {
    number: data.number,
    title: data.title ?? '',
    url: data.html_url ?? null,
    merged: data.merged === true || Boolean(data.merged_at),
    baseRef: data.base.ref,
    headRef: data.head.ref,
    headSha: data.head.sha,
    openedAt: data.created_at ?? null,
    mergedAt: data.merged_at ?? null,
    mergeSha: data.merge_commit_sha ?? null,
    labels: labelNames(data.labels),
  };
}

/** Every pull request into `base`, open or closed, oldest first, in the shape the kinds read. */
export async function listPullsInto(octokit: Octokit, { owner, repo, base }: Repo & { base: string }): Promise<PullInto[]> {
  const pulls = await paginate((page) =>
    octokit
      .request(PULLS, {
        owner,
        repo,
        base,
        state: 'all',
        per_page: PER_PAGE,
        page,
      })
      .then(({ data }) => parseGitHub(PullsSchema, data, PULLS)),
  );
  return pulls
    .map((data) => ({
      number: data.number,
      title: data.title ?? '',
      url: data.html_url ?? null,
      state: data.state,
      draft: data.draft === true,
      headRef: data.head.ref,
      headSha: data.head.sha,
      openedAt: data.created_at,
      closedAt: data.closed_at ?? null,
      mergedAt: data.merged_at ?? null,
      labels: labelNames(data.labels),
    }))
    .sort((a, b) => a.openedAt.localeCompare(b.openedAt) || a.number - b.number);
}

/** The pull requests from `branch`, open or closed, newest first: a target's feature PR is among them (PRD 1130). */
export async function listPullsFrom(octokit: Octokit, { owner, repo, branch }: Repo & { branch: string }): Promise<PrNumber[]> {
  const pulls = await paginate((page) =>
    octokit
      .request(PULLS, { owner, repo, head: `${owner}:${branch}`, state: 'all', per_page: PER_PAGE, page })
      .then(({ data }) => parseGitHub(PullsSchema, data, PULLS)),
  );
  const merged = pulls.filter((pull) => pull.merged_at);
  return (merged.length > 0 ? merged : pulls).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((pull) => pull.number);
}

/**
 * The entries of one folder at `ref`, walking the tree one segment at a time from the root, as
 * `snapshot` does; `null` when the ref holds no folder there.
 */
export async function listFolder(
  octokit: Octokit,
  { owner, repo, ref, path }: Repo & { ref: string; path: string },
): Promise<{ name: string; type: string }[] | null> {
  let data = parseGitHub(TreeSchema, (await octokit.request(TREE, { owner, repo, tree_sha: ref })).data, TREE);
  for (const name of path.split('/').filter(Boolean)) {
    const entry = data.tree.find((candidate) => candidate.path === name);
    if (!entry || entry.type !== 'tree') return null;
    data = parseGitHub(TreeSchema, (await octokit.request(TREE, { owner, repo, tree_sha: entry.sha })).data, TREE);
  }
  return data.tree.map((entry) => ({ name: entry.path, type: entry.type }));
}

/** The text of each listed file at `ref`, through `snapshot`; a file the ref does not hold reads `null`. */
export async function readFiles(
  octokit: Octokit,
  { owner, repo, ref, paths }: Repo & { ref: string; paths: string[] },
): Promise<Record<string, string | null>> {
  const folder = mkdtempSync(join(tmpdir(), 'omni-retro-'));
  try {
    await snapshot(octokit, { owner, repo, ref, paths, dest: folder });
    return Object.fromEntries(paths.map((path) => [path, readOrNull(join(folder, path))]));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

/** One file's text on a branch or at a commit, through the contents API; `null` when it is absent. */
export async function readContent(
  octokit: Octokit,
  { owner, repo, ref, path }: Repo & { ref: string; path: string },
): Promise<string | null> {
  try {
    const { data: answer } = await octokit.request(CONTENTS, { owner, repo, path, ref });
    const data = parseGitHub(ContentSchema, answer, CONTENTS);
    if (Array.isArray(data) || data.type !== 'file') return null;
    return Buffer.from(data.content ?? '', data.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8');
  } catch (error) {
    if (statusOf(error) === 404) return null;
    throw error;
  }
}

/** The HTTP status an Octokit error carries, when it carries one. */
function statusOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
}

function readOrNull(file: string): string | null {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function labelNames(labels: readonly (string | { name: string })[] | null | undefined): string[] {
  return (labels ?? []).map((label) => (typeof label === 'string' ? label : label.name));
}
