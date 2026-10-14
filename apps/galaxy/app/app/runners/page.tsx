import type { Metadata } from 'next';
import { firstParam as one, memberSession } from '../../../src/data/member-session';
import { demoRunnersPage } from '../../../src/runners/page/demo';
import { runnersPageReads, runnersPageSupabase } from '../../../src/runners/page/live';
import { loadRunnersPage } from '../../../src/runners/page/load';
import type { RunnersPageView } from '../../../src/runners/page/model';
import { RunnersPage } from '../../../src/runners/page/RunnersPage';

// /app/runners (PRD 1830 s3): the workspace's runners, their state and fleet, and the jobs sent to them
// with their pull request and a Terminal on each job's live log (PRD 1904; `?terminal=<job id>` opens it).
// Rendered per request, as the signed-in person, as /app/loop is.
// It decides the situation once: the demo in development (or OMNI_LOOP_DEMO=1); with no database, or no
// service role to read the runners with, closed; signed out, the sign-in card; signed in, the board, or
// the notice for an account in no workspace. The page reads itself again every 5 s while it is open.

export const metadata: Metadata = {
  title: 'Runners · OMNI LOOP',
  description: 'The workspace\'s runners: which machines are online, what each one runs, and where each job ended.',
  robots: { index: false, follow: false },
};

async function viewOf(now: Date): Promise<RunnersPageView> {
  const session = await memberSession();
  if (session.kind === 'demo') return demoRunnersPage(now);
  if (session.kind !== 'signed-in') return session;
  const reads = runnersPageReads(session.db, session.user);
  return reads ? loadRunnersPage(reads, now) : { kind: 'closed' };
}

export default async function RunnersRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <RunnersPage view={await viewOf(new Date())} supabase={runnersPageSupabase()} signinError={one(query.signin_error)} terminal={one(query.terminal)} />;
}
