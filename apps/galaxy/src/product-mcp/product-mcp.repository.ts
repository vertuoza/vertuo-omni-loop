// A product's MCP server's storage (PRD 2707 s3; ADR-0095), on the client it is given: the service role's,
// since an API key is no person's session and product_mcp_for_key() is the service role's alone
// (supabase/migrations/20270115090000_product_mcp.sql). That function checks the key, its maker's
// membership, the product's workspace, its switch and the key's allow-list on every call; every other read
// here is filtered by the product and the packs it answered, so a read never reaches past them. The Legal
// entries and the Glossary come in its answer, read by product_knowledge_for_agents() inside the database, so
// no table of personal data is read here. Every answer
// is parsed where it comes in; a refusal of the database, or an answer out of shape, throws, naming the call.
// It holds no rule.
//
// The knowledge's vectors (PRD 2728 s5) are read and written through knowledge_vectors_missing(),
// knowledge_vectors_put() and knowledge_nearest() (supabase/migrations/20270118090000_knowledge_vectors.sql),
// the service role's alone, each taking the workspace and reading only its rows (BR-PRODUCT-63). They are
// asked only once the key check has served the request.
//
// A kept access (bug #2954, access-cache.ts) is checked on every call with three small reads instead of the
// whole answer: api_key_of() for the key's id, the product's row for its switch, and the newest pack of each
// repository it names (knowledge_packs, through its unique index on the workspace, repository and newest).
//
// The search log (PRD omni-loop-6 s1) is one insert into mcp_search_log
// (supabase/migrations/20270119090000_mcp_search_log.sql), which only the service role may write: a row holds
// the API key's id, which product_mcp_for_key() answers as `key_id`, never the key.
//
// A member's kit sign-in (PRD 3007 s1), once the Auth server has checked its token in the controller, reads
// through product_mcp_for_member() (supabase/migrations/20270126090000_product_mcp_member.sql), the service
// role's alone, which checks the person's membership of the product's workspace, the product's switch and its
// archive on every call. A kept member's access is checked with the person's membership row instead of
// api_key_of(). The person's search log row holds their id (`user_id`) and no key.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SearchLogBy, SearchLogRow } from './product-mcp.contract';
import { AccessRow, MemberAccessRow } from './access-row';
import { z } from 'zod';

/** What the reads need: the tables and the functions. */
export type ProductMcpDb = Pick<SupabaseClient, 'from' | 'rpc'>;

/** PostgREST answers at most this many rows at once. */
const PAGE = 1000;

export type { AccessRow, MemberAccessRow, ProductAccess } from './access-row';

const FileRow = z.object({ path: z.string(), content: z.string() });
const NeverRow = z.object({ seq: z.number().int(), body: z.string() });
/** One of the product's live Never lines. */
type NeverLine = z.infer<typeof NeverRow>;

type Raw = { data: unknown; error: { message?: string } | null };

/** The answer `call` gave, read by `schema`, or a throw naming `where`. */
async function read<T>(call: PromiseLike<Raw>, schema: z.ZodType<T>, where: string): Promise<T> {
  const { data, error } = await call;
  if (error) throw new Error(`${where}: the database refused: ${error.message ?? 'no message'}`);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`${where} answered out of shape`);
  return parsed.data;
}

export function productMcpRepository(db: ProductMcpDb) {
  return {
    /** What the key whose SHA-256 is `hash` reads of the product `key`, or null (product_mcp_for_key()). */
    access: (hash: string, key: string): Promise<AccessRow | null> =>
      read(db.rpc('product_mcp_for_key', { p_hash: hash, p_key: key }), AccessRow.nullable(), 'product_mcp_for_key'),

    /** What the member `userId` reads of the product `key`, or null (product_mcp_for_member(), PRD 3007 s1). */
    memberAccess: (userId: string, key: string): Promise<MemberAccessRow | null> =>
      read(db.rpc('product_mcp_for_member', { p_user: userId, p_key: key }), MemberAccessRow.nullable(), 'product_mcp_for_member'),

    /** Whether `userId` is a member of the workspace `workspace` now (PRD 3007 s1). */
    isMember: async (userId: string, workspace: string): Promise<boolean> =>
      (await read(db.from('workspace_members').select('user_id').eq('workspace_id', workspace).eq('user_id', userId).limit(1),
        z.array(z.object({ user_id: z.string() })), 'workspace_members')).length > 0,

    /** Whether `hash` names a live API key whose maker is still a member (api_key_of()). */
    keyLive: async (hash: string): Promise<boolean> =>
      (await read(db.rpc('api_key_of', { p_hash: hash }), z.unknown(), 'api_key_of')) !== null,

    /** The id of the live API key whose SHA-256 is `hash` and whose maker is still a member, or null (api_key_of()). */
    keyIdOf: async (hash: string): Promise<string | null> =>
      (await read(db.rpc('api_key_of', { p_hash: hash }), z.object({ key_id: z.string() }).nullable(), 'api_key_of'))?.key_id ?? null,

    /** Whether the product `productId` still has its MCP server on and is not archived. */
    productOpen: async (productId: string): Promise<boolean> =>
      (await read(db.from('products').select('id').eq('id', productId).eq('mcp_enabled', true).is('archived_at', null),
        z.array(z.object({ id: z.string() })), 'products')).length > 0,

    /** The id of the newest pack of each of `repos` in the workspace; a repository with none is absent. */
    async newestPacks(workspace: string, repos: readonly string[]): Promise<Map<string, string>> {
      if (repos.length === 0) return new Map();
      const rows = await read(
        db.from('knowledge_packs').select('repository, id').eq('workspace_id', workspace).eq('newest', true).in('repository', [...repos]),
        z.array(z.object({ repository: z.string(), id: z.string() })),
        'knowledge_packs',
      );
      return new Map(rows.map((row) => [row.repository, row.id]));
    },

    /** Every file of the pack, in path order, a page at a time. */
    async packFiles(packId: string): Promise<z.infer<typeof FileRow>[]> {
      const files: z.infer<typeof FileRow>[] = [];
      for (let start = 0; ; start += PAGE) {
        const page = await read(
          db.from('knowledge_pack_files').select('path, content').eq('pack_id', packId).order('path').range(start, start + PAGE - 1),
          z.array(FileRow),
          'knowledge_pack_files',
        );
        files.push(...page);
        if (page.length < PAGE) return files;
      }
    },

    /** The product's live Never lines (no personal data: product_knowledge_for_agents() does not carry them). */
    never: (productId: string): Promise<NeverLine[]> =>
      read(db.from('constituents').select('seq, body').eq('product_id', productId).eq('kind', 'never').is('removed_at', null),
        z.array(NeverRow), 'constituents'),
  };
}

