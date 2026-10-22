import { z } from 'zod';
import { reply } from '../business-api/reply';
import {
  BugFixListSchema, DESCRIPTION_MAX, JobLineListSchema, JobSchema, ListQuerySchema, LIMIT_MAX, MEGA_DESCRIPTION_MAX, PrdListSchema, PUBLIC_API_ERRORS,
  StartBugFixSchema, StartMegaBugFixSchema, type JobLineList, type ListQuery, type PublicApiErrorCode,
} from './public-api.contract';
import type { ApiKeyCaller, PublicApiService, Answered } from './public-api.service';

// The public API's routes (PRD 2022 s2, spec "The routes"; ADR-0095), as plain functions of a Request, so
// they are tested with the real service on rows in memory and each route stays one line:
//
//   GET /api/v1/prds?limit=&cursor=        200 {data, next_cursor}: the key's PRDs, newest first
//   GET /api/v1/bug-fixes?limit=&cursor=   200 {data, next_cursor}: the key's bug fixes, newest first
//   POST /api/v1/bug-fixes                 202 job: queues /omni:bug-fix on the runners (PRD 2022 s4)
//   POST /api/v1/mega-bug-fixes            202 job: queues /omni:mega-bug-fix in a plan repository; never 404,
//                                          so a 404 there is a deployment older than the route
//   GET /api/v1/jobs/{id}                  200 job: a job a key of the workspace queued, else 404
//   GET /api/v1/jobs/{id}/lines?limit=&cursor=  200 {data, next_cursor}: that job's lines, oldest first (PRD 2425 s4)
//
// The key is checked first: no `Authorization: Bearer oma_…`, or a key api_key_of() does not answer live
// (unknown, revoked, its maker gone), is 401, and nothing else runs. The query is read next: a bad `limit`
// or `cursor` is 422 naming it. Each answer is checked against the contract before it leaves, never
// cached; each refusal is `{error: {code, message}}` (./public-api.contract.ts). A failure is 500, logged,
// its message never carrying a stack or the database's words.

export type PublicApiDeps = {
  /** The rules over the service role, or null when this deployment has no database to read. */
  service: PublicApiService | null;
  log: (line: string) => void;
};

export const NO_KEY = 'Send your API key as `Authorization: Bearer oma_…`.';
export const DEAD_KEY = 'This API key is unknown, revoked, or its maker left the workspace.';
export const NO_DATABASE = 'The API is not available on this deployment.';
export const FAILED = 'The API could not answer. Try again.';
const QUERY_RULES: Readonly<Record<keyof ListQuery, string>> = {
  limit: `limit: a whole number from 1 to ${LIMIT_MAX}.`,
  cursor: 'cursor: the `next_cursor` the last page answered, unchanged.',
};

const BAD_BODY = `The body must be {"repo": "owner/name", "description": "<1 to ${String(DESCRIPTION_MAX)} characters>", "runner"?: "<name>", "fleet"?: "<fleet>"}.`;
const BAD_MEGA_BODY = `The body must be {"repo": "<a plan repository, owner/name>", "description": "<its issue's URL, or the bug, 1 to ${String(MEGA_DESCRIPTION_MAX)} characters, no --flag>", "runner"?: "<name>", "fleet"?: "<fleet>"}, and nothing else.`;
const NO_SUCH_JOB = 'No such job.';
const MAX_BODY_CHARS = 4 * 1024;

const BEARER = /^Bearer[ \t]+(\S+)[ \t]*$/i;

/** A refusal in the one shape. */
const refusal = (code: PublicApiErrorCode, message: string): Response =>
  reply(PUBLIC_API_ERRORS[code], { error: { code, message } });

/** The live key the request came with, or the 401 that refuses it. */
async function keyOf(request: Request, service: PublicApiService): Promise<ApiKeyCaller | Response> {
  const secret = BEARER.exec(request.headers.get('authorization') ?? '')?.[1];
  if (secret === undefined) return refusal('unauthorized', NO_KEY);
  return (await service.keyFor(secret)) ?? refusal('unauthorized', DEAD_KEY);
}

/** The query a list was asked with, or the refusal naming the parameter it refuses. */
function queryOf(url: URL): ListQuery | Response {
  const asked: Record<string, string> = {};
  for (const name of ['limit', 'cursor'] as const) {
    const value = url.searchParams.get(name);
    if (value !== null) asked[name] = value;
  }
  const read = ListQuerySchema.safeParse(asked);
  if (read.success) return read.data;
  const field = read.error.issues[0]?.path[0];
  return refusal('invalid_request', field === 'cursor' ? QUERY_RULES.cursor : QUERY_RULES.limit);
}

