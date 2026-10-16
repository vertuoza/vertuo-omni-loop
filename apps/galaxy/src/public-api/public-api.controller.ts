import type { z } from 'zod';
import { reply } from '../business-api/reply';
import {
  BugFixListSchema, ListQuerySchema, LIMIT_MAX, PrdListSchema, PUBLIC_API_ERRORS, type ListQuery, type PublicApiErrorCode,
} from './public-api.contract';
import type { ApiKeyCaller, PublicApiService, Served } from './public-api.service';

// The public API's routes (PRD 2022 s2, spec "The routes"; ADR-0095), as plain functions of a Request, so
// they are tested with the real service on rows in memory and each route stays one line:
//
//   GET /api/v1/prds?limit=&cursor=        200 {data, next_cursor}: the key's PRDs, newest first
//   GET /api/v1/bug-fixes?limit=&cursor=   200 {data, next_cursor}: the key's bug fixes, newest first
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

/** Answers a list: the key, then the query, then `serve`'s page in `shape`. */
async function list<T>(
  request: Request, deps: PublicApiDeps, shape: z.ZodType,
  serve: (service: PublicApiService, key: ApiKeyCaller, query: ListQuery, origin: string) => Promise<Served<T>>,
): Promise<Response> {
  if (!deps.service) return refusal('internal', NO_DATABASE);
  const service = deps.service;
  try {
    const key = await keyOf(request, service);
    if (key instanceof Response) return key;
    const url = new URL(request.url);
    const query = queryOf(url);
    if (query instanceof Response) return query;
    const served = await serve(service, key, query, url.origin);
    if (!served.ok) return refusal(served.code, served.message);
    return reply(200, shape.parse(served.value));
  } catch (error) {
    deps.log(`public-api: ${error instanceof Error ? error.message : String(error)}`);
    return refusal('internal', FAILED);
  }
}

/** GET /api/v1/prds: the key's PRDs, a page at a time. */
export function listPrds(request: Request, deps: PublicApiDeps): Promise<Response> {
  return list(request, deps, PrdListSchema, (service, key, query, origin) => service.prds(key, query, origin));
}

/** GET /api/v1/bug-fixes: the key's bug fixes, a page at a time. */
export function listBugFixes(request: Request, deps: PublicApiDeps): Promise<Response> {
  return list(request, deps, BugFixListSchema, (service, key, query, origin) => service.bugFixes(key, query, origin));
}
