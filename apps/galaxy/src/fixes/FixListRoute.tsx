import { Notice } from '../ask/page/Notice';
import { arcadeMode } from '../data/mode';
import { supabaseEnv, supabaseServer } from '../data/supabase-server';
import { DEMO_VIEWER, demoHistory } from '../dossier/page/demo';
import { DossierSignIn } from '../dossier/page/DossierSignIn';
import { readHistory } from '../dossier/page/source';
import { WORK_NAMES, WORK_PATHS } from '../dossier/page/work';
import type { DossierListRow } from '../dossier/store';
import { FixList } from './FixList';
import { fixChoices, fixItems, readFixFilters, type FixKind } from './list';

// /visual and /bugs (PRD 627): the fixes of one kind of the signed-in person's workspaces, read as
// /prd reads its list — per request, as the signed-in person, so row-level security decides; signed
// out, a sign-in card that comes back here through /visual/callback or /bugs/callback. Without a
// database it plays the demo history in development, which holds no fix.

type Query = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

/** Where a list of fixes signs in and comes back. */
export const fixCallbackPath = (kind: FixKind) => `${WORK_PATHS[kind]}/callback`;

export async function fixListRoute(kind: FixKind, searchParams: Promise<Query>) {
  const query = await searchParams;
  const filters = readFixFilters(query);
  const listing = (rows: DossierListRow[], viewer: string) => (
    <FixList kind={kind} items={fixItems(rows, kind, filters, viewer)} choices={fixChoices(rows, kind)} filters={filters} />
  );
  const mode = arcadeMode(process.env);

  if (mode === 'demo') return listing(demoHistory(Date.now()), DEMO_VIEWER);
  const env = supabaseEnv();
  if (mode === 'closed' || !env) {
    return (
      <Notice title={`${WORK_NAMES[kind].many} are not open here`}>
        <p className="ask-muted">This deployment has no database, so it keeps no dossier.</p>
      </Notice>
    );
  }
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return <DossierSignIn supabase={env} returnPath={fixCallbackPath(kind)} error={one(query.signin_error)} what={kind} />;

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
  return listing(rows, user.id);
}
