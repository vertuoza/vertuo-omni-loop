import type { Metadata } from 'next';
import { Notice } from '../../src/ask/page/Notice';
import { arcadeMode } from '../../src/data/mode';
import { supabaseEnv, supabaseServer } from '../../src/data/supabase-server';
import type { DossierListRow } from '../../src/dossier/store';
import { dossierGithub } from '../../src/dossier/github/server';
import { DEMO_DOSSIER_ID, DEMO_GITHUB, DEMO_VIEWER, demoHistory } from '../../src/dossier/page/demo';
import { DossierHistory } from '../../src/dossier/page/DossierHistory';
import { DossierSignIn } from '../../src/dossier/page/DossierSignIn';
import {
  HISTORY_CALLBACK, historyChoices, historyItems, historyToRead, readHistoryFilters, readOpenCounts, type OpenCounts,
} from '../../src/dossier/page/history';
import { readHistory } from '../../src/dossier/page/source';
import { ofWork } from '../../src/dossier/page/work';

// /prd, the history (PRD 216): every dossier of the signed-in person's workspaces, newest activity
// first, filtered by repository (any of a dossier's repositories) and by draft or PRD, and searched by
// the words of a title; each row opens /prd/<id>. Rendered per request, as the signed-in person, so
// row-level security decides: signed out, a sign-in card that comes back here through /prd/callback.
// Without a database it plays the demo history in development. PRD 413: Mine by default, the dossiers the
// signed-in person opened (the demo's viewer in the demo), or All with who=all. PRD 251: each numbered
// row the filters let through has its outbox's open questions counted by the server's GitHub reader
// (its 60-second cache), for `n open` and Needs an answer; the demo counts the demo dossier's outbox.
// PRD 627: only PRDs' dossiers; the fixes have their own lists, /visual and /bugs.

export const metadata: Metadata = { title: 'PRDs · OMNI LOOP' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

const DEMO_READER = { summary: async ({ id }: { id: string }) => (id === DEMO_DOSSIER_ID ? DEMO_GITHUB : null) };

export default async function HistoryRoute({ searchParams }: Props) {
  const query = await searchParams;
  const filters = readHistoryFilters(query);
  const listing = (all: DossierListRow[], viewer: string, open: OpenCounts, rows = ofWork(all, 'prd')) => (
    <DossierHistory items={historyItems(rows, filters, viewer, open)} choices={historyChoices(rows)} filters={filters} />
  );
  const mode = arcadeMode(process.env);

  if (mode === 'demo') {
    const rows = ofWork(demoHistory(Date.now()), 'prd');
    return listing(rows, DEMO_VIEWER, await readOpenCounts(historyToRead(rows, filters, DEMO_VIEWER), DEMO_READER));
  }
  const env = supabaseEnv();
  if (mode === 'closed' || !env) {
    return (
      <Notice title="PRD dossiers are not open here">
        <p className="ask-muted">This deployment has no database, so it keeps no dossier.</p>
      </Notice>
    );
  }
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return <DossierSignIn supabase={env} returnPath={HISTORY_CALLBACK} error={one(query.signin_error)} what="history" />;

  let rows: DossierListRow[];
  try {
    rows = ofWork(await readHistory(db), 'prd');
  } catch (error) {
    console.error(error);
    return (
      <Notice title="The dossier database could not answer" tone="error">
        <p className="ask-muted">Reload the page in a moment.</p>
      </Notice>
    );
  }
  return listing(rows, user.id, await readOpenCounts(historyToRead(rows, filters, user.id), dossierGithub()));
}
