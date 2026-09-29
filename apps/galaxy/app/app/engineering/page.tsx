import type { Metadata } from 'next';
import { firstParam as one, memberSession } from '../../../src/data/member-session';
import { supabaseEnv } from '../../../src/data/supabase-server';
import { periodOf, type Period } from '../../../src/dashboard/board/period';
import { demoEngineeringBoard } from '../../../src/engineering/demo';
import { loadEngineeringBoard } from '../../../src/engineering/load';
import { EngineeringScreen, type EngineeringView } from '../../../src/engineering/EngineeringScreen';
import { sortOf, type SortKey } from '../../../src/engineering/tally';

// /app/engineering (PRD 612 s3): the workspace's pull requests over its tracked repositories, for
// every member. Rendered per request, as the signed-in person, as /app/workspace is, so row-level
// security decides what each read returns. The period is the query's (`?period=7d|30d|season`, 7 days
// otherwise), and so is the table's sort (`?sort=`, merged otherwise). It decides the situation once:
// the demo in development (or OMNI_LOOP_DEMO=1); with no database, closed; signed out, the sign-in
// card; signed in, the board, or the notice for an account in no workspace.

export const metadata: Metadata = {
  title: 'Engineering · OMNI LOOP',
  description: 'The workspace’s pull requests over its tracked repositories: opened, merged, open now, time to merge, who opens, merges and reviews the most, and Omni Loop’s share.',
  robots: { index: false, follow: false },
};

async function viewOf(period: Period, sort: SortKey, now: Date): Promise<EngineeringView> {
  const session = await memberSession();
  if (session.kind === 'demo') return demoEngineeringBoard(period, sort, now);
  if (session.kind !== 'signed-in') return session;
  return loadEngineeringBoard(session.db, session.user, { period, sort, now });
}

export default async function EngineeringPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const period = periodOf(one(query.period));
  return (
    <EngineeringScreen
      view={await viewOf(period, sortOf(one(query.sort)), new Date())}
      period={period}
      supabase={supabaseEnv()}
      signinError={one(query.signin_error)}
      query={query}
    />
  );
}
