// @ts-nocheck
// A fake `gh` for the fallback's tests: answers the four `gh api` reads game/dossiers/github.ts makes
// (the default branch, its head, a file at a commit, the recursive tree, a blob, an issue's title) from a small world of
// repositories, each a map of path → content on its default branch. Every blob is named by the hash
// git gives it, so a test changes a file by changing its content. Nothing reaches GitHub.
//
// world: { 'owner/name': { branch?: 'main', commit: '<hex>', files: { path: content }, issues?: { n: title }, unreadable?: true } }
// A missing file answers as gh does, with `gh: Not Found (HTTP 404)` on stderr. `ghScript()` wraps the
// same fake as an executable `gh`, for a test that runs game:dossiers as a process.
import { createHash } from 'node:crypto';
import { gitBlobSha } from './folders.ts';

const notFound = (path) => Object.assign(new Error(`Command failed: gh api ${path}\ngh: Not Found (HTTP 404)`), { stderr: 'gh: Not Found (HTTP 404)\n' });
const treeOf = (commit) => createHash('sha1').update(`tree of ${commit}`).digest('hex');

export function fakeGitHub(world) {
  const calls = [];
  const exec = async (args) => {
    calls.push(args.join(' '));
    const [verb, path, ...rest] = args;
    const match = verb === 'api' ? /^repos\/([^/]+\/[^/?]+)(\/[^?]*)?(?:\?(.*))?$/.exec(path) : null;
    if (!match) throw new Error(`the fake gh does not know: ${args.join(' ')}`);
    const [, slug, route = '', query = ''] = match;
    const repo = world[slug];
    if (!repo || repo.unreadable) throw notFound(path);
    const branch = repo.branch ?? 'main';
    const blobs = new Map(Object.values(repo.files).map((content) => [gitBlobSha(content), content]));
    const raw = rest.join(' ') === '-H Accept: application/vnd.github.raw';

    if (route === '' && rest.join(' ') === '--jq .default_branch') return `${branch}\n`;
    if (route === `/commits/${branch}` && rest.join(' ') === '--jq .sha + " " + .commit.tree.sha') return `${repo.commit} ${treeOf(repo.commit)}\n`;
    if (route.startsWith('/contents/') && raw) {
      const file = route.slice('/contents/'.length);
      if (query !== `ref=${repo.commit}`) throw new Error(`the fake gh reads files at the head commit only: ${path}`);
      if (!(file in repo.files)) throw notFound(path);
      return repo.files[file];
    }
    if (route === `/git/trees/${treeOf(repo.commit)}` && query === 'recursive=1' && !rest.length) {
      const dirs = new Set(Object.keys(repo.files).flatMap((p) => p.split('/').slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join('/'))));
      const tree = [
        ...[...dirs].map((p) => ({ path: p, mode: '040000', type: 'tree', sha: treeOf(p) })),
        ...Object.entries(repo.files).map(([p, content]) => ({ path: p, mode: '100644', type: 'blob', sha: gitBlobSha(content), size: Buffer.byteLength(content) })),
      ].sort((a, b) => (a.path < b.path ? -1 : 1));
      return JSON.stringify({ sha: treeOf(repo.commit), tree, truncated: Boolean(repo.truncated) });
    }
    if (/^\/issues\/\d+$/.test(route) && rest.join(' ') === '--jq .title') {
      const title = repo.issues?.[route.slice('/issues/'.length)];
      if (title === undefined) throw notFound(path);
      return `${title}\n`;
    }
    if (route.startsWith('/git/blobs/') && raw) {
      const content = blobs.get(route.slice('/git/blobs/'.length));
      if (content === undefined) throw notFound(path);
      return content;
    }
    throw new Error(`the fake gh does not know: ${args.join(' ')}`);
  };
  return { exec, calls };
}

/**
 * The source of a module that runs this fake as `gh` (write it as a `.mjs` file, and put a `gh` on
 * PATH that runs it with node): it reads the world from the JSON file `$FAKE_GH_WORLD`, appends each
 * call to `$FAKE_GH_LOG`, and answers or fails as gh does.
 */
export function ghScript() {
  return `import { appendFileSync, readFileSync } from 'node:fs';
import { fakeGitHub } from ${JSON.stringify(import.meta.url)};
const args = process.argv.slice(2);
appendFileSync(process.env.FAKE_GH_LOG, args.join(' ') + '\\n');
const { exec } = fakeGitHub(JSON.parse(readFileSync(process.env.FAKE_GH_WORLD, 'utf8')));
try {
  process.stdout.write(await exec(args));
} catch (err) {
  process.stderr.write(err.stderr ?? err.message + '\\n');
  process.exit(1);
}
`;
}
