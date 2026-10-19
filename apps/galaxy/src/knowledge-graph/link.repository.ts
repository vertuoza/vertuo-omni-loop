// The agent link's read of its product's knowledge graph (PRD 1798 s4; ADR-0095), on the client it is
// given: one acting as nobody (the anon key), since the link's token is no Supabase session and reads
// nothing through row-level security. knowledge_graph_for_token() checks the token in the database and
// reads for it, as business_for_token() reads the business (ADR-0051,
// supabase/migrations/20261216090000_knowledge_graph_for_token.sql): the product the link resolves for
// the repository, its links, Legal entries, terms and Never lines, and the latest graph of each
// own-knowledge link, the same rows s3's reader reads as a member (./product-graph.repository.ts), so
// one join and one walk serve both. Its answer is parsed where it comes in, each graph by the kit's own
// schema; a refusal is answered as the database's code and one line, an out-of-shape answer throws.
import { z } from 'zod';
import { RepositoryGraphSchema } from 'vertuo-omni-plan/kit/lib/knowledge/graph-schema.ts';
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { orThrow, parseRow } from '../data/parse-rows';

/** The one call the read makes: a database function by name, as nobody. */
export type LinkGraphDb = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

const LinkGraphBundleSchema = z.object({
  product: z.object({ id: z.string().min(1), key: z.string().nullable(), name: z.string() }),
  links: z.array(z.object({ repository: z.string().min(1), knowledge: z.enum(['own', 'imported', 'none']) })),
  legal: z.array(z.object({ code: z.string().min(1), number: z.number().int(), statement: z.string(), retired_at: z.string().nullable() })),
  glossary: z.array(z.object({ term: z.string().min(1), meaning: z.string(), removed_at: z.string().nullable() })),
  never: z.array(z.object({ seq: z.number().int(), body: z.string(), removed_at: z.string().nullable() })),
  graphs: z.array(z.object({
    repository: z.string().min(1),
    sha: z.string().min(1),
    graph: RepositoryGraphSchema,
    pushed_at: z.string().min(1),
    pushed_by_login: z.string().nullable(),
  })),
});
/** What the link reads of its product: the product, and the rows the join reads. */
export type LinkGraphBundle = z.infer<typeof LinkGraphBundleSchema>;

/** The read: the product's rows, or the database's refusal (its SQLSTATE and its one line). */
export type LinkGraphAnswer = { ok: true; bundle: LinkGraphBundle } | { ok: false; code: string | undefined; reason: string };

/** A string field of a PostgREST error, when it has one. */
function fieldOf(error: unknown, name: string): string | undefined {
  const value = propertyOf(error, name);
  return typeof value === 'string' ? value : undefined;
}

export function linkGraphRepository(db: LinkGraphDb) {
  return {
    /** What the link whose token hashes to `hash` reads of its product, for `repo` (owner/name) or its only product. */
    async read(hash: string, repo: string | null): Promise<LinkGraphAnswer> {
      const { data, error } = await db.rpc('knowledge_graph_for_token', { p_hash: hash, p_repo: repo });
      if (error) return { ok: false, code: fieldOf(error, 'code'), reason: fieldOf(error, 'message') ?? 'no answer' };
      return { ok: true, bundle: orThrow(parseRow(LinkGraphBundleSchema, data, 'knowledge-graph: knowledge_graph_for_token')) };
    },
  };
}

export type LinkGraphRepository = ReturnType<typeof linkGraphRepository>;
