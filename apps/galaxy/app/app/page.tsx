import { arcadeMode } from '../../src/data/mode';
import { supabaseEnv, supabaseServer } from '../../src/data/supabase-server';
import { periodOf, type Period } from '../../src/dashboard/board/period';
import { demoDashboard } from '../../src/dashboard/demo';
import { DashboardScreen, type DashboardView } from '../../src/dashboard/DashboardScreen';
import { loadDashboard } from '../../src/dashboard/load';

// /app, the app's home (PRD 238), is your dashboard (PRD 328, reshaped by PRD 572): your hero, fleet,
// season points and places, Waiting for you, then the board with scope *you* for the query's period
// (`?period=7d|30d|season`, 7 days otherwise), whose People table is your team. Rendered per request,
// as the signed-in person, the way /prd is, so row-level security decides what each read returns. It
// decides the situation once, top to bottom (src/dashboard/DashboardScreen.tsx): the demo world in
// development (or OMNI_LOOP_DEMO=1); with no database, the notice; signed out, only the sign-in card,
// which comes back here through /app/callback; signed in, the dashboard of the workspace joined
// first, or the notice for an account in none.

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

async function viewOf(period: Period, now: Date): Promise<DashboardView> {
  const mode = arcadeMode(process.env);
  if (mode === 'demo') return { kind: 'dashboard', dashboard: demoDashboard(period, now) };
  if (mode === 'closed' || !supabaseEnv()) return { kind: 'closed' };
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  return user ? loadDashboard(db, user, period, now) : { kind: 'sign-in' };
}

export default async function AppHome({ searchParams }: Props) {
  const query = await searchParams;
  const period = periodOf(one(query.period));
  return (
    <DashboardScreen
      view={await viewOf(period, new Date())}
      supabase={supabaseEnv()}
      signinError={one(query.signin_error)}
      query={query}
    />
  );
}
