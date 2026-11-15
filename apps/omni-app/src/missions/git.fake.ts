// A GitHub over a real git repository (PRD 2896 s5), for the tests of the mission branch's keeping up (./keep-up.ts): the
// REST routes it calls, each answered by git's own plumbing in a bare repository of a temporary folder, so a rebase, a merge
// and a conflict are git's and never a guess of the test. Merges are `git merge-tree --write-tree` (git 2.38 or later), as
// GitHub's are. No network, no GitHub: every call is kept.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GitHubClient } from '../outbox-check/github-schema.ts';

/** A file's text, or null to remove it. */
export type Files = Record<string, string | null>;

/** A pull request of the fake: its base and head branches, open unless closed. */
type Pull = { base: string; head: string; state: 'open' | 'closed' };

const fail = (status: number, message: string): Error => Object.assign(new Error(message), { status });

/** A bare repository with a `main` branch holding `files`, and a GitHub over it. */
export function gitGithub(files: Files = { 'README.md': 'hello\n' }) {
  const dir = mkdtempSync(join(tmpdir(), 'omni-git-fake-'));
  const calls: { route: string; params: Record<string, unknown> }[] = [];
  const pulls = new Map<number, Pull>();
  let at = 1_800_000_000;

  const git = (args: readonly string[], { env = {}, input }: { env?: Record<string, string>; input?: string } = {}): string =>
    execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', env: { ...process.env, ...env }, input, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  /** Whether a git command exits 0. */
  const ok = (args: readonly string[]): boolean => {
    try {
      git(args);
      return true;
    } catch {
      return false;
    }
  };
  const when = (): Record<string, string> => {
    at += 60;
    const date = `${String(at)} +0000`;
    return { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
  };
  const who = (name: string, email: string): Record<string, string> => ({ GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: 'omni-app', GIT_COMMITTER_EMAIL: 'app@example.com' });

  git(['init', '--bare', '--quiet', '--initial-branch=main']);

  /** A tree: `base`'s with `entries` written (a blob's sha, or null to remove the path). */
  function treeOf(base: string | null, entries: readonly { path: string; mode: string; sha: string | null }[]): string {
    const index = join(dir, `index-${String(Math.random()).slice(2)}`);
    const env = { GIT_INDEX_FILE: index };
    try {
      if (base === null) git(['read-tree', '--empty'], { env });
      else git(['read-tree', base], { env });
      for (const { path, mode, sha } of entries) {
        if (sha === null) git(['update-index', '--force-remove', '--', path], { env });
        else git(['update-index', '--add', '--cacheinfo', `${mode},${sha},${path}`], { env });
      }
      return git(['write-tree'], { env });
    } finally {
      rmSync(index, { force: true });
    }
  }

  const blob = (text: string): string => git(['hash-object', '-w', '--stdin'], { input: text });

  /** A commit on `parent` (none for a root) writing `files`, by Ada. */
  function commit(parent: string | null, changes: Files, message: string): string {
    const base = parent === null ? null : git(['rev-parse', `${parent}^{tree}`]);
    const tree = treeOf(base, Object.entries(changes).map(([path, text]) => ({ path, mode: '100644', sha: text === null ? null : blob(text) })));
    return git(['commit-tree', tree, '-m', message, ...(parent === null ? [] : ['-p', parent])], { env: { ...who('Ada', 'ada@example.com'), ...when() } });
  }

  const refOf = (name: string): string | null => {
    try {
      return git(['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]);
    } catch {
      return null;
    }
  };
  const setRef = (name: string, sha: string): void => {
    git(['update-ref', `refs/heads/${name}`, sha]);
  };
  const isAncestor = (a: string, b: string): boolean => ok(['merge-base', '--is-ancestor', a, b]);

  /** The tree `base` and `head` merge to, or null on a conflict: git's three-way merge from their merge base. */
  const mergedTree = (base: string, head: string): string | null => {
    try {
      return git(['merge-tree', '--write-tree', base, head]).split('\n')[0] ?? null;
    } catch {
      return null;
    }
  };

  const commitOf = (sha: string) => {
    const [tree = '', parents = '', message = '', name = '', email = '', date = '', committed = ''] = git(['show', '-s', '--format=%T%x00%P%x00%B%x00%an%x00%ae%x00%aI%x00%cI', sha]).split('\0');
    return {
      sha,
      tree: { sha: tree },
      parents: parents.split(' ').filter((one) => one !== '').map((one) => ({ sha: one })),
      message: message.trimEnd(),
      author: { name, email, date },
      committer: { name: 'omni-app', email: 'app@example.com', date: committed },
    };
  };

  /** What `GET …/compare/{base}...{head}` answers: the merge base, the counts, head's commits oldest first, the files it changed. */
  function compare(basehead: string) {
    const [base = '', head = ''] = basehead.split('...');
    const from = refOf(base) ?? base;
    const to = refOf(head) ?? head;
    const mergeBase = git(['merge-base', from, to]);
    const own = git(['rev-list', '--reverse', `${from}..${to}`]).split('\n').filter((one) => one !== '');
    const behind = git(['rev-list', '--count', `${to}..${from}`]);
    // `:<mode> <mode> <old blob> <new blob> <status>\t<path>`, one line per file.
    const files = git(['diff', '--raw', '--no-renames', '--no-abbrev', mergeBase, to])
      .split('\n')
      .filter((one) => one !== '')
      .map((line) => {
        const [meta = '', filename = ''] = line.split('\t');
        const [, , , sha = '', status = ''] = meta.split(' ');
        const removed = status === 'D';
        return { filename, status: removed ? 'removed' : status === 'A' ? 'added' : 'modified', sha: removed ? null : sha };
      });
    return {
      merge_base_commit: { sha: mergeBase },
      ahead_by: own.length,
      behind_by: Number(behind),
      commits: own.map((sha) => {
        const read = commitOf(sha);
        return { sha, parents: read.parents, commit: { message: read.message, author: read.author, tree: read.tree } };
      }),
      files,
    };
  }

  const routes: Record<string, (params: Record<string, unknown>) => unknown> = {
    'GET /repos/{owner}/{repo}': () => ({ default_branch: 'main', allow_rebase_merge: true }),
    'GET /repos/{owner}/{repo}/git/ref/{ref}': ({ ref }) => {
      const sha = refOf(String(ref).replace(/^heads\//, ''));
      if (sha === null) throw fail(404, 'Not Found');
      return { object: { sha } };
    },
    'POST /repos/{owner}/{repo}/git/refs': ({ ref, sha }) => {
      const name = String(ref).replace(/^refs\/heads\//, '');
      if (refOf(name) !== null) throw fail(422, 'Reference already exists');
      setRef(name, String(sha));
      return { ref };
    },
    'PATCH /repos/{owner}/{repo}/git/refs/{ref}': ({ ref, sha, force }) => {
      const name = String(ref).replace(/^heads\//, '');
      const now = refOf(name);
      if (now === null) throw fail(422, 'Reference does not exist');
      if (force !== true && !isAncestor(now, String(sha))) throw fail(422, 'Update is not a fast forward');
      setRef(name, String(sha));
      return { object: { sha } };
    },
    'DELETE /repos/{owner}/{repo}/git/refs/{ref}': ({ ref }) => {
      const name = String(ref).replace(/^heads\//, '');
      if (refOf(name) === null) throw fail(422, 'Reference does not exist');
      git(['update-ref', '-d', `refs/heads/${name}`]);
      return {};
    },
    'GET /repos/{owner}/{repo}/compare/{basehead}': ({ basehead }) => compare(String(basehead)),
    'GET /repos/{owner}/{repo}/git/commits/{commit_sha}': ({ commit_sha }) => commitOf(String(commit_sha)),
    'POST /repos/{owner}/{repo}/git/trees': ({ base_tree, tree }) => ({
      sha: treeOf(typeof base_tree === 'string' ? base_tree : null, (tree as { path: string; mode: string; sha: string | null }[]).map(({ path, mode, sha }) => ({ path, mode, sha }))),
    }),
    'POST /repos/{owner}/{repo}/git/commits': ({ message, tree, parents, author }) => {
      const by = (author ?? { name: 'omni-app', email: 'app@example.com' }) as { name: string; email: string };
      const sha = git(['commit-tree', String(tree), '-m', String(message), ...(parents as string[]).flatMap((one) => ['-p', one])], { env: { ...who(by.name, by.email), ...when() } });
      return { sha };
    },
    'POST /repos/{owner}/{repo}/merges': ({ base, head, commit_message }) => {
      const into = refOf(String(base));
      if (into === null) throw fail(404, 'Base does not exist');
      const from = refOf(String(head)) ?? String(head);
      if (isAncestor(from, into)) return null;
      const tree = mergedTree(into, from);
      if (tree === null) throw fail(409, 'Merge conflict');
      const sha = git(['commit-tree', tree, '-m', typeof commit_message === 'string' ? commit_message : 'Merge', '-p', into, '-p', from], { env: { ...who('omni-app', 'app@example.com'), ...when() } });
      setRef(String(base), sha);
      return { sha, commit: { tree: { sha: tree } } };
    },
    'GET /repos/{owner}/{repo}/pulls/{pull_number}': ({ pull_number }) => {
      const pull = pulls.get(Number(pull_number));
      if (pull === undefined) throw fail(404, 'Not Found');
      return { html_url: `https://github.com/acme/widgets/pull/${String(pull_number)}`, state: pull.state, base: { ref: pull.base }, head: { ref: pull.head, sha: refOf(pull.head) } };
    },
    'PUT /repos/{owner}/{repo}/pulls/{pull_number}/update-branch': ({ pull_number, expected_head_sha }) => {
      const pull = pulls.get(Number(pull_number));
      if (pull === undefined) throw fail(404, 'Not Found');
      const head = refOf(pull.head) ?? '';
      const base = refOf(pull.base) ?? '';
      if (expected_head_sha !== undefined && expected_head_sha !== head) throw fail(422, 'expected head sha didn’t match current head ref.');
      const tree = mergedTree(head, base);
      if (tree === null) throw fail(422, 'merge conflict between base and head');
      setRef(pull.head, git(['commit-tree', tree, '-m', `Merge branch '${pull.base}' into ${pull.head}`, '-p', head, '-p', base], { env: { ...who('omni-app', 'app@example.com'), ...when() } }));
      return { message: 'Updating pull request branch.' };
    },
  };

  const octokit: GitHubClient = {
    request: (route, params = {}) => {
      calls.push({ route, params });
      const answer = routes[route];
      if (answer === undefined) return Promise.reject(new Error(`unexpected ${route}`));
      try {
        return Promise.resolve({ data: answer(params) });
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    },
  };

  setRef('main', commit(null, files, 'chore: start'));

  return {
    octokit,
    calls,
    /** A commit on branch `name` writing `files`, the branch moved to it (cut from `from`'s head when it is new). */
    push(name: string, changes: Files, message: string, from = 'main'): string {
      const sha = commit(refOf(name) ?? refOf(from) ?? from, changes, message);
      setRef(name, sha);
      return sha;
    },
    /** Branch `name`, cut at `from`'s head. */
    branch(name: string, from: string): void {
      setRef(name, refOf(from) ?? from);
    },
    /** The branch's head; null when there is none. */
    head: refOf,
    /** A file's text at `ref`; null when it has none. */
    read(ref: string, path: string): string | null {
      try {
        return `${git(['show', `${refOf(ref) ?? ref}:${path}`])}\n`;
      } catch {
        return null;
      }
    },
    /** The subjects of `ref`'s commits since `since`, oldest first. */
    subjects(ref: string, since = 'main'): string[] {
      return git(['log', '--reverse', '--format=%s', `${refOf(since) ?? since}..${refOf(ref) ?? ref}`]).split('\n').filter((one) => one !== '');
    },
    /** The parents of each commit of `ref` since `since`. */
    parentCounts(ref: string, since: string): number[] {
      return git(['log', '--reverse', '--format=%P', `${refOf(since) ?? since}..${refOf(ref) ?? ref}`]).split('\n').filter((one) => one !== '').map((one) => one.split(' ').length);
    },
    isAncestor: (a: string, b: string) => isAncestor(refOf(a) ?? a, refOf(b) ?? b),
    branches: (): string[] => git(['for-each-ref', '--format=%(refname:short)', 'refs/heads']).split('\n').filter((one) => one !== ''),
    /** Pull request `n`, from branch `head` into `base`. */
    pull(n: number, base: string, head: string, state: 'open' | 'closed' = 'open'): void {
      pulls.set(n, { base, head, state });
    },
    /** The squash of branch `head` onto `base`, as GitHub's squash merge writes one: `title`, the merged tree, one parent. */
    squash(base: string, head: string, title: string): string {
      const into = refOf(base) ?? '';
      const tree = mergedTree(into, refOf(head) ?? '');
      if (tree === null) throw new Error(`${head} conflicts with ${base}`);
      const sha = git(['commit-tree', tree, '-m', title, '-p', into], { env: { ...who('Ada', 'ada@example.com'), ...when() } });
      setRef(base, sha);
      return sha;
    },
    done(): void {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
