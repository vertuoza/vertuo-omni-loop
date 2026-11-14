import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { supabaseEnv } from '../../../src/data/supabase-server';
import { viewer } from '../../../src/data/viewer';
import { periodOf, type Period } from '../../../src/dashboard/board/period';
import { demoFleetBoard, loadFleetBoard } from '../../../src/dashboard/fleet/fleet';
import { FleetScreen, type FleetView } from '../../../src/dashboard/fleet/FleetScreen';
import { tabOf } from '../../../src/dashboard/fleet/tabs';
import { loadMissionsTab } from '../../../src/missions/page/missions-tab.live';
import { MissionsTab } from '../../../src/missions/page/MissionsTab';
import { loadRoom } from '../../../src/missions/room/room.live';
import { RoomTab } from '../../../src/missions/room/RoomTab';
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

/** A query value, or null when absent or empty. */
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || null;

type Seen = Awaited<ReturnType<typeof viewer>>;

function viewOf(seen: Exclude<Seen, { kind: 'signed-in' }>, asked: string | null, period: Period, now: Date): FleetView {
  return seen.kind === 'demo' ? demoFleetBoard(asked, period, now) : { kind: seen.kind };
}

/** PRD 2842 s7: the Missions tab of a virtual fleet streams in its own block, read as the signed-in person; any other tab, or fleet, has none. */
function missionsBlock(db: Parameters<typeof loadMissionsTab>[0], view: FleetView, query: Record<string, string | string[] | undefined>): ReactNode {
  if (view.kind !== 'board' || !view.virtual?.workspace || !view.virtual.names.includes(view.fleet.name) || tabOf(query.tab) !== 'missions') return undefined;
  return (
    <Streamed read={loadMissionsTab(db, view.virtual.workspace, view.fleet.name)} skeleton={<p className="fleet-line ask-muted">Loading the missions…</p>}>
      {(missions) => <MissionsTab view={missions} />}
    </Streamed>
  );
}

/** PRD 2842 s8: the Operation room (the default tab) of a virtual fleet streams in its own block, read as the signed-in person. */
function roomBlock(db: Parameters<typeof loadRoom>[0], view: FleetView, query: Record<string, string | string[] | undefined>): ReactNode {
  if (view.kind !== 'board' || !view.virtual?.workspace || !view.virtual.names.includes(view.fleet.name) || tabOf(query.tab) !== 'room') return undefined;
  const keep = Object.fromEntries(Object.entries(query).flatMap(([name, value]) => (name === 'role' || name === 'mission' || one(value) === null ? [] : [[name, one(value) ?? '']])));
  return (
    <Streamed read={loadRoom(db, view.virtual.workspace, view.fleet.name, view.fleet.color, query)} skeleton={<p className="fleet-line ask-muted">Loading the room…</p>}>
      {(room) => <RoomTab view={room} keep={keep} />}
    </Streamed>
  );
}

export default async function FleetPage({ searchParams }: Props) {
  const query = await searchParams;
  const period = periodOf(one(query.period));
  const asked = one(query.fleet);
  const now = new Date();
  const screen = (view: FleetView, missions?: ReactNode, room?: ReactNode) => (
    <FleetScreen view={view} supabase={supabaseEnv()} signinError={one(query.signin_error)} query={query} missions={missions} room={room} />
  );
  const seen = await viewer();
  if (seen.kind !== 'signed-in') return screen(viewOf(seen, asked, period, now));
  return (
    <Streamed read={loadFleetBoard(seen.db, seen.user, asked, period, now)} skeleton={<BoardLoading />}>
      {(view) => screen(view, missionsBlock(seen.db, view, query), roomBlock(seen.db, view, query))}
    </Streamed>
  );
}
