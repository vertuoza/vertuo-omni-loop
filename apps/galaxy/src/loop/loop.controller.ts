import { z } from 'zod';
import { PrNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { authenticate, withInstallLink, type TokenCheck } from '../ask/auth';
import { refuse, reply } from '../business-api/reply';
import { ChangeDetailSchema, ChangesQuerySchema, ChangesSchema, RepoSchema } from './loop.contract';
import { HostSpent, HostUnreadable, type LoopRead, type LoopService } from './loop.service';

// The loop's read routes for the kit (PRD 1665, s1; ADR-0095), as plain functions of a Request, so they
// are tested with a fake service and each route stays one line:
//
//   GET /api/loop/changes?repo=<owner/name>&base|head|label&state=all|open  → 200 {changes: [Change]}
//   GET /api/loop/changes/<n>?repo=<owner/name>                            → 200 ChangeDetail
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
const NOT_READ = 'The loop could not be read. Try again.';

const NumberSchema = z.string().regex(/^[1-9]\d{0,9}$/).transform(Number).pipe(PrNumberSchema);

/** The query's parameters, each named once; null when one is repeated or unknown, or a value is malformed. */
function listQueryOf(params: URLSearchParams) {
  const seen = [...params.keys()];
  if (new Set(seen).size !== seen.length) return null;
  const parsed = ChangesQuerySchema.safeParse(Object.fromEntries(params));
  return parsed.success ? parsed.data : null;
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

/** GET /api/loop/changes: a repository's changes, filtered. */
export async function readChanges(request: Request, deps: LoopReadsDeps): Promise<Response> {
  const caller = await callerOf(request, deps);
  if (caller instanceof Response) return caller;
  const query = listQueryOf(new URL(request.url).searchParams);
  if (!query) return refuse(400, BAD_QUERY);
  if (!deps.service) return refuse(503, NO_APP);
  try {
    return answerOf(await deps.service.changes(caller.id, query), query.repo, ChangesSchema, deps, NOT_READ);
  } catch (error) {
    return hostRefusal(error, query.repo, deps);
  }
}

/** GET /api/loop/changes/<n>: one change of a repository. */
export async function readChange(request: Request, number: string, deps: LoopReadsDeps): Promise<Response> {
  const caller = await callerOf(request, deps);
  if (caller instanceof Response) return caller;
  const parsedNumber = NumberSchema.safeParse(number);
  if (!parsedNumber.success) return refuse(400, BAD_NUMBER);
  const params = new URL(request.url).searchParams;
  const repo = RepoSchema.safeParse(params.get('repo'));
  if (!repo.success || params.getAll('repo').length !== 1 || [...params.keys()].length !== 1) return refuse(400, BAD_QUERY);
  if (!deps.service) return refuse(503, NO_APP);
  try {
    const read = await deps.service.change(caller.id, repo.data, parsedNumber.data);
    return answerOf(read, repo.data, ChangeDetailSchema, deps, `No change ${parsedNumber.data} in ${repo.data}.`);
  } catch (error) {
    return hostRefusal(error, repo.data, deps);
  }
}
