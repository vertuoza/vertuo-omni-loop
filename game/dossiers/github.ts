// @ts-nocheck
// The fallback's reads of GitHub (PRD 216), through the gh CLI as game/sources/github.ts reads: every
// call goes through `exec`, so tests run on gh outputs as fixtures (game/dossiers/fake-github.ts).
// Reads only, and only the default branch: its head, one file at that commit, one recursive tree
// listing, and a blob by its hash; and, for a fix's dossier (PRD 627), its issue's title.
import { z } from 'zod';
import { CONFIG_FILE } from './folders.ts';

const RAW = ['-H', 'Accept: application/vnd.github.raw'];

const Tree = z.object({
  tree: z.array(z.object({ path: z.string(), type: z.string(), sha: z.string(), size: z.number().int().nonnegative().optional() })),
  truncated: z.boolean().optional(),
});

/** What a failed gh call says: its stderr's first line, else its message's. */
export const ghWhy = (err) => String(err?.stderr?.trim() || err?.message || err).split('\n')[0];
const notFound = (err) => /\bHTTP 404\b/.test(String(err?.stderr ?? err?.message ?? ''));

/** The default branch, its head commit and that commit's tree. @returns {Promise<{ branch: string, commit: string, tree: string }>} */
export async function readHead(exec, slug) {
  const branch = (await exec(['api', `repos/${slug}`, '--jq', '.default_branch'])).trim();
  if (!branch || branch === 'null') throw new Error(`${slug} names no default branch`);
  const [commit, tree] = (await exec(['api', `repos/${slug}/commits/${branch}`, '--jq', '.sha + " " + .commit.tree.sha'])).trim().split(/\s+/);
  if (!/^[0-9a-f]{40,64}$/.test(commit ?? '') || !/^[0-9a-f]{40,64}$/.test(tree ?? '')) throw new Error(`the head of ${branch} does not read`);
  return { branch, commit, tree };
}

/** The repository's `.omni-loop/config.yml` at `commit`, or null when it has none. */
export async function readConfig(exec, slug, commit) {
  try {
    return await exec(['api', `repos/${slug}/contents/${CONFIG_FILE}?ref=${commit}`, ...RAW]);
  } catch (err) {
    if (notFound(err)) return null;
    throw err;
  }
}

/** One recursive listing of a tree: every entry with its path, type, blob hash and size. */
export async function readTree(exec, slug, tree) {
  const listing = Tree.parse(JSON.parse(await exec(['api', `repos/${slug}/git/trees/${tree}?recursive=1`])));
  return { entries: listing.tree, truncated: Boolean(listing.truncated) };
}

/** A blob's content, by its hash. */
export async function readBlob(exec, slug, sha) {
  return exec(['api', `repos/${slug}/git/blobs/${sha}`, ...RAW]);
}

/** Issue `n`'s title (a fix's dossier is titled after it), or null when there is no such issue. */
export async function readIssueTitle(exec, slug, n) {
  try {
    return (await exec(['api', `repos/${slug}/issues/${Number(n)}`, '--jq', '.title'])).trim() || null;
  } catch (err) {
    if (notFound(err)) return null;
    throw err;
  }
}
