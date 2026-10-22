// The Roadmaps pages' read (PRD 1162), as the signed-in person, so row-level security decides what each
// read returns: a member reads their workspace's roadmaps and their PRDs (s2's migration). First the
// workspace the person joined first, as the Loop page heads its list; with none, the no-workspace
// notice, and when it cannot be read, a line saying so. Then the list, each roadmap with its PRDs, or
// one roadmap with its PRDs; a roadmap of another workspace, or none, is not found. The workspace's
// products name each roadmap's and fill the filter; they fail soft, their error logged: no product
// then shows. Each roadmap's human work (PRD 1217) is read beside its PRDs; a failed read is none, as
// the store's reads are. The reads are a port (RoadmapPageReads) so the loader is tested on fakes;
// supabaseRoadmapPageReads is the page's.
//
// A PRD's row is as the last `omni roadmap push` left it, and a person's merge after the drive stopped
// is never pushed (#2258). So a row not merged whose PRD the app recorded shipped (its feature PR
// merged, from the merge event or the sync) reads as merged, ended at that merge. A row closed unmerged
// stays closed, as the push reads it; stages that cannot be read leave the rows as pushed, logged.
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { z } from 'zod';
import { PrdNumberSchema, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { messageOf } from 'omni-loop/kit/lib/narrow.ts';
import type { Database } from '../../../../../supabase/database.types.ts';
import { orThrow, parseRows } from '../../data/parse-rows';
import { memberWorkspace, type Workspace } from '../../data/workspace';
import { readRoadmapRecord } from '../../dossier/page/RoadmapRecordRead';
import type { RoadmapRecordRead, VersionPick } from '../../dossier/page/RoadmapRecord';
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
  /** When each of these PRDs of the repository reached its shipped stage, for those that did (#2258). */
  shipped(workspace: string, repository: string, prds: readonly PrdNumber[]): Promise<Map<PrdNumber, string>>;
  /** A roadmap's human work, the open first. */
  humanWork(id: string): Promise<RoadmapHumanWorkRow[]>;
  /** A roadmap's prerequisites, in its table's order, each with the last result's state (PRD 1218). */
  prerequisites(id: string): Promise<RoadmapPrerequisiteRow[]>;
  /** The workspace's products, first first. */
  products(workspace: string): Promise<ProductRef[]>;
  /** The number on its product (3 in `mobile-R3`) of each of these roadmap dossiers (PRD 2011). */
  seqs(dossiers: readonly string[]): Promise<Map<string, number>>;
  /** The roadmap born on the server whose dossier is `dossier`, or null. */
  roadmapOfDossier(dossier: string): Promise<RoadmapRow | null>;
  /** A roadmap dossier's record: its versions, approval and the text of the version `pick` names; null when unreadable. */
  record(dossier: string, pick: VersionPick): Promise<RoadmapRecordRead | null>;
}

async function productsOf(reads: RoadmapPageReads, workspace: string): Promise<ProductRef[]> {
  try {
    return await reads.products(workspace);
  } catch (error) {
    console.error(`roadmaps: the workspace's products could not be read (${messageOf(error)})`);
    return [];
  }
}

/** The numbers on their product of the dossiers `rows` hold; fail soft, their error logged: no id then shows. */
async function seqsOf(reads: RoadmapPageReads, rows: readonly RoadmapRow[]): Promise<Map<string, number>> {
  const dossiers = rows.flatMap((r) => (r.dossier_id ? [r.dossier_id] : []));
  if (dossiers.length === 0) return new Map();
  try {
    return await reads.seqs(dossiers);
  } catch (error) {
    console.error(`roadmaps: the product roadmaps' numbers could not be read (${messageOf(error)})`);
    return new Map();
  }
}

/** `prds` with each one the app recorded shipped since the push read as merged, ended at its merge. */
async function mergedSincePush(reads: RoadmapPageReads, row: RoadmapRow, prds: RoadmapPrdRow[]): Promise<RoadmapPrdRow[]> {
  const { repo } = row;
  const pending = prds.flatMap((p) => (p.prd !== null && p.state !== 'merged' && p.state !== 'closed' ? [p.prd] : []));
  if (repo === null || pending.length === 0) return prds;
  const shipped = await reads.shipped(row.workspace_id, repo, pending).catch((error: unknown) => {
    console.error(`roadmaps: the shipped PRDs of ${repo} could not be read (${messageOf(error)})`);
    return new Map<PrdNumber, string>();
  });
  return prds.map((p) => {
    const at = p.prd === null || p.state === 'closed' ? undefined : shipped.get(p.prd);
    return at === undefined ? p : { ...p, state: 'merged', waits_on: null, waits_on_url: null, ended_at: p.ended_at ?? at };
  });
}

/** A roadmap with its PRDs and its human work. */
async function readOf(reads: RoadmapPageReads, row: RoadmapRow, seqs: ReadonlyMap<string, number>): Promise<RoadmapRead> {
  const [pushed, humanWork] = await Promise.all([reads.prds(row.id), reads.humanWork(row.id)]);
  const prds = await mergedSincePush(reads, row, pushed);
  return { row, seq: row.dossier_id ? seqs.get(row.dossier_id) ?? null : null, prds, humanWork };
}

