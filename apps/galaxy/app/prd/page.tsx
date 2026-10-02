import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { arcadeMode } from '../../src/data/mode';
import { listOf } from '../../src/data/unparsed';
import type { DossierListRow } from '../../src/dossier/store';
import { DEMO_GITHUB, DEMO_VIEWER, demoHistory } from '../../src/dossier/page/demo';
import { DossierHistory } from '../../src/dossier/page/DossierHistory';
import { DossierSignIn } from '../../src/dossier/page/DossierSignIn';
import {
  HISTORY_CALLBACK, historyChoices, historyItems, historyStageBar, historyToRead, readCurrentStages, readHistoryFilters, readLoginIds, readOpenCounts,
  whoLogin, type CurrentStages, type OpenCounts, type Whom,
} from '../../src/dossier/page/history';
import { DossierDatabaseDown, DossiersClosed, dossierSession } from '../../src/dossier/page/route-gate';
import { readHistory } from '../../src/dossier/page/source';
import { ofWork } from '../../src/dossier/page/work';
import { PrdListLoading } from '../../src/skeleton/pages';
import { Streamed } from '../../src/skeleton/Streamed';
import { countsOf } from '../../src/stages/outbox/recount';
import { prdOutboxStore, type OutboxCounts, type PrdOutboxStore } from '../../src/stages/outbox/store';
import { prdKey, stageStore } from '../../src/stages/store';

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
// PRD 627: only PRDs' dossiers; the fixes have their own lists, /visual and /bugs.
// PRD 657 s4: a signed-in person's list streams in its own block, under the list's skeleton (the
// heading, the filters' place and the rows'), so the frame is sent before the dossiers are read. The
// filters stream with the rows: their repositories and the empty list's words come from the same read.
// PRD 698 (s4): `who=<login>` lists the PRDs that person opened: the login's account ids are read from the
// rosters of the listed dossiers' workspaces (workspace_roster, as the signed-in person), only then.

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
  const listing = (rows: DossierListRow[], viewer: string, open: OpenCounts, stages: CurrentStages = new Map(), whom?: Whom) => (
    <DossierHistory
      items={historyItems(rows, filters, viewer, open, stages, whom)} choices={historyChoices(rows)} filters={filters}
      stages={historyStageBar(rows, filters, viewer, open, stages, whom)}
    />
  );
  const login = whoLogin(filters.who);
  const mode = arcadeMode(process.env);

  if (mode === 'demo') {
    const rows = ofWork(demoHistory(Date.now()), 'prd');
    return listing(rows, DEMO_VIEWER, await readOpenCounts(historyToRead(rows, filters, DEMO_VIEWER), DEMO_READER));
  }
  const session = await dossierSession(mode);
  if (!session) return <DossiersClosed />;
  const { env, db, user } = session;
  if (!user) return <DossierSignIn supabase={env} returnPath={HISTORY_CALLBACK} error={one(query.signin_error)} what="history" />;

  /** The list as the signed-in person reads it: the dossiers, then their open questions and stages. */
  async function history(userId: string): Promise<ReactNode> {
    let rows: DossierListRow[];
    try {
      rows = ofWork(await readHistory(db), 'prd');
    } catch (error) {
      console.error(error);
      return <DossierDatabaseDown />;
    }
    const whom = login ? await readLoginIds(rows, login, async (workspace) => {
      const { data, error } = await db.rpc('workspace_roster', { workspace });
      if (error) throw new Error(error.message);
      return listOf(data);
    }) : undefined;
    const [open, stages] = await Promise.all([
      readOpenCounts(historyToRead(rows, filters, userId, whom), prdOutboxStore(db)),
      readCurrentStages(rows, stageStore(db)),
    ]);
    return listing(rows, userId, open, stages, whom);
  }
  return <Streamed read={history(user.id)} skeleton={<PrdListLoading />} failed={<DossierDatabaseDown />}>{(list) => list}</Streamed>;
}
