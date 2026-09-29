import type { Metadata } from 'next';
import { arcadeMode } from '../../src/data/mode';
import type { DossierListRow } from '../../src/dossier/store';
import { dossierGithub } from '../../src/dossier/github/server';
import { DEMO_DOSSIER_ID, DEMO_GITHUB, DEMO_VIEWER, demoHistory } from '../../src/dossier/page/demo';
import { DossierHistory } from '../../src/dossier/page/DossierHistory';
import { DossierSignIn } from '../../src/dossier/page/DossierSignIn';
import {
  HISTORY_CALLBACK, historyChoices, historyItems, historyStageBar, historyToRead, readCurrentStages, readHistoryFilters, readOpenCounts,
  type CurrentStages, type OpenCounts,
} from '../../src/dossier/page/history';
import { DossierDatabaseDown, DossiersClosed, dossierSession } from '../../src/dossier/page/route-gate';
import { readHistory } from '../../src/dossier/page/source';
import { stageStore } from '../../src/stages/store';

// /prd, the history (PRD 216): every dossier of the signed-in person's workspaces, newest activity
// first, filtered by repository (any of a dossier's repositories) and by draft or PRD, and searched by
// the words of a title; each row opens /prd/<id>. Rendered per request, as the signed-in person, so
// row-level security decides: signed out, a sign-in card that comes back here through /prd/callback.
// Without a database it plays the demo history in development. PRD 413: Mine by default, the dossiers the
// signed-in person opened (the demo's viewer in the demo), or All with who=all. PRD 251: each numbered
// row the filters let through has its outbox's open questions counted by the server's GitHub reader
// (its 60-second cache), for `n open` and Needs an answer; the demo counts the demo dossier's outbox.
// PRD 587: the numbered rows' current stages are read from the stored stages, as the signed-in person,
// for the stage bar, `?stage=` and each row's pill; stages that cannot be read show none. The demo has no
// stored stage, so only its answered drafts read idea.

export const metadata: Metadata = { title: 'PRDs · OMNI LOOP' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

const DEMO_READER = { summary: async ({ id }: { id: string }) => (id === DEMO_DOSSIER_ID ? DEMO_GITHUB : null) };

export default async function HistoryRoute({ searchParams }: Props) {
  const query = await searchParams;
  const filters = readHistoryFilters(query);
  const listing = (rows: DossierListRow[], viewer: string, open: OpenCounts, stages: CurrentStages = new Map()) => (
    <DossierHistory
      items={historyItems(rows, filters, viewer, open, stages)} choices={historyChoices(rows)} filters={filters}
      stages={historyStageBar(rows, filters, viewer, open, stages)}
    />
  );
  const mode = arcadeMode(process.env);

  if (mode === 'demo') {
    const rows = demoHistory(Date.now());
    return listing(rows, DEMO_VIEWER, await readOpenCounts(historyToRead(rows, filters, DEMO_VIEWER), DEMO_READER));
  }
  const session = await dossierSession(mode);
  if (!session) return <DossiersClosed />;
  const { env, db, user } = session;
  if (!user) return <DossierSignIn supabase={env} returnPath={HISTORY_CALLBACK} error={one(query.signin_error)} what="history" />;

  let rows: DossierListRow[];
  try {
    rows = await readHistory(db);
  } catch (error) {
    console.error(error);
    return <DossierDatabaseDown />;
  }
  const [open, stages] = await Promise.all([
    readOpenCounts(historyToRead(rows, filters, user.id), dossierGithub()),
    readCurrentStages(rows, stageStore(db)),
  ]);
  return listing(rows, user.id, open, stages);
}
