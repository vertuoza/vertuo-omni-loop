// The GitHub reads the retro shares between its steps: a pull request, the pull requests into a
// branch, a folder's entries and a few files at one commit. Every call goes through the one Octokit
// seam the app's other units use, `octokit.request(route, params)`, so a test stubs one function or
// replays a recording.
//
// Nothing here runs repository code (PRD 72, decision 10): files are read through `snapshot` or the
// contents API and handed back as text, never executed. Each kind of finding (`kinds/`) reads what
// else it needs through the same seam, and may use `paginate` from here.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { snapshot } from '../snapshot/snapshot.mjs';

export const PER_PAGE = 100;
/** Pages read at most from a paginated list: 3,000 entries. */
export const MAX_PAGES = 30;

const TREE = 'GET /repos/{owner}/{repo}/git/trees/{tree_sha}';

/** Every item of a paginated list, `fetchPage(page)` giving one page's items. */
export async function paginate(fetchPage) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const items = await fetchPage(page);
    all.push(...items);
    if (items.length < PER_PAGE) break;
  }
  return all;
}

/**
 * A pull request as the retro reads it.
 * @returns {Promise<{ number: number, title: string, url: string, merged: boolean, baseRef: string,
 *   headRef: string, headSha: string, openedAt: string, mergedAt: string | null, mergeSha: string | null,
 *   labels: string[] }>}
 */
export async function readPull(octokit, { owner, repo, prNumber }) {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner,
    repo,
    pull_number: prNumber,
  });
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

/**
 * Every pull request into `base`, open or closed, oldest first, in the shape the kinds read.
 * @returns {Promise<{ number: number, title: string, url: string, state: string, draft: boolean,
 *   headRef: string, headSha: string, openedAt: string, closedAt: string | null, mergedAt: string | null,
 *   labels: string[] }[]>}
 */
export async function listPullsInto(octokit, { owner, repo, base }) {
  const pulls = await paginate((page) =>
    octokit
      .request('GET /repos/{owner}/{repo}/pulls', {
        owner,
        repo,
        base,
        state: 'all',
        per_page: PER_PAGE,
        page,
      })
      .then(({ data }) => data),
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

/**
 * The entries of one folder at `ref`, walking the tree one segment at a time from the root, as
 * `snapshot` does; `null` when the ref holds no folder there.
 * @returns {Promise<{ name: string, type: string }[] | null>}
 */
export async function listFolder(octokit, { owner, repo, ref, path }) {
  let { data } = await octokit.request(TREE, { owner, repo, tree_sha: ref });
  for (const name of path.split('/').filter(Boolean)) {
    const entry = data.tree.find((candidate) => candidate.path === name);
    if (!entry || entry.type !== 'tree') return null;
    ({ data } = await octokit.request(TREE, { owner, repo, tree_sha: entry.sha }));
  }
  return data.tree.map((entry) => ({ name: entry.path, type: entry.type }));
}

/**
 * The text of each listed file at `ref`, through `snapshot`; a file the ref does not hold reads `null`.
 * @returns {Promise<Record<string, string | null>>}
 */
export async function readFiles(octokit, { owner, repo, ref, paths }) {
  const folder = mkdtempSync(join(tmpdir(), 'omni-retro-'));
  try {
    await snapshot(octokit, { owner, repo, ref, paths, dest: folder });
    return Object.fromEntries(paths.map((path) => [path, readOrNull(join(folder, path))]));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

/** One file's text on a branch or at a commit, through the contents API; `null` when it is absent. */
export async function readContent(octokit, { owner, repo, ref, path }) {
  try {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', { owner, repo, path, ref });
    if (Array.isArray(data) || data.type !== 'file') return null;
    return Buffer.from(data.content ?? '', data.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8');
  } catch (error) {
    if (error?.status === 404) return null;
    throw error;
  }
}

function readOrNull(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function labelNames(labels) {
  return (labels ?? []).map((label) => (typeof label === 'string' ? label : label.name));
}
