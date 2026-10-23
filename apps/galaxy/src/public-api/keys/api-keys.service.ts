import type {
  ApiKey, ApiKeyRefusal, AttachedGithubAppReply, AttachGithubAppRequest, MadeApiKeyReply, MakeApiKeyRequest, RemovedGithubAppReply, RevokeApiKeyRequest,
} from './api-keys.contract';
import type { ApiKeysRepository, Written } from './api-keys.repository';
import type { AppChecked, AppCredentials } from './github-app';
import type { MadeApiKey } from './secret';

// The API keys' rules (PRD 2022 s1; ADR-0095), over the repository as the signed-in person. Making a key
// draws its secret here, on the server, and hands the database only its hash and last four characters;
// the secret goes back once, in the answer to the owner who made it, and is never kept (N-PRODUCT-17's
// reading of a key: only its maker's browser sees it, once). Who may make or revoke is the database's to
// say (an owner); this turns each refusal into its words. The page's read: whether the person owns the
// workspace, its live keys, and, for an owner, the repositories an allow-list may name.
//
// A key's GitHub App (PRD 2433 s4) is attached here too: the App ID and private key an owner sends are
// checked with GitHub first (nothing is stored for a pair it refuses), the private key is sealed under the
// deployment's master key and only the sealed form reaches the database, and the answer carries the App's
// slug alone. Who may attach, replace or remove is the database's to say (an owner of the key's workspace);
// a deployment with no master key, or none of the means to ask GitHub, attaches nothing. Nothing here
// says, logs or returns the private key (L-GDPR-2): a refusal's cause names GitHub's status and path only.

export type Served<T> = { ok: true; value: T } | { ok: false; kind: ApiKeyRefusal; error: string; cause?: string };

export const ONLY_OWNERS = 'Only an owner of the workspace makes or revokes its API keys.';
export const TOO_MANY = 'This workspace holds 20 API keys already: revoke one to make another.';
export const GONE = 'That key is no longer here. Reload the page.';
export const NAME_RULE = 'A name: 1 to 40 characters, on one line.';
export const REPOS_RULE = 'Pick repositories this workspace tracks, or All repositories.';
export const FAILED = 'The API keys could not be saved. Try again.';
export const ONLY_OWNERS_APP = 'Only an owner of the workspace attaches or removes an API key’s GitHub App.';
export const GITHUB_REFUSED = 'GitHub refused this App ID and private key.';
export const GITHUB_UNAVAILABLE = 'GitHub could not be reached to check this App. Nothing was saved; try again.';
export const NOT_AVAILABLE = "Attaching a GitHub App isn't available on this deployment.";
export const nameTaken = (name: string) => `This workspace already has a key named “${name}”. Pick another name.`;

/** What the page reads: the person's role, the live keys, and the repositories an owner may pick. */
export interface ApiKeysPageRead {
  owner: boolean;
  keys: ApiKey[];
  tracked: string[];
}

type Port = Pick<ApiKeysRepository, 'list' | 'make' | 'revoke' | 'owner' | 'tracked' | 'attachGithubApp' | 'removeGithubApp'>;

/** What attaching a GitHub App needs beyond the database: the deployment's means to seal a private key and to ask GitHub. */
export interface GithubAppDeps {
  /** The master key a private key is sealed under, or null on a deployment with none (SECRETS_MASTER_KEY unset or malformed). */
  master: () => Buffer | null;
  /** Checks the App ID and private key as a pair with GitHub (checkApp, github-app.ts). */
  check: (credentials: AppCredentials) => Promise<AppChecked>;
}

/** An owner's attach: the key, the App's ID and its private key (as sent, never kept in the clear). */
type AttachGithubApp =AttachGithubAppRequest & { key: string };

type Refused = Extract<Written<unknown>, { ok: false }>;

/** The refusals each code means whatever its hint. */
const BY_CODE: Partial<Record<string, { kind: ApiKeyRefusal; error: string }>> = {
  '42501': { kind: 'forbidden', error: ONLY_OWNERS },
  '54000': { kind: 'limit', error: TOO_MANY },
  P0002: { kind: 'missing', error: GONE },
};

/** A bad value's words, by the field its hint names (22023), or null for a field the page never sends. */
function invalidOf(written: Refused, name: string): string | null {
  if (written.hint === 'name') return /already/.test(written.message) ? nameTaken(name) : NAME_RULE;
  return written.hint === 'repos' ? REPOS_RULE : null;
}

