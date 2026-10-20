import type { ApiKey, ApiKeyRefusal, MadeApiKeyReply, MakeApiKeyRequest, RevokeApiKeyRequest } from './api-keys.contract';
import type { ApiKeysRepository, Written } from './api-keys.repository';
import type { MadeApiKey } from './secret';

// The API keys' rules (PRD 2022 s1; ADR-0095), over the repository as the signed-in person. Making a key
// draws its secret here, on the server, and hands the database only its hash and last four characters;
// the secret goes back once, in the answer to the owner who made it, and is never kept (N-PRODUCT-17's
// reading of a key: only its maker's browser sees it, once). Who may make or revoke is the database's to
// say (an owner); this turns each refusal into its words. The page's read: whether the person owns the
// workspace, its live keys, and, for an owner, the repositories an allow-list may name.

export type Served<T> = { ok: true; value: T } | { ok: false; kind: ApiKeyRefusal; error: string; cause?: string };

export const ONLY_OWNERS = 'Only an owner of the workspace makes or revokes its API keys.';
export const TOO_MANY = 'This workspace holds 20 API keys already: revoke one to make another.';
export const GONE = 'That key is no longer here. Reload the page.';
export const NAME_RULE = 'A name: 1 to 40 characters, on one line.';
export const REPOS_RULE = 'Pick repositories this workspace tracks, or All repositories.';
export const FAILED = 'The API keys could not be saved. Try again.';
export const nameTaken = (name: string) => `This workspace already has a key named “${name}”. Pick another name.`;

/** What the page reads: the person's role, the live keys, and the repositories an owner may pick. */
export interface ApiKeysPageRead {
  owner: boolean;
  keys: ApiKey[];
  tracked: string[];
}

type Port = Pick<ApiKeysRepository, 'list' | 'make' | 'revoke' | 'owner' | 'tracked'>;

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

export function apiKeysService(repository: Port, draw: () => Promise<MadeApiKey>) {
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

    /** The page's read of the workspace; the repositories only for an owner, who alone makes keys. */
    async page(workspace: string): Promise<ApiKeysPageRead> {
      const [owner, keys] = await Promise.all([repository.owner(workspace), repository.list(workspace)]);
      return { owner, keys, tracked: owner ? await repository.tracked(workspace) : [] };
    },
  };
}

export type ApiKeysService = ReturnType<typeof apiKeysService>;
