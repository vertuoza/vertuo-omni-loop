import type { Metadata } from 'next';
import { Notice } from '../../src/ask/page/Notice';
import { arcadeMode } from '../../src/data/mode';
import { supabaseEnv, supabaseServer } from '../../src/data/supabase-server';
import type { DossierListRow } from '../../src/dossier/store';
import { demoHistory } from '../../src/dossier/page/demo';
import { DossierHistory } from '../../src/dossier/page/DossierHistory';
import { DossierSignIn } from '../../src/dossier/page/DossierSignIn';
import { HISTORY_CALLBACK, historyChoices, historyItems, readHistoryFilters } from '../../src/dossier/page/history';
import { readHistory } from '../../src/dossier/page/source';

// /prd, the history (PRD 216): every dossier of the signed-in person's workspaces, newest activity
// first, filtered by repository (any of a dossier's repositories) and by draft or PRD, and searched by
// the words of a title; each row opens /prd/<id>. Rendered per request, as the signed-in person, so
// row-level security decides: signed out, a sign-in card that comes back here through /prd/callback.
// Without a database it plays the demo history in development.

export const metadata: Metadata = { title: 'PRDs · OMNI LOOP' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function HistoryRoute({ searchParams }: Props) {
  const query = await searchParams;
  const filters = readHistoryFilters(query);
  const listing = (rows: DossierListRow[]) => (
    <DossierHistory items={historyItems(rows, filters)} choices={historyChoices(rows)} filters={filters} />
  );
  const mode = arcadeMode(process.env);

  if (mode === 'demo') return listing(demoHistory(Date.now()));
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
    rows = await readHistory(db);
  } catch (error) {
    console.error(error);
    return (
      <Notice title="The dossier database could not answer" tone="error">
        <p className="ask-muted">Reload the page in a moment.</p>
      </Notice>
    );
  }
  return listing(rows);
}
