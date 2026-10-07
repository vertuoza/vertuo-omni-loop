// The Roadmaps pages' read (PRD 1162), as the signed-in person, so row-level security decides what each
// read returns: a member reads their workspace's roadmaps and their PRDs (s2's migration). First the
// workspace the person joined first, as the Loop page heads its list; with none, the no-workspace
// notice, and when it cannot be read, a line saying so. Then the list, each roadmap with its PRDs, or
// one roadmap with its PRDs; a roadmap of another workspace, or none, is not found. The workspace's
// products name each roadmap's and fill the filter; they fail soft, their error logged: no product
// then shows. The reads are a port (RoadmapPageReads) so the loader is tested on fakes;
// supabaseRoadmapPageReads is the page's.
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { z } from 'zod';
import { messageOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { Database } from '../../../../../supabase/database.types.ts';
import { orThrow, parseRows } from '../../data/parse-rows';
import { memberWorkspace, type Workspace } from '../../data/workspace';
import { roadmapReader, type RoadmapPrdRow, type RoadmapRow } from '../store';
import { detailOf, listOf, type ProductRef, type RoadmapPageView } from './model';

export interface RoadmapPageReads {
  /** The workspace the person joined first, or null for none. */
  workspace(): Promise<Workspace | null>;
  /** Every roadmap the person may read, the most recently pushed first. */
  roadmaps(): Promise<RoadmapRow[]>;
  /** One roadmap, or null when it does not exist or is another workspace's. */
  roadmap(id: string): Promise<RoadmapRow | null>;
  /** A roadmap's PRDs, in its table's order. */
  prds(id: string): Promise<RoadmapPrdRow[]>;
  /** The workspace's products, first first. */
  products(workspace: string): Promise<ProductRef[]>;
}

async function productsOf(reads: RoadmapPageReads, workspace: string): Promise<ProductRef[]> {
  try {
    return await reads.products(workspace);
  } catch (error) {
    console.error(`roadmaps: the workspace's products could not be read (${messageOf(error)})`);
    return [];
  }
}

/** What the page asks for: the list (`id` null), only one product's when `product` is set, or one roadmap. */
export type RoadmapPageAsk = { id: string | null; product: string | null };

/** The list or one roadmap; `not-found` for a roadmap the workspace does not hold. */
export async function loadRoadmapPage(reads: RoadmapPageReads, ask: RoadmapPageAsk, now: Date): Promise<RoadmapPageView | { kind: 'not-found' }> {
  let workspace: Workspace | null;
  try {
    workspace = await reads.workspace();
  } catch (error) {
    console.error(`roadmaps: your workspace could not be read (${messageOf(error)})`);
    return { kind: 'unreadable' };
  }
  if (!workspace) return { kind: 'no-workspace' };
  const { id } = workspace;
  if (ask.id === null) {
    const [rows, products] = await Promise.all([reads.roadmaps(), productsOf(reads, id)]);
    const ours = rows.filter((r) => r.workspace_id === id);
    const withPrds = await Promise.all(ours.map(async (row) => ({ row, prds: await reads.prds(row.id) })));
    return listOf(workspace.name, null, withPrds, products, ask.product);
  }
  const row = await reads.roadmap(ask.id);
  if (!row || row.workspace_id !== id) return { kind: 'not-found' };
  const [prds, products] = await Promise.all([reads.prds(row.id), productsOf(reads, id)]);
  return { kind: 'roadmap', name: workspace.name, demo: null, roadmap: detailOf(row, prds, products, now.getTime()) };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A roadmap's id as a path names it, or null when it cannot name one. */
export const roadmapIdOf = (part: string): string | null => (UUID.test(part) ? part.toLowerCase() : null);

/** A product's id as the filter names it, or null for every product. */
export const productOf = (value: string | null): string | null => (value !== null && UUID.test(value) ? value.toLowerCase() : null);

/** A product as the page reads it. */
export const ProductRow = z.strictObject({ id: z.string(), name: z.string() });
export const PRODUCT_COLUMNS = 'id, name';

/** The page's reads, from Supabase, as the signed-in person. */
export function supabaseRoadmapPageReads(db: SupabaseClient<Database>, user: Pick<User, 'id'>): RoadmapPageReads {
  const roadmaps = roadmapReader(db);
  return {
    workspace: () => memberWorkspace(db, user.id),
    roadmaps: () => roadmaps.list(),
    roadmap: (id) => roadmaps.roadmap(id),
    prds: (id) => roadmaps.prds(id),
    async products(workspace) {
      const { data, error } = await db.from('products').select(PRODUCT_COLUMNS).eq('workspace_id', workspace).order('ordinal');
      if (error) throw new Error(error.message);
      return orThrow(parseRows(ProductRow, data, 'roadmap/page/load: products'));
    },
  };
}
