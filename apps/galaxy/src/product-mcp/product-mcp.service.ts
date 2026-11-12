// A product's MCP server's rules (PRD 2707 s3; ADR-0095): who gets in, and what they read.
//
// - **Who gets in,** asked again on every request, nothing kept between two (BR-PRODUCT-64, BL-ACCESS-1):
//   a key product_mcp_for_key() answers for the product is served; one it does not answer is either a key
//   that does not work at all (api_key_of() answers nothing: the client connects and each call answers the
//   one line, ADR-0067), or a working key for a product that is off, unknown, of another workspace or out
//   of its reach: the same 404, so a caller never learns whether a product exists. A malformed key never
//   reaches the database.
// - **What it reads,** built anew on each call: the newest pack of each repository the key may read, the
//   law home's pack for the business laws, and the product's own rows. A repository with no pack yet reads
//   `pack: null` with the line telling the agent to tell its person (BL-PRODUCTKNOWLEDGE-4); it never fails
//   the call. The Legal entries (with each owner's login) and the Glossary come with the access itself, as
//   the agent link reads them.
import { knowledgeEntries, type PackText } from 'omni-loop/kit/lib/knowledge/entries.ts';
import { NO_PACK_LINE, type KnowledgeEntry, type RepositoryState } from './product-mcp.contract';
import type { AccessRow, ProductMcpRepository } from './product-mcp.repository';

/** Who a request is: a key served for the product, a key that does not work, or a product not here for it. */
export type Resolution = { kind: 'served'; access: AccessRow } | { kind: 'refused' } | { kind: 'not-here' };

/** What a served key reads: the entries, and the repositories they come from. */
export type KnowledgeRead = { product: string; entries: KnowledgeEntry[]; repositories: RepositoryState[] };

const stateOf = (ref: AccessRow['repositories'][number]): RepositoryState =>
  ref.pack_id !== null && ref.sha !== null && ref.committed_at !== null
    ? { repo: ref.repo, pack: { sha: ref.sha, committedAt: ref.committed_at } }
    : { repo: ref.repo, pack: null, note: NO_PACK_LINE };

export function productMcpService(repository: ProductMcpRepository) {
  /** Each pack's files, read once however many places name it. */
  const filesOf = (ids: readonly string[]): Promise<Map<string, PackText[]>> =>
    Promise.all([...new Set(ids)].map(async (id) => [id, await repository.packFiles(id)] as const)).then((pairs) => new Map(pairs));

  return {
    /** Who `hash` (null: no key of an API key's shape) is for the product `key`. */
    async resolve(hash: string | null, key: string): Promise<Resolution> {
      if (hash === null) return { kind: 'refused' };
      const access = await repository.access(hash, key);
      if (access !== null) return { kind: 'served', access };
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
