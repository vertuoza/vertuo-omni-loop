// The one place the CLI writes to GitHub: `gh api`, shelled out, writing an issue's (or a pull
// request's — the same thing to the API) comments by id, after reading them to find its own. Every
// library function that posts takes a client with `listComments` / `createComment` / `updateComment`;
// this is the production one. PRD 1665, s6: the read helpers left — the loop reads through `LoopReads`
// (the Omni page), and the harvest, which still reads through `gh`, holds its own.
// Ported from nimbus-brain@c4a210122:scripts/outbox-comment.mjs — changes in kit/porting/bin--github.md.
import { execFileSync } from 'node:child_process';
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { homedir } from 'node:os';
import type { ExecText } from '../lib/context.ts';
import { githubAppOf, processEnv, runnerJobOf, withGithubToken } from '../lib/env/read.ts';
import type { IssueNumber, PrNumber } from '../lib/ids.ts';
import type { CommentClient } from '../lib/outbox/comment.ts';
import { jobGithubToken } from '../lib/runner/github-token.ts';
import type { Env } from './io.ts';
import { GhCommentsSchema, GhWrittenCommentSchema } from './schema.ts';

/** What the GitHub helpers read of the context: the `gh` user and the repository's slug. */
type GithubContext = { config: { github: { user: string | null }; repo: { slug: string | null } } };

/**
 * The production comment client. `--input -` feeds the body as JSON on stdin rather than an argv
 * value, so a long, multi-paragraph comment never risks the OS argv length limit or `gh`'s own
 * `-f` value-typing rules. `env`, when given, is passed to every call (it carries `GH_TOKEN`).
 *
 */
export function ghClient({
  owner,
  repo,
  issue,
  exec = execFileSync,
  env,
}: {
  owner: string | undefined;
  repo: string | undefined;
  /** An issue, or a pull request: GitHub's issue-comment API takes either. */
  issue: IssueNumber | PrNumber;
  exec?: ExecText;
  env?: Env | undefined;
}): CommentClient {
  const repoSlug = `${owner}/${repo}`;
  const options = (extra: { input?: string } = {}): ExecFileSyncOptionsWithStringEncoding => ({
    encoding: 'utf8',
    ...extra,
    ...(env ? { env } : {}),
  });
  return {
    listComments: () =>
      GhCommentsSchema.parse(JSON.parse(exec('gh', ['api', `repos/${repoSlug}/issues/${issue}/comments`, '--paginate'], options()))),
    createComment: (body) =>
      GhWrittenCommentSchema.parse(JSON.parse(
        exec(
          'gh',
          ['api', `repos/${repoSlug}/issues/${issue}/comments`, '--input', '-'],
          options({ input: JSON.stringify({ body }) }),
        ),
      )),
    updateComment: (id, body) =>
      GhWrittenCommentSchema.parse(JSON.parse(
        exec(
          'gh',
          ['api', '-X', 'PATCH', `repos/${repoSlug}/issues/comments/${id}`, '--input', '-'],
          options({ input: JSON.stringify({ body }) }),
        ),
      )),
  };
}

/**
 * The token of the GitHub App `app` a job runs as (PRD 2433): `githubToken`'s when a test hands one in, else
 * the one the job's runner keeps, read through the same call as `omni runner github-token`. It refuses, rather
 * than let a call run as another login, in words that hold no token.
 */
function appToken(app: string, env: Env, { githubToken, home }: { githubToken: ((env: Env) => string | null) | undefined; home: string }): string {
  const handed = githubToken?.(env) ?? null;
  if (handed !== null) return handed;
  const read = githubToken === undefined ? jobGithubToken(runnerJobOf(env), home) : { refusal: 'no token is kept for it.' };
  if ('token' in read) return read.token;
  throw new Error(`omni: this job runs as the GitHub App ${app}, but its token cannot be read: ${read.refusal} It never runs as another login.`);
}

/**
 * The `env` every `gh` call runs with: unchanged when `ctx.config.github.user` is null (the ambient
 * `gh` login), else `env` plus `GH_TOKEN` read once from `gh auth token --user <user>`. The token is
 * only ever passed through `env` — never interpolated into an argument or a shell string.
 *
 * Under `OMNI_GITHUB_APP` (PRD 2433) the job runs as an app, whatever `github.user` says: `GH_TOKEN` is the
 * job's token, and `gh auth token`, which would hand over a person's own login, never runs.
 */
export function githubEnv(
  ctx: GithubContext,
  { exec = execFileSync, env = processEnv(), githubToken, home = homedir() }: { exec?: ExecText; env?: Env | undefined; githubToken?: ((env: Env) => string | null) | undefined; home?: string } = {},
): Env | undefined {
  const app = githubAppOf(env);
  if (app !== null) return withGithubToken(env, appToken(app, env, { githubToken, home }));
  const user = ctx.config.github.user;
  if (!user) return undefined;
  const token = exec('gh', ['auth', 'token', '--user', user], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return withGithubToken(env, token);
}

/**
 * The comment client for one issue or pull request of `repo` (default `ctx.config.repo.slug`) —
 * what `omni comment` and `omni replies` hand to the library. `issue` is an issue's number or a
 * pull request's: GitHub's issue-comment API takes either.
 */
export function githubClientFor(
  ctx: GithubContext,
  { repo = ctx.config.repo.slug, issue, exec = execFileSync, env = processEnv() }: { repo?: string | null; issue: IssueNumber | PrNumber; exec?: ExecText; env?: Env },
): CommentClient {
  const [owner, name] = (repo ?? '').split('/');
  let resolved: Env | undefined;
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
