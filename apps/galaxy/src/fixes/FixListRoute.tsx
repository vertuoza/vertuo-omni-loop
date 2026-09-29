import { Notice } from '../ask/page/Notice';
import { arcadeMode } from '../data/mode';
import { supabaseEnv, supabaseServer } from '../data/supabase-server';
import { DEMO_VIEWER, demoHistory } from '../dossier/page/demo';
import { DossierSignIn } from '../dossier/page/DossierSignIn';
import { readHistory } from '../dossier/page/source';
import { WORK_NAMES, WORK_PATHS } from '../dossier/page/work';
import type { DossierListRow } from '../dossier/store';
import { dossierGithub } from '../dossier/github/server';
import type { FixSummary } from '../dossier/github/fix';
import { ofWork } from '../dossier/page/work';
import { FixList } from './FixList';
import { loginOf } from '../nav/viewer';
import { fixChoices, fixItems, readFixFilters, type FixFacts, type FixKind, type FixViewer } from './list';

// /visual and /bugs (PRD 627): the fixes of one kind of the signed-in person's workspaces, read as
// /prd reads its list — per request, as the signed-in person, so row-level security decides; signed
// out, a sign-in card that comes back here through /visual/callback or /bugs/callback. Without a
// database it plays the demo history in development, which holds no fix.
// PRD 627, s5: each fix's state, who asked, and a bug fix's risk and regression labels are read live from
// GitHub through the server's one reader, cached 60 s per fix; without the App's credentials, or when
// GitHub does not answer, each pill reads `—`.

type Query = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

/** Where a list of fixes signs in and comes back. */
const fixCallbackPath = (kind: FixKind) => `${WORK_PATHS[kind]}/callback`;

export async function fixListRoute(kind: FixKind, searchParams: Promise<Query>) {
  const query = await searchParams;
  const filters = readFixFilters(query);
  const listing = (rows: DossierListRow[], viewer: FixViewer, facts?: FixFacts) => (
    <FixList kind={kind} items={fixItems(rows, kind, filters, viewer, facts)} choices={fixChoices(rows, kind)} filters={filters} />
  );
  const mode = arcadeMode(process.env);

  if (mode === 'demo') return listing(demoHistory(Date.now()), { id: DEMO_VIEWER, login: null });
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
  return listing(rows, { id: user.id, login: loginOf(user) }, await factsOf(ofWork(rows, kind)));
}

/** What GitHub says of each fix, by dossier id; a fix it could not read is left out (`—`). */
async function factsOf(rows: DossierListRow[]): Promise<FixFacts> {
  const reader = dossierGithub();
  if (!reader) return new Map();
  const read = await Promise.all(rows.filter((row) => row.prd !== null).map(async (row): Promise<[string, FixSummary | null]> => {
    const fix = await reader.fix({ id: row.id, home_repo: row.home_repo, prd: row.prd! }).catch((error: unknown) => {
      console.error(error);
      return null;
    });
    return [row.id, fix];
  }));
  return new Map(read);
}
