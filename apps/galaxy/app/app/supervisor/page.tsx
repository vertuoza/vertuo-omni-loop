import type { Metadata } from 'next';
import { firstParam as one, memberSession } from '../../../src/data/member-session';
import { demoSupervisor } from '../../../src/supervisor/page/demo';
import { supervisorPageReads, supervisorPageSupabase } from '../../../src/supervisor/page/live';
import { loadSupervisorPage } from '../../../src/supervisor/page/load';
import { queryOf, type SupervisorPageView } from '../../../src/supervisor/page/model';
import { SupervisorPage } from '../../../src/supervisor/page/SupervisorPage';

// /app/supervisor (PRD omni-loop-34 s5): what the workspace's Supervisor found, each finding with the check that fired
// and its figures first, its evidence and its thread, beside the general chat. `?finding=<id>` opens a finding (the
// alerts link there), `?tab=done`, `?kind=stuck|bug|health` and `?view=chat` the rest. Rendered per request, as the
// signed-in person, as /app/runners is: the demo in development (or OMNI_LOOP_DEMO=1); with no database, or no service
// role to read the findings with, closed; signed out, the sign-in card; signed in, the board, or the notice for an
// account in no workspace. The page reads itself again every 10 s while it is open.

export const metadata: Metadata = {
  title: 'Supervisor · OMNI LOOP',
  description: 'What the workspace\'s Supervisor found across runners, jobs, missions and Omni Loop itself, and what needs an owner.',
  robots: { index: false, follow: false },
};

async function viewOf(finding: string | null, now: Date): Promise<SupervisorPageView> {
  const session = await memberSession();
  if (session.kind === 'demo') return { kind: 'page', ...demoSupervisor(now.toISOString()) };
  if (session.kind !== 'signed-in') return session;
  const reads = supervisorPageReads(session.db, session.user);
  return reads ? loadSupervisorPage(reads, finding, now) : { kind: 'closed' };
}

export default async function SupervisorRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = queryOf({ tab: one(params.tab), kind: one(params.kind), finding: one(params.finding), view: one(params.view) });
  return <SupervisorPage view={await viewOf(query.finding, new Date())} query={query} supabase={supervisorPageSupabase()} signinError={one(params.signin_error)} />;
}
