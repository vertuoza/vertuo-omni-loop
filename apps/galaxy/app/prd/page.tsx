import 'server-only';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { serverEnv } from '../../src/env';
import type { DossierListRow } from '../../src/dossier/store';
import { DEMO_GITHUB, DEMO_VIEWER, demoHistory } from '../../src/dossier/page/demo';
import { DossierHistory } from '../../src/dossier/page/DossierHistory';
import { DossierSignIn } from '../../src/dossier/page/DossierSignIn';
import '../../src/product-filter/product-filter.css';
import { productListScope } from '../../src/product-filter/ProductFilter';
import type { ProductLabels } from '../../src/product-filter/product-filter.service';
import {
  HISTORY_CALLBACK, HISTORY_PATH, historyChoices, historyItems, historyStageBar, historyToRead, readCurrentStages, readHistoryFilters, readLoginIds, readOpenCounts,
  rosterReader, whoLogin, type CurrentStages, type OpenCounts, type Whom,
} from '../../src/dossier/page/history';
import { DossierDatabaseDown, DossiersClosed, dossierSession } from '../../src/dossier/page/route-gate';
import { readHistory } from '../../src/dossier/page/source';
import { ofWork } from '../../src/dossier/page/work';
import { PrdListLoading } from '../../src/skeleton/pages';
import { Streamed } from '../../src/skeleton/Streamed';
import { countsOf } from '../../src/stages/outbox/recount';
import { prdOutboxStore, type OutboxCounts, type PrdOutboxStore } from '../../src/stages/outbox/store';
import { prdKey, stageStore } from '../../src/stages/store';
import { createTimings } from '../../src/dossier/page/timing';
import { ServerTimingMark } from '../../src/dossier/page/timing-mark';

// /prd, the history (PRD 216): every dossier of the signed-in person's workspaces, newest activity
// first, filtered by repository (any of a dossier's repositories) and by draft or PRD, and searched by
// the words of a title; each row opens /prd/<id>. Rendered per request, as the signed-in person, so
// row-level security decides: signed out, a sign-in card that comes back here through /prd/callback.
// Without a database it plays the demo history in development. PRD 413: Mine by default, the dossiers the
// signed-in person opened (the demo's viewer in the demo), or All with who=all. PRD 251: each numbered
// row the filters let through has its outbox's open questions counted, for `n open` and Needs an answer;
// the demo counts the demo dossier's outbox. PRD 657 (s5): the counts are read from prd_outbox, as the
// signed-in person, so rendering the list makes no GitHub request.
// PRD 587: the numbered rows' current stages are read from the stored stages, as the signed-in person,
// for the stage bar, `?stage=` and each row's pill; stages that cannot be read show none. The demo has no
// stored stage, so only its answered drafts read idea.
// PRD 627: only PRDs' dossiers; the fixes have their own lists, /visual and /bugs. PRD 2401 s3: the
// database leaves the fixes out (dossier_list(p_kind => 'prd')), so the list never reads them.
// PRD 657 s4: a signed-in person's list streams in its own block, under the list's skeleton (the
// heading, the filters' place and the rows'), so the frame is sent before the dossiers are read. The
// filters stream with the rows: their repositories and the empty list's words come from the same read.
// PRD 698 (s4): `who=<login>` lists the PRDs that person opened: the login's account ids are read from the
// rosters of the listed dossiers' workspaces (workspace_roster, as the signed-in person), only then.
// PRD 1364 s12: `product=<id>` or `product=none` keeps the PRDs of that product, or of none, read from
// dossiers.product_id as the signed-in person; the filter's links are drawn above the list when the
// listed workspaces have a product (src/product-filter/). The demo has no product, so no filter.

export const metadata: Metadata = { title: 'PRDs · OMNI LOOP' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

/** The demo's stored outboxes: the demo dossier's PRD, counted from its built-in summary. */
const DEMO_READER: Pick<PrdOutboxStore, 'countsOf'> = {
  countsOf: (_workspace, prds) => {
    const demo = countsOf(DEMO_GITHUB);
    const key = prdKey({ repository: DEMO_GITHUB.repo, prd: DEMO_GITHUB.prd });
    return Promise.resolve(new Map(demo ? prds.filter((p) => prdKey(p) === key).map((p): [string, OutboxCounts] => [prdKey(p), demo]) : []));
  },
};

export default async function HistoryRoute({ searchParams }: Props) {
  const query = await searchParams;
  const filters = readHistoryFilters(query);
  const listing = (rows: DossierListRow[], viewer: string, open: OpenCounts, stages: CurrentStages = new Map(), whom?: Whom, labels?: ProductLabels) => (
    <DossierHistory
      items={historyItems(rows, filters, viewer, open, stages, whom, labels)} choices={historyChoices(rows)} filters={filters}
      stages={historyStageBar(rows, filters, viewer, open, stages, whom)}
    />
  );
  const login = whoLogin(filters.who);
  const mode = serverEnv().mode;

  if (mode === 'demo') {
    const rows = ofWork(demoHistory(Date.now()), 'prd');
    return listing(rows, DEMO_VIEWER, await readOpenCounts(historyToRead(rows, filters, DEMO_VIEWER), DEMO_READER));
  }
  // PRD 2401 s1: each read is timed under its name and the timings are said at the end of the page.
  const timings = createTimings();
  const session = await timings.time('viewer', dossierSession(mode));
  if (!session) return <DossiersClosed />;
  const { env, db, user } = session;
  if (!user) return <DossierSignIn supabase={env} returnPath={HISTORY_CALLBACK} error={one(query.signin_error)} what="history" />;

  /** The list as the signed-in person reads it: the dossiers, then their open questions and stages. */
  async function history(userId: string): Promise<ReactNode> {
    let listed: DossierListRow[];
    try {
      // PRD 2401 s3: the database lists the PRDs alone, the fixes never read.
      listed = await timings.time('dossier_list', readHistory(db, 'prd'));
    } catch (error) {
      console.error(error);
      return <DossierDatabaseDown />;
    }
    const { rows, above, labels } = await timings.time('scope', productListScope(HISTORY_PATH)(db, listed, query));
    const whom = login ? await timings.time('login_ids', readLoginIds(rows, login, rosterReader(db))) : undefined;
    const [open, stages] = await Promise.all([
      timings.time('counts', readOpenCounts(historyToRead(rows, filters, userId, whom), prdOutboxStore(db))),
      timings.time('stages', readCurrentStages(rows, stageStore(db))),
    ]);
    return <>{above}{listing(rows, userId, open, stages, whom, labels)}<ServerTimingMark timings={timings} /></>;
  }
  return <Streamed read={history(user.id)} skeleton={<PrdListLoading />} failed={<DossierDatabaseDown />}>{(list) => list}</Streamed>;
}
