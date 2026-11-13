// The `knowledge-embed` job's database (PRD 2728 s4, spec "When a pack lands"), as the service role
// (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`): the App has no person's session.
//
//   sources  for each workspace keeping the pack of `<owner/name>@<commit>` (knowledge_packs): its files
//            (knowledge_pack_files), and, for each live product of that workspace holding the repository
//            (product_repositories, products), whether the repository is its law home (its plan repository,
//            else its only repository: product_law_home()), its live Legal entries, Glossary terms and Never
//            lines. No owner is read: the embedded text leaves the `Owner:` line out (L-GDPR-1, L-GDPR-3)
//   missing  knowledge_vectors_missing(): the hashes of a list the workspace holds no vector for
//   put      knowledge_vectors_put(): the vectors kept; how many were new
//
// Every read is filtered by the repository, its packs' workspaces or their products, so nothing of another
// workspace is read for it (BR-PRODUCT-63). Throws when the database refuses or answers out of shape.
import { z } from 'zod';
import type { EntrySources, PackText } from 'omni-loop/kit/lib/knowledge/entries.ts';
import type { Connection } from '../approved-check/record.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';

/** What one product holding the repository adds to the pack's entries. */
export type ProductRows = {
  /** Whether the repository is the product's law home: its business laws are then built from the pack. */
  lawHome: boolean;
  legal: EntrySources['legal'];
  glossary: EntrySources['glossary'];
  never: EntrySources['never'];
};

/** The pack as one workspace keeps it, and the products of that workspace that hold its repository. */
export type WorkspacePack = { workspace: string; files: PackText[]; products: ProductRows[] };

/** One vector to keep: the hash of the text it was made from, and the vector. */
export type VectorRow = { sha256: string; vector: number[] };

export type EmbedStore = {
  /** Each workspace keeping the pack of `repository` (owner/name) at `sha`; none when no pack is kept. */
  sources: (repository: string, sha: string) => Promise<WorkspacePack[]>;
  /** The hashes of `hashes` the workspace holds no vector of `model` for. */
  missing: (workspace: string, model: string, hashes: readonly string[]) => Promise<string[]>;
  /** Keeps the vectors; how many were new. */
  put: (workspace: string, model: string, rows: readonly VectorRow[]) => Promise<number>;
};

/** PostgREST answers at most this many rows at once. */
const PAGE = 1000;

export const PackRowSchema = z.object({ id: z.string().min(1), workspace_id: z.string().min(1) });
export const FileRowSchema = z.object({ path: z.string(), content: z.string() });
export const HolderRowSchema = z.object({ product_id: z.string().min(1), workspace_id: z.string().min(1), repository: z.string().min(1) });
export const ProductRowSchema = z.object({ id: z.string().min(1), workspace_id: z.string().min(1), plan_repository: z.string().nullable() });
export const LegalRowSchema = z.object({ product_id: z.string().min(1), code: z.string().min(1), number: z.number().int(), statement: z.string(), source: z.string() });
export const TermRowSchema = z.object({ product_id: z.string().min(1), term: z.string(), meaning: z.string(), avoid: z.array(z.string()) });
export const NeverRowSchema = z.object({ product_id: z.string().min(1), seq: z.number().int(), body: z.string() });

type Answer = { data: unknown; error: { message: string; code?: string } | null };

/** Every row a paged read answers, `page` called with each range until a short page. */
async function paged<T>(schema: z.ZodType<T>, page: (from: number, to: number) => PromiseLike<Answer>): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += PAGE) {
    const batch = rowsOf(schema, await page(start, start + PAGE - 1));
    rows.push(...batch);
    if (batch.length < PAGE) return rows;
  }
}

/** The law home of a product: its plan repository, else its only repository, else none (product_law_home()). */
export function lawHomeOf(planRepository: string | null, repositories: readonly string[]): string | null {
  if (planRepository !== null) return planRepository.toLowerCase();
  return repositories.length === 1 ? (repositories[0] ?? null) : null;
}

