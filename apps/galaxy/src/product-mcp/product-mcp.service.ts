// A product's MCP server's rules (PRD 2707 s3; ADR-0095): who gets in, and what they read.
//
// - **Who gets in,** asked again on every request (BR-PRODUCT-64, BL-ACCESS-1): a key product_mcp_for_key()
//   answers for the product is served; one it does not answer is either a key
//   that does not work at all (api_key_of() answers nothing: the client connects and each call answers the
//   one line, ADR-0067), or a working key for a product that is off, unknown, of another workspace or out
//   of its reach: the same 404, so a caller never learns whether a product exists. A malformed key never
//   reaches the database.
// - **What is kept** (bug #2954): a served access is kept a minute per key and product (access-cache.ts), so an
//   agent session does not rebuild it in the database on each of its requests. A kept access is served only
//   once the database confirms, on that very request, that the key still works and its maker is still a
//   member (api_key_of()), that the product is still on, and that each repository's newest pack is still the
//   one kept: a person who leaves, a revoked key, a server turned off and a merge all show on the next call,
//   as before. Anything else drops it and asks product_mcp_for_key() again. A refusal is never kept.
// - **A member's kit sign-in** (PRD 3007 s1), whose token the controller has had the Auth server check, is
//   served under the same rules: product_mcp_for_member() answers the product for a person who is a member of
//   its workspace now, while the product is on and not archived (BR-PRODUCT-63, BR-PRODUCT-64, BL-ACCESS-1),
//   reading every repository of it, as a key with no allow-list does. Anything else is a product not here for
//   them: the same 404 a working key gets, so a caller never learns whether a product exists. Their access is
//   kept a minute per person and product in a cache of its own, and served only once the database confirms, on
//   that very request, that they are still a member, the product still on and each newest pack still the one
//   kept.
// - **What it reads,** built anew on each call: the newest pack of each repository the caller may read, the
//   law home's pack for the business laws, and the product's own rows. A repository with no pack yet reads
//   `pack: null` with the line telling the agent to tell its person (BL-PRODUCTKNOWLEDGE-4); it never fails
//   the call. The Legal entries (with each owner's login) and the Glossary come with the access itself, as
//   the agent link reads them.
import { knowledgeEntries, type PackText } from 'omni-loop/kit/lib/knowledge/entries.ts';
import { NO_PACK_LINE, type RepositoryState, type SearchLogBy } from './product-mcp.contract';
import type { KnowledgeEntry } from 'omni-loop/kit/lib/knowledge/entries.ts';
import type { AccessRow, MemberAccessRow, ProductAccess, ProductMcpRepository } from './product-mcp.repository';
import { accessCache, type AccessCache } from './access-cache';

/**
 * Who a request is: a caller served for the product (`by` names them as the search log does), a key that does
 * not work, or a product not here for them.
 */
export type Resolution = { kind: 'served'; access: ProductAccess; by: SearchLogBy } | { kind: 'refused' } | { kind: 'not-here' };

/** What a served caller reads: the entries, and the repositories they come from. */
export type KnowledgeRead = { product: string; entries: KnowledgeEntry[]; repositories: RepositoryState[] };

const stateOf = (ref: ProductAccess['repositories'][number]): RepositoryState =>
  ref.pack_id !== null && ref.sha !== null && ref.committed_at !== null
    ? { repo: ref.repo, pack: { sha: ref.sha, committedAt: ref.committed_at } }
    : { repo: ref.repo, pack: null, note: NO_PACK_LINE };

/** Every repository a served access reads: its repositories, and the law home. */
const refsOf = (access: ProductAccess): ProductAccess['repositories'] => [...access.repositories, ...(access.law_home ? [access.law_home] : [])];

const byKey = (access: AccessRow): Resolution => ({ kind: 'served', access, by: { api_key_id: access.key_id } });
const byMember = (access: MemberAccessRow): Resolution => ({ kind: 'served', access, by: { user_id: access.user_id } });