/** Runs `answer` for a live key: no database is a 500, a dead key a 401, a failure a logged 500 that never carries its words. */
async function asKey(
  request: Request, deps: PublicApiDeps, answer: (service: PublicApiService, key: ApiKeyCaller) => Promise<Response>,
): Promise<Response> {
  if (!deps.service) return refusal('internal', NO_DATABASE);
  const service = deps.service;
  try {
    const key = await keyOf(request, service);
    return key instanceof Response ? key : await answer(service, key);
  } catch (error) {
    deps.log(`public-api: ${error instanceof Error ? error.message : String(error)}`);
    return refusal('internal', FAILED);
  }
}

/** Answers a list: the key, then the query, then `serve`'s page in `shape`. */
function list<T>(
  request: Request, deps: PublicApiDeps, shape: z.ZodType,
  serve: (service: PublicApiService, key: ApiKeyCaller, query: ListQuery, origin: string) => Promise<Answered<T>>,
): Promise<Response> {
  return asKey(request, deps, async (service, key) => {
    const url = new URL(request.url);
    const query = queryOf(url);
    if (query instanceof Response) return query;
    const served = await serve(service, key, query, url.origin);
    return served.ok ? reply(200, shape.parse(served.value)) : refusal(served.code, served.message);
  });
}

/** GET /api/v1/prds: the key's PRDs, a page at a time. */
export function listPrds(request: Request, deps: PublicApiDeps): Promise<Response> {
  return list(request, deps, PrdListSchema, (service, key, query, origin) => service.prds(key, query, origin));
}

/** GET /api/v1/bug-fixes: the key's bug fixes, a page at a time. */
export function listBugFixes(request: Request, deps: PublicApiDeps): Promise<Response> {
  return list(request, deps, BugFixListSchema, (service, key, query, origin) => service.bugFixes(key, query, origin));
}

/** The body of a start as `schema` reads it: the refusal names the field it refuses, one it does not know
 * included, then `rule`. */
async function bodyOf<T>(request: Request, schema: z.ZodType<T>, rule: string): Promise<T | Response> {
  const text = await request.text();
  let json: unknown = null;
  try {
    json = text.length > MAX_BODY_CHARS ? null : JSON.parse(text);
  } catch {
    json = null;
  }
  const read = schema.safeParse(json);
  if (read.success) return read.data;
  const issue = read.error.issues[0];
  const field = issue?.code === 'unrecognized_keys' ? issue.keys[0] : issue?.path[0];
  return refusal('invalid_request', typeof field === 'string' ? `${field}: ${rule}` : rule);
}

/** Answers a start: the key, then the body `schema` reads, then `serve`'s job, 202. */
function start<T>(
  request: Request, deps: PublicApiDeps, schema: z.ZodType<T>, rule: string,
  serve: (service: PublicApiService, key: ApiKeyCaller, body: T) => Promise<Answered<unknown>>,
): Promise<Response> {
  return asKey(request, deps, async (service, key) => {
    const body = await bodyOf(request, schema, rule);
    if (body instanceof Response) return body;
    const served = await serve(service, key, body);
    return served.ok ? reply(202, JobSchema.parse(served.value)) : refusal(served.code, served.message);
  });
}

/** POST /api/v1/bug-fixes: queues the bug fix on the runners and answers 202 with the job. */
export function startBugFix(request: Request, deps: PublicApiDeps): Promise<Response> {
  return start(request, deps, StartBugFixSchema, BAD_BODY, (service, key, body) => service.startBugFix(key, body));
}

/** POST /api/v1/mega-bug-fixes: queues the mega bug fix in a plan repository and answers 202 with the job. */
export function startMegaBugFix(request: Request, deps: PublicApiDeps): Promise<Response> {
  return start(request, deps, StartMegaBugFixSchema, BAD_MEGA_BODY, (service, key, body) => service.startMegaBugFix(key, body));
}

/** GET /api/v1/jobs/{id}: a job a key of the key's workspace queued; any other is 404. */
export function getJob(request: Request, id: string, deps: PublicApiDeps): Promise<Response> {
  return asKey(request, deps, async (service, key) => {
    if (!z.uuid().safeParse(id).success) return refusal('not_found', NO_SUCH_JOB);
    const served = await service.job(key, id);
    return served.ok ? reply(200, JobSchema.parse(served.value)) : refusal(served.code, served.message);
  });
}

/** GET /api/v1/jobs/{id}/lines: the lines of a job a key of the key's workspace queued, oldest first, a page at a
 * time; any other job is 404, as for the job itself. An id that is no uuid is a job that does not exist, and never
 * reaches the database, whose uuid column would refuse it. */
export function getJobLines(request: Request, id: string, deps: PublicApiDeps): Promise<Response> {
  return list(request, deps, JobLineListSchema, (service, key, query) => (z.uuid().safeParse(id).success
    ? service.jobLines(key, id, query)
    : Promise.resolve<Answered<JobLineList>>({ ok: false, code: 'not_found', message: NO_SUCH_JOB })));
}
