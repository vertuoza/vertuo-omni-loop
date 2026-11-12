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
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

/** What the reads need: the tables and the functions. */
export type ProductMcpDb = Pick<SupabaseClient, 'from' | 'rpc'>;

/** PostgREST answers at most this many rows at once. */
const PAGE = 1000;

const PackRef = z.object({
  repo: z.string().min(1),
  pack_id: z.string().nullable(),
  sha: z.string().nullable(),
  committed_at: z.string().nullable(),
});

const LegalRow = z.object({ id: z.string(), statement: z.string(), source: z.string(), owner: z.string().nullable() });
const TermRow = z.object({ term: z.string(), meaning: z.string(), avoid: z.array(z.string()) });

const AccessRow = z.object({
  product: z.object({ id: z.string(), key: z.string(), name: z.string(), workspace_id: z.string() }),
  repositories: z.array(PackRef),
  law_home: PackRef.nullable(),
  // product_knowledge_for_agents() of the product, as the agent link reads it: the Legal entries with each
  // owner's login, and the Glossary. Its other keys are not read here.
  knowledge: z.object({ legal: z.array(LegalRow), glossary: z.array(TermRow) }),
});
/** What product_mcp_for_key() answers for a key that reads the product. */
export type AccessRow = z.infer<typeof AccessRow>;

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

    /** Whether `hash` names a live API key whose maker is still a member (api_key_of()). */
    keyLive: async (hash: string): Promise<boolean> =>
      (await read(db.rpc('api_key_of', { p_hash: hash }), z.unknown(), 'api_key_of')) !== null,

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

    /** The `k` hashes among `hashes` holding a vector, nearest to `query` first. */
    nearest: async (workspace: string, model: string, hashes: readonly string[], query: readonly number[], k: number): Promise<string[]> =>
      (await read(
        db.rpc('knowledge_nearest', { p_workspace: workspace, p_model: model, p_hashes: hashes, p_query: asVector(query), p_k: k }),
        z.array(NearRow),
        'knowledge_nearest',
      )).map((row) => row.text_sha256),
  };
}

export type KnowledgeVectorsRepository = ReturnType<typeof knowledgeVectorsRepository>;