/** What the page asks for: the list (`id` null), only one product's when `product` is set, or one roadmap,
 * on the tab `?tab=` names (Overview when none). And Mark as done (s7): whether the route offers it, the
 * row just ticked (`?ticked=`) and why one was not posted (`?tick_error=`). */
export type RoadmapPageAsk = {
  id: string | null; product: string | null; tab?: RoadmapTab;
  /** A product roadmap's version asked for (`?part=`, `?v=`), and the viewer. */
  version?: VersionPick; me?: string | null;
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
    const seqs = await seqsOf(reads, ours);
    const read = await Promise.all(ours.map((row) => readOf(reads, row, seqs)));
    return listOf(workspace.name, null, read, products, ask.product);
  }
  // A roadmap is found by its own id, or by its dossier's when it was born on the server (PRD 2011): the
  // approval route answers with the dossier's.
  const row = (await reads.roadmap(ask.id)) ?? (await reads.roadmapOfDossier(ask.id));
  if (!row || row.workspace_id !== id) return { kind: 'not-found' };
  return { kind: 'roadmap', name: workspace.name, demo: null, roadmap: await detailFor(reads, row, id, ask, now) };
}

/** What a roadmap is asked: one born on the server (PRD 2011) has the Versions tab and no issue to comment on,
 * so nothing to mark as done there; one born in git has neither. */
function detailAsk(ask: RoadmapPageAsk, onServer: boolean) {
  const tab = ask.tab ?? 'overview';
  return {
    tab: !onServer && tab === 'versions' ? 'overview' as const : tab,
    tick: { tickable: !onServer && (ask.tickable ?? false), ticked: ask.ticked ?? null, tickError: ask.tickError ?? null },
  };
}

/** One roadmap of the workspace opened: its rows, and for one born on the server its dossier's record. */
async function detailFor(reads: RoadmapPageReads, row: RoadmapRow, workspace: string, ask: RoadmapPageAsk, now: Date) {
  const dossier = row.dossier_id ?? null;
  const pick = ask.version ?? { part: 'roadmap', version: null };
  const [read, products, prerequisites, record] = await Promise.all([
    seqsOf(reads, [row]).then((seqs) => readOf(reads, row, seqs)), productsOf(reads, workspace), reads.prerequisites(row.id),
    dossier === null ? null : reads.record(dossier, pick),
  ]);
  return detailOf(read, products, now.getTime(), {
    prerequisites, ...detailAsk(ask, dossier !== null), ...(dossier === null ? {} : { record: { read: record, pick, me: ask.me ?? null } }),
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A roadmap's id as a path names it, or null when it cannot name one. */
export const roadmapIdOf = (part: string): string | null => (UUID.test(part) ? part.toLowerCase() : null);

/** A product's id as the filter names it, or null for every product. */
export const productOf = (value: string | null): string | null => (value !== null && UUID.test(value) ? value.toLowerCase() : null);

/** A product as the page reads it. */
export const ProductRow = z.strictObject({ id: z.string(), name: z.string(), key: z.string().nullable() });
export const PRODUCT_COLUMNS = 'id, name, key';

/** A PRD's shipped stage, as the page reads it. */
export const SHIPPED_COLUMNS = 'prd, reached_at';
export const ShippedRow = z.strictObject({ prd: PrdNumberSchema, reached_at: z.string() });

export const SEQ_COLUMNS = 'id, product_seq';
export const SeqRow = z.strictObject({ id: z.string(), product_seq: z.number().int().nullable() });

/** The page's reads, from Supabase, as the signed-in person. */
export function supabaseRoadmapPageReads(db: SupabaseClient<Database>, user: Pick<User, 'id'>): RoadmapPageReads {
  const roadmaps = roadmapReader(db);
  return {
    workspace: () => memberWorkspace(db, user.id),
    roadmaps: () => roadmaps.list(),
    roadmap: (id) => roadmaps.roadmap(id),
    prds: (id) => roadmaps.prds(id),
    humanWork: (id) => roadmaps.humanWork(id),
    async shipped(workspace, repository, prds) {
      const { data, error } = await db.from('prd_stages').select(SHIPPED_COLUMNS)
        .eq('workspace_id', workspace).eq('repository', repository.toLowerCase()).eq('stage', 'shipped').in('prd', [...prds]);
      if (error) throw new Error(error.message);
      return new Map(orThrow(parseRows(ShippedRow, data, 'roadmap/page/load: prd_stages')).map((r) => [r.prd, r.reached_at] as const));
    },
    prerequisites: (id) => roadmaps.prerequisites(id),
    async seqs(dossiers) {
      const { data, error } = await db.from('dossiers').select(SEQ_COLUMNS).in('id', [...dossiers]);
      if (error) throw new Error(error.message);
      const rows = orThrow(parseRows(SeqRow, data, 'roadmap/page/load: dossiers'));
      return new Map(rows.flatMap((r) => (r.product_seq === null ? [] : [[r.id, r.product_seq] as const])));
    },
    roadmapOfDossier: async (dossier) => (UUID.test(dossier) ? roadmaps.ofDossier(dossier) : null),
    record: (dossier, pick) => readRoadmapRecord(db, dossier, pick),
    async products(workspace) {
      const { data, error } = await db.from('products').select(PRODUCT_COLUMNS).eq('workspace_id', workspace).order('ordinal');
      if (error) throw new Error(error.message);
      return orThrow(parseRows(ProductRow, data, 'roadmap/page/load: products'));
    },
  };
}
