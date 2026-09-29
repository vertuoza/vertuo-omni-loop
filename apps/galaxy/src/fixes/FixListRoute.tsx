import { Notice } from '../ask/page/Notice';
import { arcadeMode } from '../data/mode';
import { DEMO_VIEWER, demoHistory } from '../dossier/page/demo';
import { DossierSignIn } from '../dossier/page/DossierSignIn';
import { readHistory, type Db } from '../dossier/page/source';
import { WORK_NAMES, WORK_PATHS } from '../dossier/page/work';
import type { DossierListRow } from '../dossier/store';
import { dossierSession } from '../dossier/page/route-gate';
import { ofWork } from '../dossier/page/work';
import { fixFactsStore } from './facts/store';
import { FiltersSkeleton, ListSkeleton } from '../skeleton/Skeleton';
import { FixList } from './FixList';
import { loginOf } from '../nav/viewer';
import { fixChoices, fixItems, readFixFilters, type FixFacts, type FixKind, type FixViewer } from './list';

// /visual and /bugs (PRD 627): the fixes of one kind of the signed-in person's workspaces, read as
// /prd reads its list — per request, as the signed-in person, so row-level security decides; signed
// out, a sign-in card that comes back here through /visual/callback or /bugs/callback. Without a
// database it plays the demo history in development, which holds no fix.
// PRD 627, s5: each fix's state, who asked, and a bug fix's risk and regression labels, shown as pills.
// PRD 691 s3: those facts are read from fix_facts (./facts/store.ts), which the stages sync and each fix's
// own page keep, as the signed-in person, one read per workspace: rendering the list makes no GitHub
// call. A fix with no stored facts yet, or facts that could not be read, reads `—`, and Mine then keeps
// the fixes the viewer pushed. The user is read through viewer() (PRD 657), from the session's claims.

type Query = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

/** Where a list of fixes signs in and comes back. */
const fixCallbackPath = (kind: FixKind) => `${WORK_PATHS[kind]}/callback`;

/** What /bugs and /visual draw while their page starts (PRD 691 s3, their loading.tsx): the list's
 * heading, drawn as the page draws it, then the filters and the rows. */
export function FixListLoading({ kind }: { kind: FixKind }) {
  return (
    <div className="dossier dossier-history">
      <h1 className="dossier-title">{WORK_NAMES[kind].many}</h1>
      <FiltersSkeleton />
      <ListSkeleton what={WORK_NAMES[kind].many.toLowerCase()} />
    </div>
  );
}

export async function fixListRoute(kind: FixKind, searchParams: Promise<Query>) {
  const query = await searchParams;
  const filters = readFixFilters(query);
  const listing = (rows: DossierListRow[], viewer: FixViewer, facts?: FixFacts) => (
    <FixList kind={kind} items={fixItems(rows, kind, filters, viewer, facts)} choices={fixChoices(rows, kind)} filters={filters} />
  );
  const mode = arcadeMode(process.env);

  if (mode === 'demo') return listing(demoHistory(Date.now()), { id: DEMO_VIEWER, login: null });
  const session = await dossierSession(mode);
  if (!session) {
    return (
      <Notice title={`${WORK_NAMES[kind].many} are not open here`}>
        <p className="ask-muted">This deployment has no database, so it keeps no dossier.</p>
      </Notice>
    );
  }
  const { env, db, user } = session;
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
  return listing(rows, { id: user.id, login: loginOf(user) }, await storedFacts(db, ofWork(rows, kind)));
}

/** The stored facts of each fix, by dossier id, read as the viewer, one read per workspace; a fix with
 * none, or whose workspace's facts could not be read, is left out (`—`). */
async function storedFacts(db: Db, rows: DossierListRow[]): Promise<FixFacts> {
  const store = fixFactsStore(db);
  const byWorkspace = new Map<string, DossierListRow[]>();
  for (const row of rows) byWorkspace.set(row.workspace_id, [...(byWorkspace.get(row.workspace_id) ?? []), row]);
  const read = await Promise.all([...byWorkspace].map(([workspace, fixes]) =>
    store.readFacts(workspace, fixes.map((row) => row.id)).catch((error: unknown) => {
      console.error(error);
      return new Map();
    })));
  return new Map(read.flatMap((facts) => [...facts]));
}
