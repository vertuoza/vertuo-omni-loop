// A product's MCP server's storage (PRD 2707 s3; ADR-0095), on the client it is given: the service role's,
// since an API key is no person's session and product_mcp_for_key() is the service role's alone
// (supabase/migrations/20270114090000_product_mcp.sql). That function checks the key, its maker's
// membership, the product's workspace, its switch and the key's allow-list on every call; every other read
// here is filtered by the product and the packs it answered, so a read never reaches past them. Every answer
// is parsed where it comes in; a refusal of the database, or an answer out of shape, throws, naming the call.
// It holds no rule.
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

const AccessRow = z.object({
  product: z.object({ id: z.string(), key: z.string(), name: z.string(), workspace_id: z.string() }),
  repositories: z.array(PackRef),
  law_home: PackRef.nullable(),
});
/** What product_mcp_for_key() answers for a key that reads the product. */
export type AccessRow = z.infer<typeof AccessRow>;

const FileRow = z.object({ path: z.string(), content: z.string() });
const LegalRow = z.object({ code: z.string(), number: z.number().int(), statement: z.string(), source: z.string(), owner_id: z.string().nullable() });
const TermRow = z.object({ term: z.string(), meaning: z.string(), avoid: z.array(z.string()) });
const NeverRow = z.object({ seq: z.number().int(), body: z.string() });

/** The product's own rows, as the agents' read keeps them: live entries only. */
export type ProductRows = {
  legal: { id: string; statement: string; source: string; ownerId: string | null }[];
  glossary: z.infer<typeof TermRow>[];
  never: z.infer<typeof NeverRow>[];
};

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

    /** The product's live Legal entries, Glossary terms and Never lines. */
    async rows(productId: string): Promise<ProductRows> {
      const [legal, glossary, never] = await Promise.all([
        read(db.from('product_legal').select('code, number, statement, source, owner_id').eq('product_id', productId).is('retired_at', null),
          z.array(LegalRow), 'product_legal'),
        read(db.from('product_glossary').select('term, meaning, avoid').eq('product_id', productId).is('removed_at', null),
          z.array(TermRow), 'product_glossary'),
        read(db.from('constituents').select('seq, body').eq('product_id', productId).eq('kind', 'never').is('removed_at', null),
          z.array(NeverRow), 'constituents'),
      ]);
      return {
        legal: legal.map((row) => ({ id: `L-${row.code}-${String(row.number)}`, statement: row.statement, source: row.source, ownerId: row.owner_id })),
        glossary,
        never,
      };
    },

    /** A member's login in the workspace, as the agents' read names a Legal entry's owner (member_login()). */
    login: async (workspaceId: string, userId: string): Promise<string | null> =>
      read(db.rpc('member_login', { p_workspace: workspaceId, p_user: userId }), z.string().nullable(), 'member_login'),
  };
}

export type ProductMcpRepository = ReturnType<typeof productMcpRepository>;
