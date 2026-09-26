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

/**
 * @typedef {{ route: string, params: Record<string, unknown>, data?: unknown, status?: number }} Recorded
 * @param {{
 *   owner?: string,
 *   repo?: string,
 *   recording?: Recorded[],
 *   commits?: Record<string, Record<string, string>>,   sha → { path → text }, a synthetic commit's files
 *   pulls?: object[],                                    synthetic pull requests, in the REST shape
 *   events?: Record<number, object[]>,                   issue number → its issue events
 * }} options
 */
export function replayGitHub({ recording = [], commits = {}, pulls = [], events = {} } = {}) {
  const requests = [];
  const state = {
    requests,
    refs: new Map(),
    trees: new Map(),
    commits: new Map(),
    pulls: structuredClone(pulls),
    comments: [],
    issues: [],
    events: structuredClone(events),
  };
  let nextId = 5000;
  let nextNumber = 900;
  // The synthetic commits handed in, and every tree and commit this double wrote, whole: sha → files.
  const synthetic = { ...commits };

  const octokit = {
    async request(route, params = {}) {
      requests.push({ route, ...params });
      const handler = ROUTES[route];
      if (handler) {
        const answer = await handler(params);
        if (answer !== undefined) return answer;
      }
      return replay(route, params);
    },
  };

  function replay(route, params) {
    const entry = recording.find((candidate) => candidate.route === route && sameParams(candidate.params, params));
    if (!entry) throw httpError(404, `not recorded: ${route} ${JSON.stringify(params)}`);
    if (entry.status && entry.status >= 400) throw httpError(entry.status, `recorded ${entry.status}: ${route}`);
    return { data: structuredClone(entry.data) };
  }

  // ---- synthetic commits: trees and blobs from a map of files ------------------------------------

  function syntheticTree(sha) {
    const [commit, ...rest] = sha.split(':');
    const files = synthetic[commit];
    if (!files) return null;
    return { commit, files, dir: rest.join(':') };
  }

  function treeEntries({ commit, files, dir }, recursive) {
    const prefix = dir ? `${dir}/` : '';
    const seen = new Map();
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
  function fileIn(treeSha, path) {
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
  function commitOf(sha) {
    if (state.commits.has(sha)) return state.commits.get(sha);
    if (commits[sha]) return { sha, tree: { sha }, parents: [], message: 'synthetic' };
    return null;
  }

  function isAncestor(ancestor, sha) {
    const seen = new Set();
    const queue = [sha];
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === ancestor) return true;
      if (seen.has(current) || !state.commits.has(current)) continue;
      seen.add(current);
      queue.push(...state.commits.get(current).parents.map((parent) => parent.sha));
    }
    return false;
  }

  /** A written tree entry's text: its content, the text of the blob it reuses, or `null` when it removes the path. */
  function entryText(entry) {
    if (entry.content !== undefined) return entry.content;
    if (entry.sha === null) return null;
    const blob = syntheticTree(entry.sha);
    const text = blob?.files[blob.dir];
    if (text === undefined) throw httpError(422, `no blob ${entry.sha}`);
    return text;
  }

  /** A copy of every file of a synthetic or written tree (or of a commit's tree), `path → text`. */
  function wholeTree(sha) {
    const commit = state.commits.get(sha);
    return { ...(synthetic[commit ? commit.tree.sha : sha] ?? {}) };
  }

  const ROUTES = {
    'GET /repos/{owner}/{repo}/git/trees/{tree_sha}': ({ tree_sha, recursive }) => {
      const synthetic = syntheticTree(tree_sha);
      if (!synthetic) return undefined;
      return { data: { sha: tree_sha, tree: treeEntries(synthetic, recursive === '1'), truncated: false } };
    },
    'GET /repos/{owner}/{repo}/git/blobs/{file_sha}': ({ file_sha }) => {
      const synthetic = syntheticTree(file_sha);
      if (!synthetic) return undefined;
      const text = synthetic.files[synthetic.dir];
      if (text === undefined) throw httpError(404, `no blob ${file_sha}`);
      return { data: { content: Buffer.from(text).toString('base64'), encoding: 'base64' } };
    },
    'GET /repos/{owner}/{repo}/git/commits/{commit_sha}': ({ commit_sha }) => {
      const commit = commitOf(commit_sha);
      return commit ? { data: structuredClone(commit) } : undefined;
    },
    'GET /repos/{owner}/{repo}/git/ref/{ref}': ({ ref }) => {
      if (!state.refs.has(ref)) throw httpError(404, `no ref ${ref}`);
      return { data: { ref: `refs/${ref}`, object: { sha: state.refs.get(ref), type: 'commit' } } };
    },
    'POST /repos/{owner}/{repo}/git/refs': ({ ref, sha }) => {
      const name = ref.replace(/^refs\//, '');
      if (state.refs.has(name)) throw httpError(422, 'Reference already exists');
      state.refs.set(name, sha);
      return { data: { ref, object: { sha, type: 'commit' } } };
    },
    'PATCH /repos/{owner}/{repo}/git/refs/{ref}': ({ ref, sha, force }) => {
      if (!state.refs.has(ref)) throw httpError(422, 'Reference does not exist');
      if (!force && !isAncestor(state.refs.get(ref), sha)) throw httpError(422, 'Update is not a fast forward');
      state.refs.set(ref, sha);
      return { data: { ref: `refs/${ref}`, object: { sha, type: 'commit' } } };
    },
    'POST /repos/{owner}/{repo}/git/trees': ({ base_tree, tree }) => {
      const entries = Object.fromEntries(tree.map((entry) => [entry.path, entryText(entry)]));
      const sha = `tree-${hash({ base_tree, entries })}`;
      state.trees.set(sha, { sha, base: base_tree ?? null, entries, given: structuredClone(tree) });
      const whole = base_tree ? wholeTree(base_tree) : {};
      for (const [path, text] of Object.entries(entries)) {
        if (text === null) delete whole[path];
        else whole[path] = text;
      }
      synthetic[sha] = whole;
      return { data: { sha } };
    },
    'POST /repos/{owner}/{repo}/git/commits': ({ message, tree, parents }) => {
      const sha = `commit-${nextId++}`;
      const commit = { sha, message, tree: { sha: tree }, parents: parents.map((parent) => ({ sha: parent })) };
      state.commits.set(sha, commit);
      if (synthetic[tree]) synthetic[sha] = synthetic[tree];
      return { data: structuredClone(commit) };
    },
    'GET /repos/{owner}/{repo}/contents/{path}': ({ path, ref }) => {
      const sha = state.refs.get(`heads/${ref}`) ?? ref;
      const commit = commitOf(sha);
      if (!commit) return undefined;
      const text = fileIn(commit.tree.sha, path);
      if (text === null || text === undefined) throw httpError(404, `no ${path} at ${ref}`);
      return { data: { type: 'file', path, encoding: 'base64', content: Buffer.from(text).toString('base64') } };
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
        throw httpError(422, `A pull request already exists for ${head}.`);
      }
      const number = nextNumber++;
      const pull = {
        number,
        title,
        body,
        state: 'open',
        draft: false,
        html_url: `https://github.com/acme/widgets/pull/${number}`,
        head: { ref: head, sha: state.refs.get(`heads/${head}`) },
        base: { ref: base },
        labels: [],
        created_at: '2026-09-25T15:00:00Z',
        merged_at: null,
      };
      state.pulls.push(pull);
      return { data: structuredClone(pull) };
    },
    'PATCH /repos/{owner}/{repo}/pulls/{pull_number}': ({ pull_number, ...fields }) => {
      const pull = state.pulls.find((candidate) => candidate.number === Number(pull_number));
      if (!pull) throw httpError(404, `no pull ${pull_number}`);
      for (const key of ['title', 'body', 'state']) if (key in fields) pull[key] = fields[key];
      return { data: structuredClone(pull) };
    },
    'POST /repos/{owner}/{repo}/issues/{issue_number}/labels': ({ issue_number, labels }) => {
      const target =
        state.pulls.find((pull) => pull.number === Number(issue_number)) ??
        state.issues.find((issue) => issue.number === Number(issue_number));
      if (!target) throw httpError(404, `no issue ${issue_number}`);
      for (const name of labels) if (!target.labels.some((label) => label.name === name)) target.labels.push({ name });
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
      const issue = { number, title, body, state: 'open', html_url: `https://github.com/${owner}/${repo}/issues/${number}`, labels: labels.map((name) => ({ name })) };
      state.issues.push(issue);
      return { data: structuredClone(issue) };
    },
    'PATCH /repos/{owner}/{repo}/issues/{issue_number}': ({ issue_number, ...fields }) => {
      const issue = state.issues.find((candidate) => candidate.number === Number(issue_number));
      if (!issue) throw httpError(404, `no issue ${issue_number}`);
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
      const comment = { id: nextId++, issue: Number(issue_number), body };
      state.comments.push(comment);
      return { data: structuredClone(comment) };
    },
    'PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}': ({ comment_id, body }) => {
      const comment = state.comments.find((candidate) => candidate.id === Number(comment_id));
      if (!comment) throw httpError(404, `no comment ${comment_id}`);
      comment.body = body;
      return { data: structuredClone(comment) };
    },
    'GET /repos/{owner}/{repo}/issues/{issue_number}/events': ({ issue_number, page }) => {
      const events = state.events[Number(issue_number)];
      if (!events) return undefined;
      return { data: Number(page ?? 1) === 1 ? structuredClone(events) : [] };
    },
  };

  /** The files a branch or commit holds as this double wrote them: `path → text`, for the given paths. */
  function filesAt(ref, paths) {
    const sha = state.refs.get(`heads/${ref}`) ?? ref;
    const commit = commitOf(sha);
    return Object.fromEntries(paths.map((path) => [path, commit ? fileIn(commit.tree.sha, path) : null]));
  }

  return { octokit, state, filesAt };
}

/** Wraps an Octokit so that `route` fails with `status` — every time, or the first `times` times. */
export function failing(octokit, route, { status = 502, times = Infinity, message = 'GitHub is down' } = {}) {
  let left = times;
  return {
    async request(r, params) {
      if (r === route && left > 0) {
        left -= 1;
        throw httpError(status, message);
      }
      return octokit.request(r, params);
    },
  };
}

function sameParams(recorded, params) {
  const keys = new Set([...Object.keys(recorded), ...Object.keys(params)]);
  for (const key of keys) {
    if (recorded[key] === undefined || params[key] === undefined) return false;
    if (String(recorded[key]) !== String(params[key])) return false;
  }
  return true;
}

function hash(value) {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 12);
}

export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
