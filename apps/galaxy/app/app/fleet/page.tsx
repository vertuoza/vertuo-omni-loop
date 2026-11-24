import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { viewer } from '../../../src/data/viewer';
import { periodOf, type Period } from '../../../src/dashboard/board/period';
import { demoFleetBoard, loadFleetBoard } from '../../../src/dashboard/fleet/fleet';
import type { FleetView } from '../../../src/dashboard/fleet/FleetScreen';
import { PLAYERS_FLEET_PATH, fleetRedirect } from '../../../src/dashboard/fleet/redirect';
import { aiFleetNames } from '../../../src/dashboard/fleet/redirect.live';
import { fleetPageOf, missionsBlock, one, roomBlock } from '../../../src/dashboard/fleet/blocks';
import { BoardLoading } from '../../../src/skeleton/pages';
import { Streamed } from '../../../src/skeleton/Streamed';

// /app/fleet (PRD 572): the board of one fleet, the viewer's by default, any fleet by `?fleet=<name>`,
// under a picker of every fleet that keeps the period. Rendered per request, as the signed-in person,
// as /app/workspace is. The period is the query's (`?period=7d|30d|season`, 7 days otherwise). It
// decides the situation once: the demo world in development (or OMNI_LOOP_DEMO=1); with no database,
// closed; signed out, the sign-in card; signed in, the fleet's board, the picker, the no-fleet line,
// or the notice for an account in no workspace. PRD 657 s4: a signed-in person's fleet (its picker,
// its heading and its board, all drawn from the one read) streams in its own block, under its
// skeleton, so the frame is sent before the board is read.

export const metadata: Metadata = {
  title: 'Fleet · OMNI LOOP',
  description: 'A fleet’s board: its members, the PRs merged and PRDs moved per day, and its place this season.',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

type Seen = Awaited<ReturnType<typeof viewer>>;

function viewOf(seen: Exclude<Seen, { kind: 'signed-in' }>, asked: string | null, period: Period, now: Date): FleetView {
  return seen.kind === 'demo' ? demoFleetBoard(asked, period, now) : { kind: seen.kind };
}

export default async function FleetPage({ searchParams }: Props) {
  const { query, asked, screen } = await fleetPageOf(searchParams);
  const period = periodOf(one(query.period));
  const now = new Date();
  const seen = await viewer();
  if (seen.kind !== 'signed-in') return screen(viewOf(seen, asked, period, now));
  // PRD 3233 s3: an AI fleet's page is on AI Fleet; a link written before the move lands there, its query kept.
  const moved = asked === null ? null : fleetRedirect(PLAYERS_FLEET_PATH, asked, await aiFleetNames(seen.db, seen.user), query);
  if (moved !== null) redirect(moved);
  return (
    <Streamed read={loadFleetBoard(seen.db, seen.user, asked, period, now)} skeleton={<BoardLoading />}>
      {(view) => screen(view, missionsBlock(seen.db, view, query), roomBlock(seen.db, view, query))}
    </Streamed>
  );
}
