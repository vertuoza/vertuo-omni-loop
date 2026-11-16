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
// - **What it reads,** built anew on each call: the newest pack of each repository the key may read, the
//   law home's pack for the business laws, and the product's own rows. A repository with no pack yet reads
//   `pack: null` with the line telling the agent to tell its person (BL-PRODUCTKNOWLEDGE-4); it never fails
//   the call. The Legal entries (with each owner's login) and the Glossary come with the access itself, as
//   the agent link reads them.
import { knowledgeEntries, type PackText } from 'omni-loop/kit/lib/knowledge/entries.ts';
import { NO_PACK_LINE, type RepositoryState } from './product-mcp.contract';
import type { KnowledgeEntry } from 'omni-loop/kit/lib/knowledge/entries.ts';
import type { AccessRow, ProductMcpRepository } from './product-mcp.repository';
import { accessCache, type AccessCache } from './access-cache';

/** Who a request is: a key served for the product, a key that does not work, or a product not here for it. */
export type Resolution = { kind: 'served'; access: AccessRow } | { kind: 'refused' } | { kind: 'not-here' };

/** What a served key reads: the entries, and the repositories they come from. */
export type KnowledgeRead = { product: string; entries: KnowledgeEntry[]; repositories: RepositoryState[] };

const stateOf = (ref: AccessRow['repositories'][number]): RepositoryState =>
  ref.pack_id !== null && ref.sha !== null && ref.committed_at !== null
    ? { repo: ref.repo, pack: { sha: ref.sha, committedAt: ref.committed_at } }
    : { repo: ref.repo, pack: null, note: NO_PACK_LINE };

/** Every repository a served access reads: its repositories, and the law home. */
const refsOf = (access: AccessRow): AccessRow['repositories'] => [...access.repositories, ...(access.law_home ? [access.law_home] : [])];

/** `kept` names a server-wide cache shared by every request; by default the service keeps its own. */
export function productMcpService(repository: ProductMcpRepository, kept: AccessCache = accessCache()) {
  /** Whether the database confirms, now, that the kept `access` of `hash` still holds (bug #2954). */
  const stillServed = async (hash: string, access: AccessRow): Promise<boolean> => {
    const refs = refsOf(access);
    const [keyId, open, newest] = await Promise.all([
      repository.keyIdOf(hash),
      repository.productOpen(access.product.id),
      repository.newestPacks(access.product.workspace_id, [...new Set(refs.map((ref) => ref.repo))]),
    ]);
    return keyId === access.key_id && open && refs.every((ref) => (newest.get(ref.repo) ?? null) === ref.pack_id);
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
        if (await stillServed(hash, held)) return { kind: 'served', access: held };
        kept.drop(hash, key);
      }
      const access = await repository.access(hash, key);
      if (access !== null) {
        kept.put(hash, key, access);
        return { kind: 'served', access };
      }
      return (await repository.keyLive(hash)) ? { kind: 'not-here' } : { kind: 'refused' };
    },

    /** The product's knowledge as the served key reads it now. */
    async read(access: AccessRow): Promise<KnowledgeRead> {
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
