// A stubbed GitHub for the retro's tests (PRD 72): it replays recorded reads — the PRD 50 recording
// under `fixtures/prd-50/`, or entries a test writes — and keeps the retro's writes in memory (refs,
// trees, commits, pull requests, labels, issues and comments), answering later reads from them. It
// answers the routes the retro's units use through `octokit.request(route, params)` and records
// every request. Test support only; nothing in the app imports it.
//
// Reads are answered, in order, from: what this double wrote; the synthetic commits and pull
// requests a test hands in; the recording, matched on the route and every parameter exactly. Anything
// else is a 404 naming the request, so a unit that reads something unrecorded fails loudly.
//
// A tree this double writes may reuse a blob by its sha (a moved file) or remove a path (`sha: null`),
// as GitHub's API allows; each tree and commit it writes can then be read back whole, like a synthetic
// commit, so a later snapshot of a branch it wrote sees its files.
import { createHash } from 'node:crypto';

/** A request's parameters, as a unit hands them to `octokit.request`. */
type Params = Record<string, unknown>;

/** One recorded read: the route, its parameters, and GitHub's answer (or its failing status). */
export type Recorded = { route: string; params: Params; data?: unknown; status?: number };

type Label = { name: string };

/** A pull request in the REST shape, as far as this double reads it. */
type ReplayPull = {
  number: number;
  state?: string;
  html_url?: string;
  head: { ref: string; sha?: string | undefined };
  base: { ref: string };
  labels: Label[];
  [field: string]: unknown;
};

/** An issue this double opened. */
type ReplayIssue = { number: number; state: string; html_url: string; labels: Label[]; [field: string]: unknown };

/** A comment this double posted, on issue or pull request `issue`. */
type ReplayComment = { id: number; issue: number; body: string };

/** A tree this double wrote: its own entries (`null` removes the path) over its base. */
type WrittenTree = { sha: string; base: string | null; entries: Record<string, string | null>; given: unknown };

/** A commit this double wrote. */
type WrittenCommit = { sha: string; message: unknown; tree: { sha: string }; parents: { sha: string }[] };

/** One entry of a tree a unit writes. */
type TreeWriteEntry = { path: string; content?: string; sha?: string | null };

type Answer = { data: unknown } | undefined;

/** A synthetic tree: the commit's files, and the folder of them the tree is. */
type SyntheticTree = { commit: string; files: Record<string, string>; dir: string };

/**
 * `commits`: sha → { path → text }, a synthetic commit's files; `pulls`: synthetic pull requests, in
 * the REST shape; `events`: issue number → its issue events.
 */
