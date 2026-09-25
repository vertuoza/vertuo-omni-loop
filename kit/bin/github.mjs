// The one place the CLI talks to GitHub: `gh api`, shelled out, reading and writing an issue's (or a
// pull request's — the same thing to the API) comments by id. Every library function that posts
// takes a client with `listComments` / `createComment` / `updateComment`; this is the production one.
// Ported from vertuo-ai-domain@c4a210122:scripts/outbox-comment.mjs — changes in kit/porting/bin--github.md.
import { execFileSync } from 'node:child_process';

/**
 * The production comment client. `--input -` feeds the body as JSON on stdin rather than an argv
 * value, so a long, multi-paragraph comment never risks the OS argv length limit or `gh`'s own
 * `-f` value-typing rules. `env`, when given, is passed to every call (it carries `GH_TOKEN`).
 *
 * @param {{ owner: string, repo: string, issue: number, exec?: typeof execFileSync, env?: object }} args
 */
export function ghClient({ owner, repo, issue, exec = execFileSync, env }) {
  const repoSlug = `${owner}/${repo}`;
  const options = (extra = {}) => ({ encoding: 'utf8', ...extra, ...(env ? { env } : {}) });
  return {
    listComments: () =>
      JSON.parse(exec('gh', ['api', `repos/${repoSlug}/issues/${issue}/comments`, '--paginate'], options())),
    createComment: (body) =>
      JSON.parse(
        exec(
          'gh',
          ['api', `repos/${repoSlug}/issues/${issue}/comments`, '--input', '-'],
          options({ input: JSON.stringify({ body }) }),
        ),
      ),
    updateComment: (id, body) =>
      JSON.parse(
        exec(
          'gh',
          ['api', '-X', 'PATCH', `repos/${repoSlug}/issues/comments/${id}`, '--input', '-'],
          options({ input: JSON.stringify({ body }) }),
        ),
      ),
  };
}

/**
 * The `env` every `gh` call runs with: unchanged when `ctx.config.github.user` is null (the ambient
 * `gh` login), else `env` plus `GH_TOKEN` read once from `gh auth token --user <user>`. The token is
 * only ever passed through `env` — never interpolated into an argument or a shell string.
 */
export function githubEnv(ctx, { exec = execFileSync, env = process.env } = {}) {
  const user = ctx.config.github.user;
  if (!user) return undefined;
  const token = String(
    exec('gh', ['auth', 'token', '--user', user], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
  ).trim();
  return { ...env, GH_TOKEN: token };
}

/**
 * The comment client for one issue or pull request of `repo` (default `ctx.config.repo.slug`) —
 * what `omni comment` and `omni replies` hand to the library.
 */
export function githubClientFor(ctx, { repo = ctx.config.repo.slug, issue, exec = execFileSync, env = process.env }) {
  const [owner, name] = String(repo ?? '').split('/');
  let resolved;
  let fetched = false;
  const lazyEnv = () => {
    if (!fetched) {
      resolved = githubEnv(ctx, { exec, env });
      fetched = true;
    }
    return resolved;
  };
  const client = () => ghClient({ owner, repo: name, issue, exec, env: lazyEnv() });
  return {
    listComments: () => client().listComments(),
    createComment: (body) => client().createComment(body),
    updateComment: (id, body) => client().updateComment(id, body),
  };
}
