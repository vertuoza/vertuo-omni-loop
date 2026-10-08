// A stubbed GitHub for the `outbox-check` tests: one repository whose commits are folders on disk
// (the evaluate fixtures), one pull request, its comments and its check runs, and the open pull
// requests of the other repositories a test names (a plan repository's). It answers exactly the
// routes the app's units use through `octokit.request(route, params)` and records every request.
// Test support only; nothing in the app imports it.
import type { PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';

/** A request's parameters, as a unit hands them to `octokit.request`. */
type Params = Record<string, unknown>;

/** A request this double recorded: its route, and the parameters as the unit handed them. */
type Recorded = { route: string } & Params;

/** An answer, as GitHub would have sent it: a test that reads it narrows it first. */
type Answer = { data: unknown };

/** The pull request this double serves. */
type FakePull = { number: PrNumber; base: { ref: string; sha: string }; head: { ref: string; sha: string }; labels?: string[]; body?: string };

/** An open pull request of another repository, as the pull request list returns it. */
type FakeOtherPull = { number: number; body: string | null };

/**
 * A check run this double created: each field as the unit sent it. The inbox check's tests add the
 * run's `external_id` and its `actions`, which only they serve.
 */
type FakeCheckRun = {
  id: number;
  name: unknown;
  head_sha: unknown;
  status: unknown;
  conclusion: unknown;
  output: unknown;
  external_id?: unknown;
  actions?: unknown;
};

/** What a completed check run's `output` holds, as the tests read it. */
const OutputSchema = z.looseObject({ title: z.string(), summary: z.string() });

/** The check run at `index` (from the end when negative): the test fails when there is none. */
export function checkRunAt(state: { checkRuns: FakeCheckRun[] }, index: number): FakeCheckRun {
  return at(state.checkRuns, index, 'the check run');
}

/** A check run's `output`: the test fails when it holds no title and summary. */
export function outputOf(run: FakeCheckRun): z.infer<typeof OutputSchema> {
  return OutputSchema.parse(run.output);
}

/** One entry of a tree this double lists. */
type FakeEntry = { path: string; mode: string; type: string; sha: string; size?: number };

/**
 * `commits`: sha → a folder holding that commit's files. `others`: `owner/repo` → its open pull
 * requests; any other repository's list answers 404, as GitHub does to a token that cannot read it.
 */
export function fakeGitHub({
  commits,
  pull,
  comments = [],
  files = [],
  others = {},
}: {
  commits: Record<string, string>;
  pull: FakePull;
  comments?: { id: number; body: string }[];
  files?: { filename: string; status: string }[];
  others?: Record<string, FakeOtherPull[]>;
}) {
  const requests: Recorded[] = [];
  const checkRuns: FakeCheckRun[] = [];
  let nextId = 1000;

  const state = { pull: structuredClone(pull), comments: structuredClone(comments), checkRuns, requests };

  function treeAt(sha: string): { commit: string; root: string; dir: string } {
    const [commit = '', ...rest] = sha.split(':');
    const root = commits[commit];
    if (!root) throw httpError(404, `no tree ${sha}`);
    return { commit, root, dir: rest.join(':') };
  }

  function entries(commit: string, root: string, dir: string, recursive: boolean): FakeEntry[] {
    const absolute = join(root, dir);
    const out: FakeEntry[] = [];
    for (const name of readdirSync(absolute).sort()) {
      const path = dir ? `${dir}/${name}` : name;
      const stat = statSync(join(root, path));
      if (stat.isDirectory()) {
        out.push({ path: name, mode: '040000', type: 'tree', sha: `${commit}:${path}` });
        if (recursive) {
          for (const child of entries(commit, root, path, true)) out.push({ ...child, path: `${name}/${child.path}` });
        }
      } else {
        out.push({ path: name, mode: '100644', type: 'blob', sha: `${commit}:${path}`, size: stat.size });
      }
    }
    return out;
  }

  /** Another repository's open pull requests, or GitHub's 404 when the test named none for it. */
  function otherPulls(params: Params): Answer {
    const pulls = others[`${String(params.owner)}/${String(params.repo)}`];
    if (!pulls) throw httpError(404, 'Not Found');
    return { data: pulls };
  }

  const octokit = {
    request: (route: string, params: Params = {}): Promise<Answer> => settled(() => answer(route, params)),
  };

  function answer(route: string, params: Params): Answer {
      requests.push({ route, ...params });
      switch (route) {
        case 'GET /repos/{owner}/{repo}/git/trees/{tree_sha}': {
          const { commit, root, dir } = treeAt(String(params.tree_sha));
          const all = entries(commit, root, dir, params.recursive === '1');
          const tree = params.recursive === '1' ? all : all.filter((e) => !e.path.includes('/'));
          return { data: { sha: params.tree_sha, tree, truncated: false } };
        }
        case 'GET /repos/{owner}/{repo}/git/blobs/{file_sha}': {
          const { root, dir } = treeAt(String(params.file_sha));
          return { data: { content: readFileSync(join(root, dir)).toString('base64'), encoding: 'base64' } };
        }
        case 'GET /repos/{owner}/{repo}/pulls/{pull_number}':
          return {
            data: {
              number: state.pull.number,
              base: state.pull.base,
              head: state.pull.head,
              labels: (state.pull.labels ?? []).map((name) => ({ name })),
              body: state.pull.body,
            },
          };
        case 'GET /repos/{owner}/{repo}/pulls':
          return otherPulls(params);
        case 'GET /repos/{owner}/{repo}/issues/{issue_number}/comments':
          return { data: params.page === 1 ? state.comments : [] };
        case 'POST /repos/{owner}/{repo}/issues/{issue_number}/comments': {
          const comment = { id: nextId++, body: String(params.body) };
          state.comments.push(comment);
          return { data: comment };
        }
        case 'PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}': {
          const comment = state.comments.find((c) => c.id === params.comment_id);
          if (!comment) throw httpError(404, `no comment ${String(params.comment_id)}`);
          comment.body = String(params.body);
          return { data: comment };
        }
        case 'GET /repos/{owner}/{repo}/compare/{basehead}':
          return { data: { files: params.page === 1 ? files : [] } };
        case 'POST /repos/{owner}/{repo}/check-runs': {
          const run: FakeCheckRun = {
            id: nextId++,
            name: params.name,
            head_sha: params.head_sha,
            status: params.status,
            conclusion: params.conclusion ?? null,
            output: params.output ?? null,
          };
          checkRuns.push(run);
          return { data: run };
        }
        case 'PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}': {
          const run = checkRuns.find((r) => r.id === params.check_run_id);
          if (!run) throw httpError(404, `no check run ${String(params.check_run_id)}`);
          Object.assign(run, { status: params.status, conclusion: params.conclusion, output: params.output });
          return { data: run };
        }
        case 'GET /repos/{owner}/{repo}/commits/{ref}/check-runs':
          return {
            data: {
              check_runs: checkRuns.filter((r) => r.head_sha === params.ref && r.name === params.check_name),
            },
          };
        default:
          throw new Error(`fake GitHub: unexpected route ${route}`);
      }
  }

  return { octokit, state };
}

/** `run`'s value as a promise and its throw as a rejection, as an `async` function makes them. */
function settled<T>(run: () => T): Promise<T> {
  return new Promise((resolve) => {
    resolve(run());
  });
}

function httpError(status: number, message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

/** The routes the double answers, as `octokit.request` names them: `overHttp` matches a URL against them. */
const ROUTES: readonly string[] = [
  'GET /repos/{owner}/{repo}/git/trees/{tree_sha}',
  'GET /repos/{owner}/{repo}/git/blobs/{file_sha}',
  'GET /repos/{owner}/{repo}/pulls/{pull_number}',
  'GET /repos/{owner}/{repo}/pulls',
  'GET /repos/{owner}/{repo}/issues/{issue_number}/comments',
  'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
  'PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}',
  'GET /repos/{owner}/{repo}/compare/{basehead}',
  'POST /repos/{owner}/{repo}/check-runs',
  'PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}',
  'GET /repos/{owner}/{repo}/commits/{ref}/check-runs',
];

/** The parameters the double compares as numbers, as a unit hands them; over HTTP they arrive as text. */
const NUMERIC = new Set(['pull_number', 'issue_number', 'comment_id', 'check_run_id', 'page', 'per_page']);

const BodySchema = z.record(z.string(), z.unknown());
const RefusalSchema = z.looseObject({ status: z.number(), message: z.string() });

/** The route `method path` stands for, and the parameters its path carries; null when the double serves none. */
function routeOf(method: string, path: string): { route: string; params: Params } | null {
  const segments = path.split('/');
  for (const route of ROUTES) {
    const [verb = '', template = ''] = route.split(' ');
    const parts = template.split('/');
    if (verb !== method || parts.length !== segments.length) continue;
    const params: Params = {};
    const matches = parts.every((part, i) => {
      const segment = decodeURIComponent(segments[i] ?? '');
      if (!part.startsWith('{')) return part === segment;
      params[part.slice(1, -1)] = segment;
      return true;
    });
    if (matches) return { route, params };
  }
  return null;
}

/** The parameters as a unit hands them: a number where the double compares one. */
const typed = (params: Params): Params =>
  Object.fromEntries(Object.entries(params).map(([key, value]) => [key, NUMERIC.has(key) && typeof value === 'string' ? Number(value) : value]));

/**
 * The double behind HTTP: a `fetch` answering GitHub's REST URLs from `octokit.request`, so a real
 * Octokit calls it as it would call GitHub. Every answer carries `headers` (a rate-limit report, say);
 * a refusal answers its status and message.
 */
export function overHttp(github: ReturnType<typeof fakeGitHub>, headers: Record<string, string> = {}) {
  return async (url: string, init: RequestInit): Promise<Response> => {
    const { pathname, searchParams } = new URL(url);
    const method = (init.method ?? 'GET').toUpperCase();
    const found = routeOf(method, pathname);
    if (!found) throw new Error(`fake GitHub: unexpected ${method} ${pathname}`);
    const body = typeof init.body === 'string' ? BodySchema.parse(JSON.parse(init.body)) : {};
    const params = typed({ ...Object.fromEntries(searchParams), ...body, ...found.params });
    const json = { 'content-type': 'application/json', ...headers };
    try {
      const { data } = await github.octokit.request(found.route, params);
      return new Response(JSON.stringify(data), { status: method === 'POST' ? 201 : 200, headers: json });
    } catch (error) {
      const refused = RefusalSchema.safeParse(error);
      if (!refused.success) throw error;
      return new Response(JSON.stringify({ message: refused.data.message }), { status: refused.data.status, headers: json });
    }
  };
}