export function replayGitHub({
  recording = [],
  commits = {},
  pulls = [],
  events = {},
}: {
  owner?: string;
  repo?: string;
  recording?: readonly Recorded[];
  commits?: Record<string, Record<string, string>>;
  pulls?: readonly object[];
  events?: Record<number, object[]>;
} = {}) {
  const requests: Params[] = [];
  const comments: ReplayComment[] = [];
  const issues: ReplayIssue[] = [];
  const state = {
    requests,
    refs: new Map<string, string>(),
    trees: new Map<string, WrittenTree>(),
    commits: new Map<string, WrittenCommit>(),
    pulls: structuredClone(pulls) as ReplayPull[],
    comments,
    issues,
    events: structuredClone(events),
  };
  let nextId = 5000;
  let nextNumber = 900;
  // The synthetic commits handed in, and every tree and commit this double wrote, whole: sha → files.
  const synthetic: Record<string, Record<string, string>> = { ...commits };

  const octokit = {
    async request(route: string, params: Params = {}): Promise<{ data: unknown }> {
      requests.push({ route, ...params });
      const handler = Object.hasOwn(ROUTES, route) ? ROUTES[route] : undefined;
      if (handler) {
        const answer = await handler(params);
        if (answer !== undefined) return answer;
      }
      return replay(route, params);
    },
  };

  function replay(route: string, params: Params): { data: unknown } {
    const entry = recording.find((candidate) => candidate.route === route && sameParams(candidate.params, params));
    if (!entry) throw httpError(404, `not recorded: ${route} ${JSON.stringify(params)}`);
    if (entry.status && entry.status >= 400) throw httpError(entry.status, `recorded ${entry.status}: ${route}`);
    return { data: structuredClone(entry.data) };
  }

  // ---- synthetic commits: trees and blobs from a map of files ------------------------------------

  function syntheticTree(sha: string): SyntheticTree | null {
    const [commit = '', ...rest] = sha.split(':');
    const files = synthetic[commit];
    if (!files) return null;
    return { commit, files, dir: rest.join(':') };
  }

  function treeEntries({ commit, files, dir }: SyntheticTree, recursive: boolean) {
    const prefix = dir ? `${dir}/` : '';
    const seen = new Map<string, { path: string; mode: string; type: string; sha: string; size?: number }>();
    for (const [path, text] of Object.entries(files)) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      const parts = rest.split('/');
      for (let depth = 1; depth <= parts.length; depth += 1) {
        const relative = parts.slice(0, depth).join('/');
        const isFile = depth === parts.length;
        if (!recursive && depth > 1) break;
        if (seen.has(relative)) continue;
        const full = `${prefix}${relative}`;
        seen.set(
          relative,
          isFile
            ? { path: relative, mode: '100644', type: 'blob', sha: `${commit}:${full}`, size: Buffer.byteLength(text) }
            : { path: relative, mode: '040000', type: 'tree', sha: `${commit}:${full}` },
        );
      }
    }
    return [...seen.values()].sort((a, b) => a.path.localeCompare(b.path));
  }

  // ---- what this double wrote: overlay trees on a base -------------------------------------------

  /** A file's text in a tree this double wrote or a synthetic commit's; `undefined` when unknown. */
  function fileIn(treeSha: string, path: string): string | null | undefined {
    const written = state.trees.get(treeSha);
    if (written) {
      if (path in written.entries) return written.entries[path];
      return written.base ? fileIn(written.base, path) : null;
    }
    const synthetic = syntheticTree(treeSha);
    if (synthetic && synthetic.dir === '') return synthetic.files[path] ?? null;
    return null;
  }

  /** A commit this double wrote, or a synthetic one (its root tree's sha is its own); `null` otherwise. */
  function commitOf(sha: string): WrittenCommit | null {
    const written = state.commits.get(sha);
    if (written) return written;
    if (commits[sha]) return { sha, tree: { sha }, parents: [], message: 'synthetic' };
    return null;
  }

  function isAncestor(ancestor: string | undefined, sha: string): boolean {
    const seen = new Set<string>();
    const queue = [sha];
    while (queue.length > 0) {
      const current = queue.shift() ?? '';
      if (current === ancestor) return true;
      const commit = state.commits.get(current);
      if (seen.has(current) || !commit) continue;
      seen.add(current);
      queue.push(...commit.parents.map((parent) => parent.sha));
    }
    return false;
  }

  /** A written tree entry's text: its content, the text of the blob it reuses, or `null` when it removes the path. */
  function entryText(entry: TreeWriteEntry): string | null {
    if (entry.content !== undefined) return entry.content;
    if (entry.sha === null) return null;
    const blob = syntheticTree(String(entry.sha));
    const text = blob ? blob.files[blob.dir] : undefined;
    if (text === undefined) throw httpError(422, `no blob ${entry.sha}`);
    return text;
  }

  /** A copy of every file of a synthetic or written tree (or of a commit's tree), `path → text`. */
  function wholeTree(sha: string): Record<string, string> {
    const commit = state.commits.get(sha);
    return { ...(synthetic[commit ? commit.tree.sha : sha] ?? {}) };
  }

  const text = (value: unknown): string => String(value);

  const ROUTES: Record<string, (params: Params) => Answer | Promise<Answer>> = {
    'GET /repos/{owner}/{repo}/git/trees/{tree_sha}': ({ tree_sha, recursive }) => {
      const synthetic = syntheticTree(text(tree_sha));
      if (!synthetic) return undefined;
      return { data: { sha: tree_sha, tree: treeEntries(synthetic, recursive === '1'), truncated: false } };
    },
    'GET /repos/{owner}/{repo}/git/blobs/{file_sha}': ({ file_sha }) => {
      const synthetic = syntheticTree(text(file_sha));
      if (!synthetic) return undefined;
      const content = synthetic.files[synthetic.dir];
      if (content === undefined) throw httpError(404, `no blob ${text(file_sha)}`);
      return { data: { content: Buffer.from(content).toString('base64'), encoding: 'base64' } };
    },
    'GET /repos/{owner}/{repo}/git/commits/{commit_sha}': ({ commit_sha }) => {
      const commit = commitOf(text(commit_sha));
      return commit ? { data: structuredClone(commit) } : undefined;
    },
    'GET /repos/{owner}/{repo}/git/ref/{ref}': ({ ref }) => {
      const name = text(ref);
      if (!state.refs.has(name)) throw httpError(404, `no ref ${name}`);
      return { data: { ref: `refs/${name}`, object: { sha: state.refs.get(name), type: 'commit' } } };
    },
    'POST /repos/{owner}/{repo}/git/refs': ({ ref, sha }) => {
      const name = text(ref).replace(/^refs\//, '');
      if (state.refs.has(name)) throw httpError(422, 'Reference already exists');
      state.refs.set(name, text(sha));
      return { data: { ref, object: { sha, type: 'commit' } } };
    },
    'PATCH /repos/{owner}/{repo}/git/refs/{ref}': ({ ref, sha, force }) => {
      const name = text(ref);
      if (!state.refs.has(name)) throw httpError(422, 'Reference does not exist');
      if (!force && !isAncestor(state.refs.get(name), text(sha))) throw httpError(422, 'Update is not a fast forward');
      state.refs.set(name, text(sha));
      return { data: { ref: `refs/${name}`, object: { sha, type: 'commit' } } };
    },
    'POST /repos/{owner}/{repo}/git/trees': ({ base_tree, tree }) => {
      const given = tree as TreeWriteEntry[];
      const base = typeof base_tree === 'string' ? base_tree : null;
      const entries = Object.fromEntries(given.map((entry) => [entry.path, entryText(entry)]));
      const sha = `tree-${hash({ base_tree, entries })}`;
      state.trees.set(sha, { sha, base, entries, given: structuredClone(tree) });
      const whole = base ? wholeTree(base) : {};
      for (const [path, text] of Object.entries(entries)) {
        if (text === null) delete whole[path];
        else whole[path] = text;
      }
      synthetic[sha] = whole;
      return { data: { sha } };
    },
    'POST /repos/{owner}/{repo}/git/commits': ({ message, tree, parents }) => {
      const sha = `commit-${nextId++}`;
      const treeSha = text(tree);
      const parentShas = (parents as string[]).map((parent) => ({ sha: parent }));
      const commit: WrittenCommit = { sha, message, tree: { sha: treeSha }, parents: parentShas };
      state.commits.set(sha, commit);
      const files = synthetic[treeSha];
      if (files) synthetic[sha] = files;
      return { data: structuredClone(commit) };
    },
    'GET /repos/{owner}/{repo}/contents/{path}': ({ path, ref }) => {
      const sha = state.refs.get(`heads/${text(ref)}`) ?? text(ref);
      const commit = commitOf(sha);
      if (!commit) return undefined;
      const content = fileIn(commit.tree.sha, text(path));
      if (content === null || content === undefined) throw httpError(404, `no ${text(path)} at ${text(ref)}`);
      return { data: { type: 'file', path, encoding: 'base64', content: Buffer.from(content).toString('base64') } };
    },
    'GET /repos/{owner}/{repo}/pulls/{pull_number}': ({ pull_number }) => {
      const pull = state.pulls.find((candidate) => candidate.number === Number(pull_number));
      return pull ? { data: structuredClone(pull) } : undefined;
    },
    'GET /repos/{owner}/{repo}/pulls': (params) => {
      const recorded = recording.find(
        (entry) => entry.route === 'GET /repos/{owner}/{repo}/pulls' && sameParams(entry.params, params),
      );
      if (recorded) return undefined;
      const wanted = state.pulls.filter(
        (pull) =>
          (!params.base || pull.base.ref === params.base) &&
          (!params.head || `${params.owner}:${pull.head.ref}` === params.head) &&
          (params.state === 'all' || pull.state === (params.state ?? 'open')),
      );
      return { data: Number(params.page ?? 1) === 1 ? structuredClone(wanted) : [] };
    },
    'POST /repos/{owner}/{repo}/pulls': ({ title, head, base, body }) => {
      if (state.pulls.some((pull) => pull.state === 'open' && pull.head.ref === head && pull.base.ref === base)) {
        throw httpError(422, `A pull request already exists for ${text(head)}.`);
      }
      const number = nextNumber++;
      const pull: ReplayPull = {
        number,
        title,
        body,
        state: 'open',
        draft: false,
        html_url: `https://github.com/acme/widgets/pull/${number}`,
        head: { ref: text(head), sha: state.refs.get(`heads/${text(head)}`) },
        base: { ref: text(base) },
        labels: [],
        created_at: '2026-09-25T15:00:00Z',
        merged_at: null,
      };
      state.pulls.push(pull);
      return { data: structuredClone(pull) };
    },
    'PATCH /repos/{owner}/{repo}/pulls/{pull_number}': ({ pull_number, ...fields }) => {
      const pull = state.pulls.find((candidate) => candidate.number === Number(pull_number));
      if (!pull) throw httpError(404, `no pull ${text(pull_number)}`);
      for (const key of ['title', 'body', 'state']) if (key in fields) pull[key] = fields[key];
      return { data: structuredClone(pull) };
    },
    'POST /repos/{owner}/{repo}/issues/{issue_number}/labels': ({ issue_number, labels }) => {
      const target =
        state.pulls.find((pull) => pull.number === Number(issue_number)) ??
        state.issues.find((issue) => issue.number === Number(issue_number));
      if (!target) throw httpError(404, `no issue ${text(issue_number)}`);
      for (const name of labels as string[]) if (!target.labels.some((label) => label.name === name)) target.labels.push({ name });
      return { data: structuredClone(target.labels) };
    },
    // Issues, listed as GitHub lists them: pull requests among them, marked `pull_request`.
    'GET /repos/{owner}/{repo}/issues': ({ labels, state: wanted = 'open', page }) => {
      const names = labels ? String(labels).split(',') : [];
      const items = [...state.issues, ...state.pulls.map((pull) => ({ ...pull, pull_request: { url: pull.html_url } }))]
        .filter((item) => (wanted === 'all' || item.state === wanted) && names.every((name) => (item.labels ?? []).some((label) => label.name === name)))
        .sort((a, b) => b.number - a.number);
      return { data: Number(page ?? 1) === 1 ? structuredClone(items) : [] };
    },
    'POST /repos/{owner}/{repo}/issues': ({ owner, repo, title, body, labels = [] }) => {
      const number = nextNumber++;
      const names = labels as string[];
      const issue: ReplayIssue = { number, title, body, state: 'open', html_url: `https://github.com/${text(owner)}/${text(repo)}/issues/${number}`, labels: names.map((name) => ({ name })) };
      state.issues.push(issue);
      return { data: structuredClone(issue) };
    },
    'PATCH /repos/{owner}/{repo}/issues/{issue_number}': ({ issue_number, ...fields }) => {
      const issue = state.issues.find((candidate) => candidate.number === Number(issue_number));
      if (!issue) throw httpError(404, `no issue ${text(issue_number)}`);
      for (const key of ['title', 'body', 'state']) if (key in fields) issue[key] = fields[key];
      return { data: structuredClone(issue) };
    },
    'GET /repos/{owner}/{repo}/issues/{issue_number}/comments': ({ issue_number, page }) => ({
      data:
        Number(page ?? 1) === 1
          ? structuredClone(state.comments.filter((comment) => comment.issue === Number(issue_number)))
          : [],
    }),
    'POST /repos/{owner}/{repo}/issues/{issue_number}/comments': ({ issue_number, body }) => {
      const comment: ReplayComment = { id: nextId++, issue: Number(issue_number), body: String(body) };
      state.comments.push(comment);
      return { data: structuredClone(comment) };
    },
    'PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}': ({ comment_id, body }) => {
      const comment = state.comments.find((candidate) => candidate.id === Number(comment_id));
      if (!comment) throw httpError(404, `no comment ${text(comment_id)}`);
      comment.body = String(body);
      return { data: structuredClone(comment) };
    },
    'GET /repos/{owner}/{repo}/issues/{issue_number}/events': ({ issue_number, page }) => {
      const events = state.events[Number(issue_number)];
      if (!events) return undefined;
      return { data: Number(page ?? 1) === 1 ? structuredClone(events) : [] };
    },
  };

  /** The files a branch or commit holds as this double wrote them: `path → text`, for the given paths. */
  function filesAt(ref: string, paths: string[]): Record<string, string | null | undefined> {
    const sha = state.refs.get(`heads/${ref}`) ?? ref;
    const commit = commitOf(sha);
    return Object.fromEntries(paths.map((path) => [path, commit ? fileIn(commit.tree.sha, path) : null]));
  }

  return { octokit, state, filesAt };
}

/** Wraps an Octokit so that `route` fails with `status` — every time, or the first `times` times. */
export function failing(
  octokit: { request: (route: string, params?: Params) => Promise<{ data: unknown }> },
  route: string,
  { status = 502, times = Infinity, message = 'GitHub is down' }: { status?: number; times?: number; message?: string } = {},
) {
  let left = times;
  return {
    async request(r: string, params?: Params): Promise<{ data: unknown }> {
      if (r === route && left > 0) {
        left -= 1;
        throw httpError(status, message);
      }
      return octokit.request(r, params);
    },
  };
}

function sameParams(recorded: Params, params: Params): boolean {
  const keys = new Set([...Object.keys(recorded), ...Object.keys(params)]);
  for (const key of keys) {
    if (recorded[key] === undefined || params[key] === undefined) return false;
    if (String(recorded[key]) !== String(params[key])) return false;
  }
  return true;
}

function hash(value: unknown): string {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 12);
}

export function httpError(status: number, message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}
