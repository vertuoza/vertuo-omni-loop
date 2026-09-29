import { supabaseEnv } from '../../src/data/supabase-server';
import { viewer } from '../../src/data/viewer';
import { periodOf, type Period } from '../../src/dashboard/board/period';
import { demoDashboard } from '../../src/dashboard/demo';
import { DashboardScreen, type DashboardView } from '../../src/dashboard/DashboardScreen';
import { loadDashboard } from '../../src/dashboard/load';
import { homeParts } from '../../src/dashboard/stream/home';
import { HomeStream } from '../../src/dashboard/stream/HomeStream';

// /app, the app's home (PRD 238), is your dashboard (PRD 328, reshaped by PRD 572): your hero, fleet,
// season points and places, Waiting for you, then the board with scope *you* for the query's period
// (`?period=7d|30d|season`, 7 days otherwise), whose People table is your team. Rendered per request,
// as the signed-in person, the way /prd is, so row-level security decides what each read returns. It
// decides the situation once, top to bottom (src/dashboard/DashboardScreen.tsx): the demo world in
// development (or OMNI_LOOP_DEMO=1); with no database, the notice; signed out, only the sign-in card,
// which comes back here through /app/callback; signed in, the dashboard of the workspace joined
// first, or the notice for an account in none. PRD 657 s4: a member's dashboard streams, each part
// in its own block (src/dashboard/stream/), once the workspace is known (the layout read it for this
// request, through viewer()); with the workspace out of reach, it is read as before, every part saying
// it could not load.

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

type Seen = Awaited<ReturnType<typeof viewer>>;

async function viewOf(seen: Seen, period: Period, now: Date): Promise<DashboardView> {
  if (seen.kind === 'demo') return { kind: 'dashboard', dashboard: demoDashboard(period, now) };
  if (seen.kind !== 'signed-in') return { kind: seen.kind };
  return loadDashboard(seen.db, seen.user, period, now, seen.questions);
}

export default async function AppHome({ searchParams }: Props) {
  const query = await searchParams;
  const period = periodOf(one(query.period));
  const now = new Date();
  const screen = (view: DashboardView) => (
    <DashboardScreen view={view} supabase={supabaseEnv()} signinError={one(query.signin_error)} query={query} />
  );
  const seen = await viewer();
  if (seen.kind === 'signed-in') {
    const workspace = await seen.workspace().catch(() => undefined);
    if (workspace === null) return screen({ kind: 'no-workspace' });
    if (workspace) return <HomeStream parts={homeParts(seen.db, seen.user, workspace.id, period, now, seen.questions)} query={query} />;
  }
  return screen(await viewOf(seen, period, now));
}
