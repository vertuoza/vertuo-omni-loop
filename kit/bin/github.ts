// The one place the CLI talks to GitHub: `gh api`, shelled out, reading and writing an issue's (or a
// pull request's — the same thing to the API) comments by id. Every library function that posts
// takes a client with `listComments` / `createComment` / `updateComment`; this is the production one.
// Ported from vertuo-ai-domain@c4a210122:scripts/outbox-comment.mjs — changes in kit/porting/bin--github.md.
import { execFileSync } from 'node:child_process';
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import type { ExecText } from '../lib/context.ts';
import type { IssueNumber, PrNumber } from '../lib/ids.ts';
import type { CommentClient } from '../lib/outbox/comment.ts';
import type { Env } from './io.ts';
import { GhCommentsSchema, GhPullRequestSchema, GhWrittenCommentSchema } from './schema.ts';

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
 * The `env` every `gh` call runs with: unchanged when `ctx.config.github.user` is null (the ambient
 * `gh` login), else `env` plus `GH_TOKEN` read once from `gh auth token --user <user>`. The token is
 * only ever passed through `env` — never interpolated into an argument or a shell string.
 */
export function githubEnv(ctx: GithubContext, { exec = execFileSync, env = process.env }: { exec?: ExecText; env?: Env | undefined } = {}): Env | undefined {
  const user = ctx.config.github.user;
  if (!user) return undefined;
  const token = exec('gh', ['auth', 'token', '--user', user], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return { ...env, GH_TOKEN: token };
}

/**
 * The comment client for one issue or pull request of `repo` (default `ctx.config.repo.slug`) —
 * what `omni comment` and `omni replies` hand to the library. `issue` is an issue's number or a
 * pull request's: GitHub's issue-comment API takes either.
 */
export function githubClientFor(
  ctx: GithubContext,
  { repo = ctx.config.repo.slug, issue, exec = execFileSync, env = process.env }: { repo?: string | null; issue: IssueNumber | PrNumber; exec?: ExecText; env?: Env },
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

/** One pull request, as the harvest reads it. */
export type PullRequest = {
  number: PrNumber;
  url: string;
  merged: boolean;
  mergedAt: string | null;
  mergedBy: string | null;
  mergeSha: string | null;
  base: string;
  head: string;
};

/**
 * One pull request of `repo` (default `ctx.config.repo.slug`), as the harvest needs it: whether and
 * when it merged, who merged it, into which branch, and its merge commit. Read through `gh api`.
 *
 */
export function pullRequestFor(
  ctx: GithubContext,
  { repo = ctx.config.repo.slug, number, exec = execFileSync, env = process.env }: { repo?: string | null; number: PrNumber; exec?: ExecText; env?: Env },
): PullRequest {
  const ghEnv = githubEnv(ctx, { exec, env });
  const data = GhPullRequestSchema.parse(
    JSON.parse(exec('gh', ['api', `repos/${repo}/pulls/${number}`], { encoding: 'utf8', ...(ghEnv ? { env: ghEnv } : {}) })),
  );
  return {
    number: data.number,
    url: data.html_url,
    merged: Boolean(data.merged_at),
    mergedAt: data.merged_at ?? null,
    mergedBy: data.merged_by?.login ?? null,
    mergeSha: data.merge_commit_sha ?? null,
    base: data.base?.ref ?? '',
    head: data.head?.ref ?? '',
  };
}
