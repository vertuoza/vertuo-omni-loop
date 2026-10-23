import { z } from 'zod';

// Settings › API keys' contract (PRD 2022 s1; ADR-0095): what the page and its two routes exchange, safe
// for the browser. An owner makes a key with a name and an allow-list of repositories (empty: every
// repository of the workspace) and is answered its secret, this once, with the key as listed; an owner
// revokes a key. A listed key never carries its hash. Every refusal is `{error}` in plain words, with
// the status API_KEY_REFUSALS names.
//
//   POST   /api/api-keys {workspace, name, repos}   201 {secret, key}
//   DELETE /api/api-keys {workspace, key}           200 {key}
//
// An owner also attaches, replaces and removes the GitHub App a key's jobs run as (PRD 2433 s4): the App ID
// and the private key go to the server once, which checks the pair with GitHub, seals the key and answers
// only the App's slug. The key is never answered again, to anyone.
//
//   POST   /api/api-keys/<id>/github-app {appId, privateKey}   200 {slug}
//   DELETE /api/api-keys/<id>/github-app                       200 {removed}

export const API_KEY_NAME_MAX = 40;
/** The repositories an allow-list may name, well above any workspace's tracked ones. */
const REPOS_MAX = 200;
/** A PEM private key is under 4 KiB; this is room for a RSA 8192 key and some line endings. */
const PRIVATE_KEY_MAX = 16_384;

const ISO = z.string().min(1);

/**
 * A key's GitHub App as the list shows it (api_key_github_apps_list()): its slug to every member, and
 * `lastTokenAt` (null until it first mints) only to an owner, so a member's has no such field. Never its
 * private key.
 */
const GithubAppSchema = z.object({ slug: z.string().min(1), lastTokenAt: ISO.nullable().optional() });

/** A key as the list shows it (api_key_listed()): never its hash. */
export const ApiKeySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  lastFour: z.string(),
  /** The allow-list, `owner/name`; empty means every repository of the workspace. */
  repos: z.array(z.string()),
  createdAt: ISO,
  lastUsedAt: ISO.nullable(),
  revokedAt: ISO.nullable(),
  maker: z.object({ id: z.string(), login: z.string().nullable(), name: z.string().nullable() }),
  /** False once its maker left the workspace: it answers nothing, until an owner revokes it. */
  working: z.boolean(),
  /** The GitHub App its jobs run as, or null when it holds none (absent where a key is answered without the list's read). */
  githubApp: GithubAppSchema.nullable().optional(),
});
export type ApiKey = z.infer<typeof ApiKeySchema>;

/** A key's name: 1 to 40 characters on one line, trimmed. */
const ApiKeyNameSchema = z.string().trim().min(1).max(API_KEY_NAME_MAX).regex(/^[^\r\n\t]*$/);

/** A repository as the workspace tracks it: `owner/name`, in lower case. */
const RepoNameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,39}\/[a-z0-9._-]{1,100}$/);

export const MakeApiKeyRequestSchema = z.object({
  workspace: z.uuid(),
  name: ApiKeyNameSchema,
  repos: z.array(RepoNameSchema).max(REPOS_MAX),
});
export type MakeApiKeyRequest = z.infer<typeof MakeApiKeyRequestSchema>;

/** The key just made: its secret, shown this once, and the key as listed. */
export const MadeApiKeySchema = z.object({ secret: z.string().regex(/^oma_[A-Za-z0-9_-]{43}$/), key: ApiKeySchema });
export type MadeApiKeyReply = z.infer<typeof MadeApiKeySchema>;

export const RevokeApiKeyRequestSchema = z.object({ workspace: z.uuid(), key: z.uuid() });
export type RevokeApiKeyRequest = z.infer<typeof RevokeApiKeyRequestSchema>;

export const RevokedApiKeySchema = z.object({ key: ApiKeySchema });

/** A key's id, as the GitHub App routes read it from their path. */
export const ApiKeyIdSchema = z.uuid();

/** The App ID as GitHub shows it: digits, sent as a number or as the form's text. */
const AppIdSchema = z.union([z.number(), z.string().trim().regex(/^[0-9]{1,15}$/).transform(Number)])
  .pipe(z.number().int().positive());

/** What an owner sends to attach an App to a key: its ID and its private key (a `.pem` file's text). */
export const AttachGithubAppRequestSchema = z.object({
  appId: AppIdSchema,
  privateKey: z.string().trim().min(1).max(PRIVATE_KEY_MAX),
});
export type AttachGithubAppRequest = z.infer<typeof AttachGithubAppRequestSchema>;

/** The App just attached: its slug, all that is ever answered of it. */
export const AttachedGithubAppSchema = z.object({ slug: z.string().min(1) });
export type AttachedGithubAppReply = z.infer<typeof AttachedGithubAppSchema>;

/** The App just removed: whether the key held one. */
export const RemovedGithubAppSchema = z.object({ removed: z.boolean() });
export type RemovedGithubAppReply = z.infer<typeof RemovedGithubAppSchema>;

export const ApiKeyRefusalSchema = z.object({ error: z.string() });

/** Each refusal's status. */
export const API_KEY_REFUSALS = {
  malformed: 400,
  'signed-out': 401,
  forbidden: 403,
  missing: 404,
  invalid: 422,
  limit: 429,
  database: 500,
  /** GitHub could not be asked, to check an App's pair. */
  github: 502,
  unavailable: 503,
} as const;
export type ApiKeyRefusal = keyof typeof API_KEY_REFUSALS;
