import { z } from 'zod';
import { IssueNumberSchema, PrNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { authenticate, withInstallLink, type TokenCheck } from '../ask/auth';
import { refuse, reply } from '../business-api/reply';
import {
  ChangeDetailSchema, ChangesQuerySchema, ChangesSchema, CommentsQuerySchema, CommentsSchema, IssueDetailSchema, IssuesQuerySchema,
  IssuesSchema, RepoSchema,
} from './loop.contract';
import { HostSpent, HostUnreadable, type LoopRead, type LoopService } from './loop.service';

// The loop's read routes for the kit (PRD 1665, s1 and s2; ADR-0095), as plain functions of a Request,
// so they are tested with a fake service and each route stays one line:
//
//   GET /api/loop/changes?repo=<owner/name>&base|head|label&state=all|open  → 200 {changes: [Change]}
//   GET /api/loop/changes/<n>?repo=<owner/name>                            → 200 ChangeDetail
//   GET /api/loop/comments?repo=<owner/name>&on=<n>                        → 200 {comments: [Comment]}
//   GET /api/loop/issues?repo=<owner/name>&label&state=all|open|closed     → 200 {issues: [Issue]}
//   GET /api/loop/issues/<n>?repo=<owner/name>                             → 200 IssueDetail
//
// The kit calls them with the terminal's sign-in (a bearer token, `omni signin` or a traded
// OMNI_TOKEN). The sign-in is checked first: signed out, 401, and nothing else runs. The service then
// checks the repository is the caller's workspace's before it asks the host anything. Each answer is
// checked against the contract before it leaves; each refusal is `{error}` in plain words (ADR-0029,
// ./loop.contract.ts). The host's token is never in an answer, and a failure is logged by its message
// only, which never carries it (./github.ts).

export type LoopReadsDeps = {
  /** A client acting as the given access token, for the sign-in's check; null when no database is configured. */
  connect: ((token: string) => TokenCheck) | null;
  /** The reads; null when this deployment has no app to read a repository with. */
  service: LoopService | null;
  /** The App's install link, put after a 424's words and a refusal's install hint; null: none. */
  installLink: string | null;
  log: (line: string) => void;
};

const NO_DATABASE = 'The loop cannot be read here: this deployment has no database.';
const NO_APP = 'The loop cannot be read here: this deployment has no app to read a repository with.';
const BAD_QUERY = 'Name the repository as `repo=owner/name`, and filter by `base`, `head` or `label`, with `state=all` or `state=open`.';
const BAD_NUMBER = 'Name the change by its number: /api/loop/changes/<n>?repo=owner/name.';
const BAD_COMMENTS = 'Name the repository as `repo=owner/name`, and the issue or change as `on=<n>`.';
const BAD_ISSUES = 'Name the repository as `repo=owner/name`, and filter by `label`, with `state=all`, `state=open` or `state=closed`.';
const BAD_ISSUE = 'Name the issue by its number: /api/loop/issues/<n>?repo=owner/name.';
const NOT_READ = 'The loop could not be read. Try again.';

const NumberSchema = z.string().regex(/^[1-9]\d{0,9}$/).transform(Number);

/** The query's parameters, each named once; null when one is repeated or unknown, or a value is malformed. */
function queryOf<T>(params: URLSearchParams, schema: z.ZodType<T>): T | null {
  const seen = [...params.keys()];
  if (new Set(seen).size !== seen.length) return null;
  const parsed = schema.safeParse(Object.fromEntries(params));
  return parsed.success ? parsed.data : null;
}

/** The one repository a single read's query names, and nothing else; null otherwise. */
function repoOf(params: URLSearchParams): string | null {
  const repo = RepoSchema.safeParse(params.get('repo'));
  return repo.success && params.getAll('repo').length === 1 && [...params.keys()].length === 1 ? repo.data : null;
}

/** A refusal for the host's errors; anything else is logged and answered 500. */
function hostRefusal(error: unknown, repo: string, deps: LoopReadsDeps): Response {
  if (error instanceof HostUnreadable) {
    deps.log(`loop: ${error.message}`);
    return refuse(424, `The Omni app cannot read ${repo}${deps.installLink ? `: ${deps.installLink}` : '.'}`);
  }
  if (error instanceof HostSpent) {
    const response = refuse(429, `${error.host}'s budget for ${repo} is spent until ${new Date(error.until).toISOString()}.`);
    response.headers.set('retry-after', String(Math.max(1, Math.ceil((error.until - Date.now()) / 1000))));
    return response;
  }
  deps.log(`loop: ${error instanceof Error ? error.message : String(error)}`);
  return refuse(500, NOT_READ);
}

/** The service's answer: the reply in the contract's shape, or why not. */
function answerOf<T>(read: LoopRead<T>, repo: string, schema: z.ZodType<T>, deps: LoopReadsDeps, missing: string): Response {
  if (read.kind === 'outside') return refuse(403, `${repo} is not in your workspace: ${withInstallLink(read.reason, deps.installLink)}`);
  if (read.kind === 'missing') return refuse(404, missing);
  return reply(200, schema.parse(read.reply));
}

/** The caller, checked first; a Response when refused. */
async function callerOf(request: Request, deps: LoopReadsDeps) {
  if (!deps.connect) return refuse(503, NO_DATABASE);
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  return auth.ok ? auth.caller : refuse(auth.status, auth.error);
}

/** What one read answers, once its caller and query are known. */
type Served<T> = { repo: string; read: (service: LoopService) => Promise<LoopRead<T>>; schema: z.ZodType<T>; missing: string };

/** A read the service answers, in the contract's shape; the host's errors as their refusals. */
async function serve<T>({ repo, read, schema, missing }: Served<T>, deps: LoopReadsDeps): Promise<Response> {
  if (!deps.service) return refuse(503, NO_APP);
  try {
    return answerOf(await read(deps.service), repo, schema, deps, missing);
  } catch (error) {
    return hostRefusal(error, repo, deps);
  }
}

/** A list's read: the caller, then its query, then the service. */
async function serveList<Q extends { repo: string }, T>(request: Request, deps: LoopReadsDeps, query: { schema: z.ZodType<Q>; bad: string }, served: (caller: string, query: Q) => Omit<Served<T>, 'repo'>): Promise<Response> {
  const caller = await callerOf(request, deps);
  if (caller instanceof Response) return caller;
  const parsed = queryOf(new URL(request.url).searchParams, query.schema);
  if (!parsed) return refuse(400, query.bad);
  return serve({ repo: parsed.repo, ...served(caller.id, parsed) }, deps);
}

/** One numbered thing's read: the caller, then its number and its repository, then the service. */
async function serveOne<N, T>(request: Request, number: string, deps: LoopReadsDeps, numbered: { schema: z.ZodType<N, string>; bad: string }, served: (caller: string, repo: string, n: N) => Omit<Served<T>, 'repo'>): Promise<Response> {
  const caller = await callerOf(request, deps);
  if (caller instanceof Response) return caller;
  const parsedNumber = numbered.schema.safeParse(number);
  if (!parsedNumber.success) return refuse(400, numbered.bad);
  const repo = repoOf(new URL(request.url).searchParams);
  if (repo === null) return refuse(400, BAD_QUERY);
  return serve({ repo, ...served(caller.id, repo, parsedNumber.data) }, deps);
}

/** GET /api/loop/changes: a repository's changes, filtered. */
export function readChanges(request: Request, deps: LoopReadsDeps): Promise<Response> {
  return serveList(request, deps, { schema: ChangesQuerySchema, bad: BAD_QUERY }, (caller, query) => ({
    read: (service) => service.changes(caller, query), schema: ChangesSchema, missing: NOT_READ,
  }));
}

/** GET /api/loop/changes/<n>: one change of a repository, with its review. */
export function readChange(request: Request, number: string, deps: LoopReadsDeps): Promise<Response> {
  return serveOne(request, number, deps, { schema: NumberSchema.pipe(PrNumberSchema), bad: BAD_NUMBER }, (caller, repo, n) => ({
    read: (service) => service.change(caller, repo, n), schema: ChangeDetailSchema, missing: `No change ${n} in ${repo}.`,
  }));
}

/** GET /api/loop/comments: the conversation of one issue or change. */
export function readComments(request: Request, deps: LoopReadsDeps): Promise<Response> {
  return serveList(request, deps, { schema: CommentsQuerySchema, bad: BAD_COMMENTS }, (caller, query) => ({
    read: (service) => service.comments(caller, query), schema: CommentsSchema, missing: `No issue or change ${query.on} in ${query.repo}.`,
  }));
}

/** GET /api/loop/issues: a repository's issues, filtered. */
export function readIssues(request: Request, deps: LoopReadsDeps): Promise<Response> {
  return serveList(request, deps, { schema: IssuesQuerySchema, bad: BAD_ISSUES }, (caller, query) => ({
    read: (service) => service.issues(caller, query), schema: IssuesSchema, missing: NOT_READ,
  }));
}

/** GET /api/loop/issues/<n>: one issue of a repository, with its comments and what closes it. */
export function readIssue(request: Request, number: string, deps: LoopReadsDeps): Promise<Response> {
  return serveOne(request, number, deps, { schema: NumberSchema.pipe(IssueNumberSchema), bad: BAD_ISSUE }, (caller, repo, n) => ({
    read: (service) => service.issue(caller, repo, n), schema: IssueDetailSchema, missing: `No issue ${n} in ${repo}.`,
  }));
}
