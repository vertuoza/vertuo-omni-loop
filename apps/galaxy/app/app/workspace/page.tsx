import type { Metadata } from 'next';
import { supabaseEnv } from '../../../src/data/supabase-server';
import { viewer } from '../../../src/data/viewer';
import { periodOf, type Period } from '../../../src/dashboard/board/period';
import { demoWorkspaceBoard, loadWorkspaceBoard } from '../../../src/dashboard/board/workspace';
import { WorkspaceScreen, type WorkspaceView } from '../../../src/dashboard/board/WorkspaceScreen';
import { BoardLoading } from '../../../src/skeleton/pages';
import { Streamed } from '../../../src/skeleton/Streamed';

// /app/workspace (PRD 572): the board of the whole workspace, every member in its People table, then
// the season's fleet ranking. Rendered per request, as the signed-in person, as /app is, so row-level
// security and the two dashboard functions decide what each read returns. The period is the query's
// (`?period=7d|30d|season`, 7 days otherwise). It decides the situation once: the demo world in
// development (or OMNI_LOOP_DEMO=1); with no database, closed; signed out, the sign-in card; signed
// in, the board, or the notice for an account in no workspace. PRD 657 s4: a signed-in person's board
// streams in its own block, under its skeleton, so the frame is sent before the board is read.

export const metadata: Metadata = {
  title: 'Workspace · OMNI LOOP',
  description: 'The whole workspace’s board: every member, the PRs merged and PRDs moved per day, and the repositories the work touched.',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

type Seen = Awaited<ReturnType<typeof viewer>>;

function viewOf(seen: Exclude<Seen, { kind: 'signed-in' }>, period: Period, now: Date): WorkspaceView {
  return seen.kind === 'demo' ? demoWorkspaceBoard(period, now) : { kind: seen.kind };
}

export default async function WorkspacePage({ searchParams }: Props) {
  const query = await searchParams;
  const period = periodOf(one(query.period));
  const now = new Date();
  const screen = (view: WorkspaceView) => (
    <WorkspaceScreen view={view} supabase={supabaseEnv()} signinError={one(query.signin_error)} query={query} />
  );
  const seen = await viewer();
  if (seen.kind !== 'signed-in') return screen(viewOf(seen, period, now));
  return (
    <Streamed read={loadWorkspaceBoard(seen.db, seen.user, period, now)} skeleton={<BoardLoading />}>
      {screen}
    </Streamed>
  );
}