/** The store, as the service role on `connection`. */
export function knowledgeEmbedStore(connection: Connection): EmbedStore {
  const db = serviceDb(connection);

  /** The live products of `ids`, each with what it adds; by workspace. */
  async function productRows(repository: string, ids: string[]): Promise<Map<string, ProductRows[]>> {
    const byWorkspace = new Map<string, ProductRows[]>();
    if (ids.length === 0) return byWorkspace;
    const products = rowsOf(ProductRowSchema, await db.from('products').select('id, workspace_id, plan_repository').in('id', ids).is('archived_at', null));
    const live = products.map((p) => p.id);
    if (live.length === 0) return byWorkspace;
    const [links, legal, glossary, never] = await Promise.all([
      paged(HolderRowSchema, (from, to) => db.from('product_repositories').select('product_id, workspace_id, repository').in('product_id', live).order('repository').range(from, to)),
      paged(LegalRowSchema, (from, to) =>
        db.from('product_legal').select('product_id, code, number, statement, source').in('product_id', live).is('retired_at', null).order('code').order('number').range(from, to)),
      paged(TermRowSchema, (from, to) =>
        db.from('product_glossary').select('product_id, term, meaning, avoid').in('product_id', live).is('removed_at', null).order('term').range(from, to)),
      paged(NeverRowSchema, (from, to) =>
        db.from('constituents').select('product_id, seq, body').in('product_id', live).eq('kind', 'never').is('removed_at', null).order('seq').range(from, to)),
    ]);
    for (const product of products) {
      const home = lawHomeOf(product.plan_repository, links.filter((l) => l.product_id === product.id).map((l) => l.repository));
      const rows: ProductRows = {
        lawHome: home === repository,
        legal: legal.filter((l) => l.product_id === product.id).map((l) => ({ id: `L-${l.code}-${String(l.number)}`, statement: l.statement, source: l.source, owner: null })),
        glossary: glossary.filter((g) => g.product_id === product.id).map(({ term, meaning, avoid }) => ({ term, meaning, avoid })),
        never: never.filter((n) => n.product_id === product.id).map(({ seq, body }) => ({ seq, body })),
      };
      byWorkspace.set(product.workspace_id, [...(byWorkspace.get(product.workspace_id) ?? []), rows]);
    }
    return byWorkspace;
  }

  return {
    sources: async (repo, sha) => {
      const repository = repo.toLowerCase();
      const packs = rowsOf(PackRowSchema, await db.from('knowledge_packs').select('id, workspace_id').eq('repository', repository).eq('sha', sha));
      if (packs.length === 0) return [];
      const workspaces = packs.map((p) => p.workspace_id);
      const holders = rowsOf(HolderRowSchema, await db.from('product_repositories').select('product_id, workspace_id, repository').eq('repository', repository).in('workspace_id', workspaces));
      const products = await productRows(repository, [...new Set(holders.map((h) => h.product_id))]);
      const kept: WorkspacePack[] = [];
      for (const pack of packs) {
        const files = await paged(FileRowSchema, (from, to) => db.from('knowledge_pack_files').select('path, content').eq('pack_id', pack.id).order('path').range(from, to));
        kept.push({ workspace: pack.workspace_id, files, products: products.get(pack.workspace_id) ?? [] });
      }
      return kept;
    },

    missing: async (workspace, model, hashes) => {
      if (hashes.length === 0) return [];
      const { data, error } = await db.rpc('knowledge_vectors_missing', { p_workspace: workspace, p_model: model, p_hashes: [...hashes] });
      if (error) throw new Error(`the database refused: ${error.message}${error.code ? ` (${error.code})` : ''}`);
      return z.array(z.string()).parse(data);
    },

    put: async (workspace, model, rows) => {
      if (rows.length === 0) return 0;
      const { data, error } = await db.rpc('knowledge_vectors_put', { p_workspace: workspace, p_model: model, p_rows: rows.map(({ sha256, vector }) => ({ sha256, vector })) });
      if (error) throw new Error(`the database refused: ${error.message}${error.code ? ` (${error.code})` : ''}`);
      return z.number().int().nonnegative().parse(data);
    },
  };
}
