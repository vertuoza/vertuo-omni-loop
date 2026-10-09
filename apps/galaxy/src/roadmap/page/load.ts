// The Roadmaps pages' read (PRD 1162), as the signed-in person, so row-level security decides what each
// read returns: a member reads their workspace's roadmaps and their PRDs (s2's migration). First the
// workspace the person joined first, as the Loop page heads its list; with none, the no-workspace
// notice, and when it cannot be read, a line saying so. Then the list, each roadmap with its PRDs, or
// one roadmap with its PRDs; a roadmap of another workspace, or none, is not found. The workspace's
// products name each roadmap's and fill the filter; they fail soft, their error logged: no product
// then shows. Each roadmap's human work (PRD 1217) is read beside its PRDs; a failed read is none, as
// the store's reads are. The reads are a port (RoadmapPageReads) so the loader is tested on fakes;
// supabaseRoadmapPageReads is the page's.
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { z } from 'zod';
import { messageOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { Database } from '../../../../../supabase/database.types.ts';
import { orThrow, parseRows } from '../../data/parse-rows';
import { memberWorkspace, type Workspace } from '../../data/workspace';
import { roadmapReader, type RoadmapHumanWorkRow, type RoadmapPrdRow, type RoadmapPrerequisiteRow, type RoadmapRow } from '../store';
import { detailOf, listOf, type ProductRef, type RoadmapPageView, type RoadmapRead } from './model';
import type { RoadmapTab } from './prerequisites';

export interface RoadmapPageReads {
  /** The workspace the person joined first, or null for none. */
  workspace(): Promise<Workspace | null>;
  /** Every roadmap the person may read, the most recently pushed first. */
  roadmaps(): Promise<RoadmapRow[]>;
  /** One roadmap, or null when it does not exist or is another workspace's. */
  roadmap(id: string): Promise<RoadmapRow | null>;
  /** A roadmap's PRDs, in its table's order. */
  prds(id: string): Promise<RoadmapPrdRow[]>;
  /** A roadmap's human work, the open first. */
  humanWork(id: string): Promise<RoadmapHumanWorkRow[]>;
  /** A roadmap's prerequisites, in its table's order, each with the last result's state (PRD 1218). */
  prerequisites(id: string): Promise<RoadmapPrerequisiteRow[]>;
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

/** A roadmap with its PRDs and its human work. */
async function readOf(reads: RoadmapPageReads, row: RoadmapRow): Promise<RoadmapRead> {
  const [prds, humanWork] = await Promise.all([reads.prds(row.id), reads.humanWork(row.id)]);
  return { row, prds, humanWork };
}

/** What the page asks for: the list (`id` null), only one product's when `product` is set, or one roadmap,
 * on the tab `?tab=` names (Overview when none). And Mark as done (s7): whether the route offers it, the
 * row just ticked (`?ticked=`) and why one was not posted (`?tick_error=`). */
export type RoadmapPageAsk = {
  id: string | null; product: string | null; tab?: RoadmapTab;
  tickable?: boolean; ticked?: string | null; tickError?: string | null;
};

/** The list or one roadmap; `not-found` for a roadmap the workspace does not hold. */
/** The person's workspace, or the view that says why there is none to read. */
async function workspaceOf(reads: RoadmapPageReads): Promise<Workspace | { kind: 'unreadable' | 'no-workspace' }> {
  const read = await reads.workspace().catch((error: unknown) => {
    console.error(`roadmaps: your workspace could not be read (${messageOf(error)})`);
    return 'unreadable' as const;
  });
  if (read === 'unreadable') return { kind: read };
  return read ?? { kind: 'no-workspace' };
}

export async function loadRoadmapPage(reads: RoadmapPageReads, ask: RoadmapPageAsk, now: Date): Promise<RoadmapPageView | { kind: 'not-found' }> {
  const workspace = await workspaceOf(reads);
  if ('kind' in workspace) return workspace;
  const { id } = workspace;
  if (ask.id === null) {
    const [rows, products] = await Promise.all([reads.roadmaps(), productsOf(reads, id)]);
    const ours = rows.filter((r) => r.workspace_id === id);
    const read = await Promise.all(ours.map((row) => readOf(reads, row)));
    return listOf(workspace.name, null, read, products, ask.product);
  }
  const row = await reads.roadmap(ask.id);
  if (!row || row.workspace_id !== id) return { kind: 'not-found' };
  const [read, products, prerequisites] = await Promise.all([readOf(reads, row), productsOf(reads, id), reads.prerequisites(row.id)]);
  const tick = { tickable: ask.tickable ?? false, ticked: ask.ticked ?? null, tickError: ask.tickError ?? null };
  const roadmap = detailOf(read, products, now.getTime(), { prerequisites, tab: ask.tab ?? 'overview', tick });
  return { kind: 'roadmap', name: workspace.name, demo: null, roadmap };
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
    humanWork: (id) => roadmaps.humanWork(id),
    prerequisites: (id) => roadmaps.prerequisites(id),
    async products(workspace) {
      const { data, error } = await db.from('products').select(PRODUCT_COLUMNS).eq('workspace_id', workspace).order('ordinal');
      if (error) throw new Error(error.message);
      return orThrow(parseRows(ProductRow, data, 'roadmap/page/load: products'));
    },
  };
}
