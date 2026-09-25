// A stubbed GitHub for the `outbox-check` tests: one repository whose commits are folders on disk
// (the evaluate fixtures), one pull request, its comments and its check runs. It answers exactly the
// routes the app's units use through `octokit.request(route, params)` and records every request.
// Test support only; nothing in the app imports it.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @param {{
 *   commits: Record<string, string>,       sha → a folder holding that commit's files
 *   pull: { number: number, base: { ref: string, sha: string }, head: { ref: string, sha: string }, labels?: string[] },
 *   comments?: { id: number, body: string }[],
 *   files?: { filename: string, status: string }[],
 * }} state
 */
export function fakeGitHub({ commits, pull, comments = [], files = [] }) {
  const requests = [];
  const checkRuns = [];
  let nextId = 1000;

  const state = { pull: structuredClone(pull), comments: structuredClone(comments), checkRuns, requests };

  function treeAt(sha) {
    const [commit, ...rest] = sha.split(':');
    const root = commits[commit];
    if (!root) throw httpError(404, `no tree ${sha}`);
    return { commit, root, dir: rest.join(':') };
  }

  function entries(commit, root, dir, recursive) {
    const absolute = join(root, dir);
    const out = [];
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
    async request(route, params) {
      requests.push({ route, ...params });
      switch (route) {
        case 'GET /repos/{owner}/{repo}/git/trees/{tree_sha}': {
          const { commit, root, dir } = treeAt(params.tree_sha);
          const all = entries(commit, root, dir, params.recursive === '1');
          const tree = params.recursive === '1' ? all : all.filter((e) => !e.path.includes('/'));
          return { data: { sha: params.tree_sha, tree, truncated: false } };
        }
        case 'GET /repos/{owner}/{repo}/git/blobs/{file_sha}': {
          const { root, dir } = treeAt(params.file_sha);
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
          const comment = { id: nextId++, body: params.body };
          state.comments.push(comment);
          return { data: comment };
        }
        case 'PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}': {
          const comment = state.comments.find((c) => c.id === params.comment_id);
          comment.body = params.body;
          return { data: comment };
        }
        case 'GET /repos/{owner}/{repo}/compare/{basehead}':
          return { data: { files: params.page === 1 ? files : [] } };
        case 'POST /repos/{owner}/{repo}/check-runs': {
          const run = {
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
    },
  };

  return { octokit, state };
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
