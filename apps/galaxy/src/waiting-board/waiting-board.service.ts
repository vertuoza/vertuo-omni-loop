import type { People } from '../people/load';
import { productFilterReads, scopeDossiers, type ProductFilterReads, type ProductFilterView } from '../product-filter/product-filter.service';
import { boardOf, firstOf, prdKey, tabOf, type BoardValue, type PrdPage, type StoredWait } from './board';
import { waitingBoardRepository, type WaitingBoardDb, type WaitingBoardRepository } from './waiting-board.repository';

// /app/waiting's rules around its reads (PRD 2377 s3; ADR-0095): the workspace's open waits, the pages
// and titles of the PRDs they name, each PRD's open outbox questions and when each tracked repository was
// last synced, all as the signed-in person; then the product filter's narrowing (a wait of a PRD carries
// that PRD's product, a bug fix or visual update none), and last the board itself (./board.ts). The page
// makes no GitHub request. A failed read throws: the controller says the page could not load. The
// products' own read fails soft, as on the other Work pages: the list is whole, and says so.

type Query = Readonly<Record<string, string | string[] | undefined>>;

/** The page's path, which the product filter's links keep. */
const WAITING_PATH = '/app/waiting';

/** The reads the board needs. */
export type BoardReads = Pick<WaitingBoardRepository, 'tracked' | 'openWaits' | 'dossiers' | 'openQuestions' | 'lastSynced'>;

type FilterReads = Pick<ProductFilterReads, 'products' | 'dossierProducts' | 'dossierNumbers'>;

/** The tab asked for, with its product filter. */
export interface WaitingBoardData {
  board: BoardValue;
  filter: ProductFilterView | null;
  productsUnreadable: boolean;
}

export interface WaitingBoardRequest {
  workspace: string;
  /** The signed-in person's account id: whose PRDs and reviews the personal tabs show. */
  viewerId: string;
  people: People;
  query: Query;
  now: Date;
}

/** The waits that remain once the product filter has narrowed the PRDs they name: a PRD's wait is kept
 * with its PRD, a wait with none (a bug fix, a visual update) belongs to no product. */
async function narrowed(filterReads: FilterReads, waits: readonly StoredWait[], dossiers: ReadonlyMap<string, PrdPage>, { workspace, query }: WaitingBoardRequest) {
  const idOf = (wait: StoredWait) => (wait.prd === null ? undefined : dossiers.get(prdKey(wait.repo, wait.prd))?.id) ?? `wait:${wait.id}`;
  const rows = [...new Set(waits.map(idOf))].map((id) => ({ id, workspace_id: workspace }));
  const scope = await scopeDossiers(filterReads, rows, query, WAITING_PATH);
  const kept = new Set(scope.rows.map((r) => r.id));
  return { waits: waits.filter((w) => kept.has(idOf(w))), filter: scope.filter, productsUnreadable: scope.unreadable };
}

/** The board of the workspace, narrowed by the query's product. */
export async function loadWaitingBoard(reads: BoardReads, filterReads: FilterReads, request: WaitingBoardRequest): Promise<WaitingBoardData> {
  const { workspace, people, now, viewerId, query } = request;
  const [tracked, stored] = await Promise.all([reads.tracked(workspace), reads.openWaits(workspace)]);
  const waits: StoredWait[] = stored.map((w) => ({ ...w, repo: w.repo.toLowerCase() }));
  const prds = [...new Set(waits.flatMap((w) => (w.prd === null ? [] : [w.prd])))];
  const outboxPrds = [...new Set(waits.flatMap((w) => (w.prd !== null && w.kind === 'outbox' ? [w.prd] : [])))];
  const [dossierRows, questionRows, synced] = await Promise.all([
    reads.dossiers(workspace, prds),
    reads.openQuestions(workspace, outboxPrds),
    Promise.all(tracked.map(async (repo): Promise<[string, string | null]> => [repo, await reads.lastSynced(workspace, repo)])),
  ]);
  const dossiers = new Map(dossierRows.map((d): [string, PrdPage] => [prdKey(d.home_repo, d.prd), { id: d.id, title: d.title, owner: d.opened_by }]));
  const questions = new Map(questionRows.map((q): [string, number] => [prdKey(q.repository, q.prd), q.open_questions]));
  const kept = await narrowed(filterReads, waits, dossiers, request);
  return {
    board: boardOf({
      waits: kept.waits, dossiers, questions, synced: new Map(synced), now, tab: tabOf(firstOf(query.tab)),
      viewer: { id: viewerId, login: people.byId(viewerId, '').login ?? null },
    }, people),
    filter: kept.filter,
    productsUnreadable: kept.productsUnreadable,
  };
}

/** The live reads on `db`, the client the controller was handed: the viewer's. */
export const waitingBoardReads = (db: WaitingBoardDb) => ({ reads: waitingBoardRepository(db), filterReads: productFilterReads(db) });
