import type { Metadata } from 'next';
import { supabaseEnv } from '../../../src/data/supabase-server';
import { viewer } from '../../../src/data/viewer';
import { periodOf, type Period } from '../../../src/dashboard/board/period';
import { demoWorkspaceBoard, loadWorkspaceBoard } from '../../../src/dashboard/board/workspace';
import { WorkspaceScreen, type WorkspaceView } from '../../../src/dashboard/board/WorkspaceScreen';

// /app/workspace (PRD 572): the board of the whole workspace, every member in its People table, then
// the season's fleet ranking. Rendered per request, as the signed-in person, as /app is, so row-level
// security and the two dashboard functions decide what each read returns. The period is the query's
// (`?period=7d|30d|season`, 7 days otherwise). It decides the situation once: the demo world in
// development (or OMNI_LOOP_DEMO=1); with no database, closed; signed out, the sign-in card; signed
// in, the board, or the notice for an account in no workspace.

export const metadata: Metadata = {
  title: 'Workspace · OMNI LOOP',
  description: 'The whole workspace’s board: every member, the PRs merged and PRDs moved per day, and the repositories the work touched.',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

async function viewOf(period: Period, now: Date): Promise<WorkspaceView> {
  const seen = await viewer();
  if (seen.kind === 'demo') return demoWorkspaceBoard(period, now);
  if (seen.kind !== 'signed-in') return { kind: seen.kind };
  return loadWorkspaceBoard(seen.db, seen.user, period, now);
}

export default async function WorkspacePage({ searchParams }: Props) {
  const query = await searchParams;
  const period = periodOf(one(query.period));
  return (
    <WorkspaceScreen
      view={await viewOf(period, new Date())}
      supabase={supabaseEnv()}
      signinError={one(query.signin_error)}
      query={query}
    />
  );
}