/** A refused write in its words, by the database's code and hint; anything else is a failure, its
 * words kept for the log only. */
function refusal(written: Refused, name = ''): Served<never> {
  const plain = BY_CODE[written.code ?? ''];
  if (plain) return { ok: false, ...plain };
  const invalid = written.code === '22023' ? invalidOf(written, name) : null;
  if (invalid !== null) return { ok: false, kind: 'invalid', error: invalid };
  return { ok: false, kind: 'database', error: FAILED, cause: `${written.code ?? 'no code'}: ${written.message}` };
}

/**
 * A refused attach or removal in its words. The database refuses a key the caller does not own, one of
 * another workspace and one that does not exist alike (42501), so a stranger learns nothing; a revoked key
 * (42501, hint `key`) is gone. Anything else reads as it does for a key.
 */
function appRefusal(written: Refused): Served<never> {
  if (written.code !== '42501') return refusal(written);
  return written.hint === 'key' ? { ok: false, kind: 'missing', error: GONE } : { ok: false, kind: 'forbidden', error: ONLY_OWNERS_APP };
}

export function apiKeysService(repository: Port, draw: () => Promise<MadeApiKey>, github: GithubAppDeps | null = null) {
  return {
    /** Makes a key for the workspace: its secret, this once, and the key as listed. */
    async make(request: MakeApiKeyRequest): Promise<Served<MadeApiKeyReply>> {
      const made = await draw();
      const written = await repository.make(request.workspace, request.name, request.repos, made.hash, made.lastFour);
      if (!written.ok) return refusal(written, request.name);
      const key = (await repository.list(request.workspace)).find((k) => k.id === written.value);
      if (!key) return { ok: false, kind: 'database', error: FAILED, cause: 'the key just made is not listed' };
      return { ok: true, value: { secret: made.secret, key } };
    },

    /** Revokes a key of the workspace: the key as listed, revoked. */
    async revoke(request: RevokeApiKeyRequest): Promise<Served<{ key: ApiKey }>> {
      const written = await repository.revoke(request.workspace, request.key);
      return written.ok ? { ok: true, value: { key: written.value } } : refusal(written);
    },

    /**
     * Attaches a GitHub App to a key, or replaces the one it holds: the pair is checked with GitHub, the
     * private key sealed, and the App's slug answered. Nothing is stored unless GitHub accepted the pair.
     */
    async attachGithubApp(request: AttachGithubApp): Promise<Served<AttachedGithubAppReply>> {
      const master = github?.master() ?? null;
      if (!github || !master) return { ok: false, kind: 'unavailable', error: NOT_AVAILABLE };
      const checked = await github.check({ appId: String(request.appId), privateKey: request.privateKey });
      if (!checked.ok) {
        return checked.reason === 'refused'
          ? { ok: false, kind: 'invalid', error: GITHUB_REFUSED }
          : { ok: false, kind: 'github', error: GITHUB_UNAVAILABLE, cause: checked.detail };
      }
      // The secret box is the Node-only half of this: loaded here, on the one call that seals, so the rules
      // stay importable (the page's read, its tests) without it.
      const { sealSecret } = await import('../../jev/secret-box');
      const { ciphertext, iv } = sealSecret(request.privateKey, master);
      const written = await repository.attachGithubApp(request.key, request.appId, checked.slug, checked.botId, { ciphertext, iv });
      return written.ok ? { ok: true, value: { slug: written.value.slug } } : appRefusal(written);
    },

    /** Removes a key's GitHub App: whether it held one. Needs neither GitHub nor the master key. */
    async removeGithubApp(request: { key: string }): Promise<Served<RemovedGithubAppReply>> {
      const written = await repository.removeGithubApp(request.key);
      return written.ok ? { ok: true, value: { removed: written.value } } : appRefusal(written);
    },

    /** The page's read of the workspace; the repositories only for an owner, who alone makes keys. */
    async page(workspace: string): Promise<ApiKeysPageRead> {
      const [owner, keys] = await Promise.all([repository.owner(workspace), repository.list(workspace)]);
      return { owner, keys, tracked: owner ? await repository.tracked(workspace) : [] };
    },
  };
}

export type ApiKeysService = ReturnType<typeof apiKeysService>;
