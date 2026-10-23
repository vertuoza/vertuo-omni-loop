import type { z } from 'zod';
import { refuse, reply } from '../../business-api/reply';
import {
  API_KEY_REFUSALS, ApiKeyIdSchema, AttachedGithubAppSchema, AttachGithubAppRequestSchema, MadeApiKeySchema, MakeApiKeyRequestSchema, RemovedGithubAppSchema,
  RevokeApiKeyRequestSchema, RevokedApiKeySchema,
} from './api-keys.contract';
import type { ApiKeysService, Served } from './api-keys.service';

// Settings › API keys' routes (PRD 2022 s1; ADR-0095), as plain functions of a Request, so they are
// tested with the real service on a fake repository and each route stays one line:
//
//   POST   /api/api-keys {workspace, name, repos}   201 {secret, key}: the secret shown this once
//   DELETE /api/api-keys {workspace, key}           200 {key}: the key revoked
//
// and, for the GitHub App a key's jobs run as (PRD 2433 s4):
//
//   POST   /api/api-keys/<id>/github-app {appId, privateKey}   200 {slug}: attached, or replaced
//   DELETE /api/api-keys/<id>/github-app                       200 {removed}
//
// The caller is checked first: signed out, 401, and nothing else runs. The service then acts as the
// signed-in person, so the database decides who may (an owner). Each answer is checked against the
// contract before it leaves, never cached; each refusal is `{error}` in plain words
// (./api-keys.contract.ts). A failure is 500, logged without the secret. The App routes never read, say
// or log the private key: it is parsed from the body, checked, sealed, and goes no further.

export type ApiKeysDeps = {
  /** The rules as the signed-in person, or null when nobody is signed in; null itself with no database. */
  service: (() => Promise<ApiKeysService | null>) | null;
  log: (line: string) => void;
};

const MAX_BODY_CHARS = 32 * 1024;
const NO_DATABASE = 'API keys are not available here: this deployment has no database.';
const SIGNED_OUT = 'Sign in first.';
const FAILED = 'The API keys could not answer. Try again.';
const BAD_MAKE = 'The body must be {"workspace": "<id>", "name": "<1 to 40 characters>", "repos": ["owner/name", …]} (an empty list: every repository).';
const BAD_REVOKE = 'The body must be {"workspace": "<id>", "key": "<id>"}.';
const BAD_APP = 'The body must be {"appId": "<the GitHub App\'s number>", "privateKey": "<the .pem file\'s text>"}.';
const BAD_KEY = 'The key in the path must be an API key\'s id.';

/** `text` as JSON, or undefined when it is none. */
function jsonOf(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The request's body as `schema` reads it, or a refusal: 400 when it is no JSON object, 422 naming
 * the first field the contract refuses. */
async function bodyAs<T>(request: Request, schema: z.ZodType<T>, shape: string): Promise<T | Response> {
  const text = await request.text();
  const json = text.length > MAX_BODY_CHARS ? undefined : jsonOf(text);
  if (json === null || typeof json !== 'object' || Array.isArray(json)) return refuse(API_KEY_REFUSALS.malformed, shape);
  const read = schema.safeParse(json);
  if (read.success) return read.data;
  const field = read.error.issues[0]?.path[0];
  return refuse(API_KEY_REFUSALS.invalid, typeof field === 'string' ? `${field}: ${shape}` : shape);
}

/** Runs `serve` as the signed-in person and answers its value in `shape` with `status`. */
async function answer<T>(
  deps: ApiKeysDeps, status: number, shape: z.ZodType,
  serve: (service: ApiKeysService) => Promise<Served<T> | Response>,
): Promise<Response> {
  if (!deps.service) return refuse(API_KEY_REFUSALS.unavailable, NO_DATABASE);
  try {
    const service = await deps.service();
    if (!service) return refuse(API_KEY_REFUSALS['signed-out'], SIGNED_OUT);
    const served = await serve(service);
    if (served instanceof Response) return served;
    if (!served.ok) {
      if (served.cause) deps.log(`api-keys: ${served.cause}`);
      return refuse(API_KEY_REFUSALS[served.kind], served.error);
    }
    return reply(status, shape.parse(served.value));
  } catch (error) {
    deps.log(`api-keys: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(API_KEY_REFUSALS.database, FAILED);
  }
}

/** POST /api/api-keys: an owner makes a key; its secret is answered this once. */
export function postApiKey(request: Request, deps: ApiKeysDeps): Promise<Response> {
  return answer(deps, 201, MadeApiKeySchema, async (service) => {
    const body = await bodyAs(request, MakeApiKeyRequestSchema, BAD_MAKE);
    return body instanceof Response ? body : service.make(body);
  });
}

/** DELETE /api/api-keys: an owner revokes a key. */
export function deleteApiKey(request: Request, deps: ApiKeysDeps): Promise<Response> {
  return answer(deps, 200, RevokedApiKeySchema, async (service) => {
    const body = await bodyAs(request, RevokeApiKeyRequestSchema, BAD_REVOKE);
    return body instanceof Response ? body : service.revoke(body);
  });
}

/** The key's id from the path, or a 400: whatever else the path says is no key. */
function keyIn(path: string): string | Response {
  const key = ApiKeyIdSchema.safeParse(path);
  return key.success ? key.data : refuse(API_KEY_REFUSALS.malformed, BAD_KEY);
}

/** POST /api/api-keys/<id>/github-app: an owner attaches a GitHub App to a key, or replaces its App. */
export function postGithubApp(request: Request, keyId: string, deps: ApiKeysDeps): Promise<Response> {
  return answer(deps, 200, AttachedGithubAppSchema, async (service) => {
    const key = keyIn(keyId);
    if (key instanceof Response) return key;
    const body = await bodyAs(request, AttachGithubAppRequestSchema, BAD_APP);
    return body instanceof Response ? body : service.attachGithubApp({ ...body, key });
  });
}

/** DELETE /api/api-keys/<id>/github-app: an owner removes a key's GitHub App. */
export function deleteGithubApp(keyId: string, deps: ApiKeysDeps): Promise<Response> {
  return answer(deps, 200, RemovedGithubAppSchema, (service) => {
    const key = keyIn(keyId);
    return Promise.resolve(key instanceof Response ? key : service.removeGithubApp({ key }));
  });
}
