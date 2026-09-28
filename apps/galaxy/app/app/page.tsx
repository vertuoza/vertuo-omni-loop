import { arcadeMode } from '../../src/data/mode';
import { supabaseEnv, supabaseServer } from '../../src/data/supabase-server';
import { demoDashboard } from '../../src/dashboard/demo';
import { DashboardScreen, type DashboardView } from '../../src/dashboard/DashboardScreen';
import { loadDashboard } from '../../src/dashboard/load';

// /app, the app's home (PRD 238), is your dashboard (PRD 328): your hero, fleet, season points and
// places, a week of merges, four counts, the rankings, then the app's sections. Rendered per request,
// as the signed-in person, the way /prd is, so row-level security decides what each read returns. It
// decides the situation once, top to bottom (src/dashboard/DashboardScreen.tsx): the demo world in
// development (or OMNI_LOOP_DEMO=1); with no database, the notice and the section cards; signed out,
// only the sign-in card, which comes back here through /app/callback; signed in, the dashboard of the
// workspace joined first, or the notice for an account in none.

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

async function viewOf(now: Date): Promise<DashboardView> {
  const mode = arcadeMode(process.env);
  if (mode === 'demo') return { kind: 'dashboard', dashboard: demoDashboard(now) };
  if (mode === 'closed' || !supabaseEnv()) return { kind: 'closed' };
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  return user ? loadDashboard(db, user, now) : { kind: 'sign-in' };
}

export default async function AppHome({ searchParams }: Props) {
  const query = await searchParams;
  return <DashboardScreen view={await viewOf(new Date())} supabase={supabaseEnv()} signinError={one(query.signin_error)} />;
}