export type ProductMcpRepository = ReturnType<typeof productMcpRepository>;

const NearRow = z.object({ text_sha256: z.string(), distance: z.number() });

/** A vector as knowledge_nearest() takes it: pgvector's text form. */
const asVector = (vector: readonly number[]): string => JSON.stringify(vector);

/** The workspace's vectors of one model, on the service role's client. */
export function knowledgeVectorsRepository(db: ProductMcpDb) {
  return {
    /** The hashes among `hashes` with no vector yet, each once, in the list's order. */
    missing: (workspace: string, model: string, hashes: readonly string[]): Promise<string[]> =>
      read(db.rpc('knowledge_vectors_missing', { p_workspace: workspace, p_model: model, p_hashes: hashes }), z.array(z.string()), 'knowledge_vectors_missing'),

    /** Keeps the vectors of `rows`; one malformed row refuses them all. */
    async put(workspace: string, model: string, rows: readonly { sha256: string; vector: readonly number[] }[]): Promise<void> {
      await read(db.rpc('knowledge_vectors_put', { p_workspace: workspace, p_model: model, p_rows: rows }), z.number().int(), 'knowledge_vectors_put');
    },

    /** The `k` hashes among `hashes` holding a vector, nearest to `query` first, each with its cosine distance. */
    nearest: async (workspace: string, model: string, hashes: readonly string[], query: readonly number[], k: number): Promise<{ hash: string; distance: number }[]> =>
      (await read(
        db.rpc('knowledge_nearest', { p_workspace: workspace, p_model: model, p_hashes: hashes, p_query: asVector(query), p_k: k }),
        z.array(NearRow),
        'knowledge_nearest',
      )).map((row) => ({ hash: row.text_sha256, distance: row.distance })),
  };
}

export type KnowledgeVectorsRepository = ReturnType<typeof knowledgeVectorsRepository>;

/** A get_knowledge opens a search asked at most this long before it (PRD omni-loop-6 s2). */
const OPEN_WINDOW_MS = 10 * 60 * 1000;

/** The search log of a product's MCP, on the service role's client. */
export function searchLogRepository(db: ProductMcpDb) {
  return {
    /** Adds one row; a refusal throws, naming the table. */
    async add(row: SearchLogRow): Promise<void> {
      // A key's row or a member's, as one set of columns: the client's insert takes no union of rows.
      const values: Record<string, unknown> = row;
      await read(db.from('mcp_search_log').insert(values), z.unknown(), 'mcp_search_log');
    },

    /**
     * PRD omni-loop-6 s2: a get_knowledge of `id` from the caller `by` (a key, or a member: PRD 3007 s1) on
     * `productId`, asked at `askedAt`, marks the latest search of that caller and product within the 10 minutes
     * before it that returned `id` and has no opened rank yet: its opened id, and the 1-based rank of `id` among
     * its hits. Sets nothing when no search qualifies.
     */
    async open(by: SearchLogBy, productId: string, id: string, askedAt: string): Promise<void> {
      const since = new Date(Date.parse(askedAt) - OPEN_WINDOW_MS).toISOString();
      const [column, caller] = 'user_id' in by ? ['user_id', by.user_id] : ['api_key_id', by.api_key_id];
      const searches = await read(
        db.from('mcp_search_log').select('id, hit_ids').eq(column, caller).eq('product_id', productId)
          .eq('tool', 'search_knowledge').is('opened_id', null).gte('asked_at', since).lte('asked_at', askedAt)
          .order('asked_at', { ascending: false }).limit(50),
        z.array(z.object({ id: z.string(), hit_ids: z.array(z.string()) })),
        'mcp_search_log',
      );
      for (const search of searches) {
        const at = search.hit_ids.indexOf(id);
        if (at < 0) continue;
        await read(db.from('mcp_search_log').update({ opened_id: id, opened_rank: at + 1 }).eq('id', search.id), z.unknown(), 'mcp_search_log');
        return;
      }
    },
  };
}
