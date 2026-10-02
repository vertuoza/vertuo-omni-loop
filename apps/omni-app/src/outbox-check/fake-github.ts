// A stubbed GitHub for the `outbox-check` tests: one repository whose commits are folders on disk
// (the evaluate fixtures), one pull request, its comments and its check runs. It answers exactly the
// routes the app's units use through `octokit.request(route, params)` and records every request.
// Test support only; nothing in the app imports it.
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
type FakePull = { number: number; base: { ref: string; sha: string }; head: { ref: string; sha: string }; labels?: string[] };

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

/** `commits`: sha → a folder holding that commit's files. */
export function fakeGitHub({
  commits,
  pull,
  comments = [],
  files = [],
}: {
  commits: Record<string, string>;
  pull: FakePull;
  comments?: { id: number; body: string }[];
  files?: { filename: string; status: string }[];
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
            },
          };
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
