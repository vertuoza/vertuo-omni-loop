import { z } from 'zod';
import { reply } from '../business-api/reply';
import {
  ACTING_FOR_MAX, AnswerJobSchema, BugFixListSchema, DESCRIPTION_MAX, DismissJobSchema, JobLineListSchema, JobSchema, ListQuerySchema, LIMIT_MAX, MEGA_DESCRIPTION_MAX,
  PrdListSchema, PUBLIC_API_ERRORS, QuestionsSchema, StartBugFixSchema, StartMegaBugFixSchema, type ListQuery, type PublicApiErrorCode,
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
//   GET /api/v1/jobs/{id}/questions        200 questions: what the job asked, where it stands, who closed it (PRD 2425 s6)
//   POST /api/v1/jobs/{id}/answers         202 job: the resume of the job, queued as the key that sent it (PRD 2425 s6)
//   POST /api/v1/jobs/{id}/dismiss         200 job: the questions closed with no answer and nothing queued (PRD 2425 s6)
//
// The key is checked first: no `Authorization: Bearer oma_…`, or a key api_key_of() does not answer live
// (unknown, revoked, its maker gone), is 401, and nothing else runs. The query (or, for a POST, the body)
// is read next: a bad `limit` or `cursor`, or a body that is not the route's, is 422 naming it. A second
// answer or dismissal is 409 `conflict` (BR-PRODUCT-12: the first close wins). Each answer is checked against the contract before it leaves, never
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
const ACTING_FOR_RULE = `"acting_for"?: "<whom the key acts for, 1 to ${String(ACTING_FOR_MAX)} characters: letters of any alphabet, digits, spaces and . _ ' @ - · only>"`;
const BAD_ANSWER_BODY = `The body must be {"answers": {"<question>": "<answer, 1 to 2000 characters>"}, ${ACTING_FOR_RULE}}: one answer to each question, one to four in all, and nothing else.`;
const BAD_DISMISS_BODY = `The body must be empty, or {${ACTING_FOR_RULE}}, and nothing else.`;
const NO_SUCH_JOB = 'No such job.';
const MAX_BODY_CHARS = 4 * 1024;

/** What a POST answers and reads: the status of a success, the longest body, and whether an empty body is `{}`. */
type PostRules = { status: 200 | 202; max: number; emptyIsObject: boolean };

/** A start: 202, a short body that must be there. */
const STARTING: PostRules = { status: 202, max: MAX_BODY_CHARS, emptyIsObject: false };
/** An answer: 202 with the resume job; up to four answers of 2,000 characters under questions of 1,000 fit in 16 KiB. */
const ANSWERING: PostRules = { status: 202, max: 16 * 1024, emptyIsObject: false };
/** A dismissal: 200 with the job; it needs nothing, so no body is as good as `{}`. */
const DISMISSING: PostRules = { status: 200, max: MAX_BODY_CHARS, emptyIsObject: true };

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

/** The body of a POST as `schema` reads it: the refusal names the field it refuses, one it does not know
 * included, then `rule`. A body over the route's limit is read as none that fits, and an empty one as `{}` where the route allows it. */
async function bodyOf<T>(request: Request, schema: z.ZodType<T>, rule: string, how: PostRules): Promise<T | Response> {
  const text = await request.text();
  let json: unknown = null;
  try {
    json = text.length > how.max ? null : JSON.parse(how.emptyIsObject && text.trim() === '' ? '{}' : text);
  } catch {
    json = null;
  }
  const read = schema.safeParse(json);
  if (read.success) return read.data;
  const issue = read.error.issues[0];
  const field = issue?.code === 'unrecognized_keys' ? issue.keys[0] : issue?.path[0];
  return refusal('invalid_request', typeof field === 'string' ? `${field}: ${rule}` : rule);
}

/** Answers a POST: the key, then the body `schema` reads, then `serve`'s job, with the status `how` says. */
function post<T>(
  request: Request, deps: PublicApiDeps, how: PostRules, schema: z.ZodType<T>, rule: string,
  serve: (service: PublicApiService, key: ApiKeyCaller, body: T) => Promise<Answered<unknown>>,
): Promise<Response> {
  return asKey(request, deps, async (service, key) => {
    const body = await bodyOf(request, schema, rule, how);
    if (body instanceof Response) return body;
    const served = await serve(service, key, body);
    return served.ok ? reply(how.status, JobSchema.parse(served.value)) : refusal(served.code, served.message);
  });
}

/** Runs `serve` for the job `id`: an id that is no uuid is a job that does not exist, and never reaches the database, whose uuid column would refuse it. */
function ofJob<T>(id: string, serve: (job: string) => Promise<Answered<T>>): Promise<Answered<T>> {
  return z.uuid().safeParse(id).success ? serve(id) : Promise.resolve<Answered<T>>({ ok: false, code: 'not_found', message: NO_SUCH_JOB });
}

/** POST /api/v1/bug-fixes: queues the bug fix on the runners and answers 202 with the job. */
export function startBugFix(request: Request, deps: PublicApiDeps): Promise<Response> {
  return post(request, deps, STARTING, StartBugFixSchema, BAD_BODY, (service, key, body) => service.startBugFix(key, body));
}

/** POST /api/v1/mega-bug-fixes: queues the mega bug fix in a plan repository and answers 202 with the job. */
export function startMegaBugFix(request: Request, deps: PublicApiDeps): Promise<Response> {
  return post(request, deps, STARTING, StartMegaBugFixSchema, BAD_MEGA_BODY, (service, key, body) => service.startMegaBugFix(key, body));
}

/** GET /api/v1/jobs/{id}: a job a key of the key's workspace queued; any other is 404. */
export function getJob(request: Request, id: string, deps: PublicApiDeps): Promise<Response> {
  return asKey(request, deps, async (service, key) => {
    const served = await ofJob(id, (job) => service.job(key, job));
    return served.ok ? reply(200, JobSchema.parse(served.value)) : refusal(served.code, served.message);
  });
}

/** GET /api/v1/jobs/{id}/lines: the lines of a job a key of the key's workspace queued, oldest first, a page at a
 * time; any other job is 404, as for the job itself. */
export function getJobLines(request: Request, id: string, deps: PublicApiDeps): Promise<Response> {
  return list(request, deps, JobLineListSchema, (service, key, query) => ofJob(id, (job) => service.jobLines(key, job, query)));
}

/** GET /api/v1/jobs/{id}/questions: what a job a key of the key's workspace queued asked, where it stands and who closed it (PRD 2425 s6);
 * a job that asked none, and any other, is 404. */
export function getJobQuestions(request: Request, id: string, deps: PublicApiDeps): Promise<Response> {
  return asKey(request, deps, async (service, key) => {
    const served = await ofJob(id, (job) => service.jobQuestions(key, job));
    return served.ok ? reply(200, QuestionsSchema.parse(served.value)) : refusal(served.code, served.message);
  });
}

/** POST /api/v1/jobs/{id}/answers: answers the questions of a job a key of the key's workspace queued, and answers 202 with the
 * job that resumes it (PRD 2425 s6). The body is read before the job, as a start's is before its repository. */
export function answerJob(request: Request, id: string, deps: PublicApiDeps): Promise<Response> {
  return post(request, deps, ANSWERING, AnswerJobSchema, BAD_ANSWER_BODY, (service, key, body) => ofJob(id, (job) => service.answerJob(key, job, body)));
}

/** POST /api/v1/jobs/{id}/dismiss: closes the questions of a job a key of the key's workspace queued with no answer, queueing nothing,
 * and answers 200 with the job (PRD 2425 s6). */
export function dismissJob(request: Request, id: string, deps: PublicApiDeps): Promise<Response> {
  return post(request, deps, DISMISSING, DismissJobSchema, BAD_DISMISS_BODY, (service, key, body) => ofJob(id, (job) => service.dismissJob(key, job, body)));
}