/**
 * `kept` and `members` name server-wide caches shared by every request, the keys' and the members'; by
 * default the service keeps its own.
 */
export function productMcpService(
  repository: ProductMcpRepository,
  kept: AccessCache = accessCache(),
  members: AccessCache<MemberAccessRow> = accessCache<MemberAccessRow>(),
) {
  /** Whether each repository the kept `access` reads still has the newest pack it kept (bug #2954). */
  const packsHold = async (access: ProductAccess): Promise<boolean> => {
    const refs = refsOf(access);
    const newest = await repository.newestPacks(access.product.workspace_id, [...new Set(refs.map((ref) => ref.repo))]);
    return refs.every((ref) => (newest.get(ref.repo) ?? null) === ref.pack_id);
  };

  /** Whether the database confirms, now, that the kept `access` of `hash` still holds (bug #2954). */
  const stillServed = async (hash: string, access: AccessRow): Promise<boolean> => {
    const [keyId, open, packs] = await Promise.all([repository.keyIdOf(hash), repository.productOpen(access.product.id), packsHold(access)]);
    return keyId === access.key_id && open && packs;
  };

  /** Whether the database confirms, now, that the member's kept `access` still holds (PRD 3007 s1). */
  const memberStillServed = async (access: MemberAccessRow): Promise<boolean> => {
    const [member, open, packs] = await Promise.all([
      repository.isMember(access.user_id, access.product.workspace_id), repository.productOpen(access.product.id), packsHold(access),
    ]);
    return member && open && packs;
  };

  /** Each pack's files, read once however many places name it. */
  const filesOf = (ids: readonly string[]): Promise<Map<string, PackText[]>> =>
    Promise.all([...new Set(ids)].map(async (id) => [id, await repository.packFiles(id)] as const)).then((pairs) => new Map(pairs));

  return {
    /** Who `hash` (null: no key of an API key's shape) is for the product `key`. */
    async resolve(hash: string | null, key: string): Promise<Resolution> {
      if (hash === null) return { kind: 'refused' };
      const held = kept.get(hash, key);
      if (held !== null) {
        if (await stillServed(hash, held)) return byKey(held);
        kept.drop(hash, key);
      }
      const access = await repository.access(hash, key);
      if (access !== null) {
        kept.put(hash, key, access);
        return byKey(access);
      }
      return (await repository.keyLive(hash)) ? { kind: 'not-here' } : { kind: 'refused' };
    },

    /** Who the signed-in person `userId`, whose token the Auth server accepted, is for the product `key` (PRD 3007 s1). */
    async resolveMember(userId: string, key: string): Promise<Resolution> {
      const held = members.get(userId, key);
      if (held !== null) {
        if (await memberStillServed(held)) return byMember(held);
        members.drop(userId, key);
      }
      const access = await repository.memberAccess(userId, key);
      if (access === null) return { kind: 'not-here' };
      members.put(userId, key, access);
      return byMember(access);
    },

    /** The product's knowledge as the served caller reads it now. */
    async read(access: ProductAccess): Promise<KnowledgeRead> {
      const home = access.law_home;
      const packIds = [...access.repositories, ...(home ? [home] : [])].flatMap((ref) => (ref.pack_id === null ? [] : [ref.pack_id]));
      const [files, never] = await Promise.all([filesOf(packIds), repository.never(access.product.id)]);
      const filesFor = (packId: string | null): PackText[] | null => (packId === null ? null : files.get(packId) ?? null);
      const homeFiles = home ? filesFor(home.pack_id) : null;
      const entries = knowledgeEntries({
        repositories: access.repositories.map((ref) => ({ repo: ref.repo, files: filesFor(ref.pack_id) })),
        lawHome: home && homeFiles ? { repo: home.repo, files: homeFiles } : null,
        legal: access.knowledge.legal,
        glossary: access.knowledge.glossary,
        never,
      });
      return { product: access.product.name, entries, repositories: access.repositories.map(stateOf) };
    },
  };
}

export type ProductMcpService = ReturnType<typeof productMcpService>;
