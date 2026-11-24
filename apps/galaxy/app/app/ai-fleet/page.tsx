import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { viewer } from '../../../src/data/viewer';
import { periodOf } from '../../../src/dashboard/board/period';
import { fleetPageOf, missionsBlock, one, roomBlock, runnersBlocks } from '../../../src/dashboard/fleet/blocks';
import { demoFleetBoard, loadFleetBoard } from '../../../src/dashboard/fleet/fleet';
import type { FleetView } from '../../../src/dashboard/fleet/FleetScreen';
import { AI_FLEET_PATH, fleetRedirect } from '../../../src/dashboard/fleet/redirect';
import { aiFleetNames } from '../../../src/dashboard/fleet/redirect.live';
import { DashboardSignIn } from '../../../src/dashboard/DashboardSignIn';
import { APP_CALLBACK } from '../../../src/dashboard/sign-in';
import { CouldNotLoad } from '../../../src/dashboard/Notes';
import { Notice } from '../../../src/ask/page/Notice';
import { AiFleetListScreen } from '../../../src/virtual-fleets/list/AiFleetList';
import { demoAiFleets } from '../../../src/virtual-fleets/list/list.demo';
import { loadAiFleets } from '../../../src/virtual-fleets/list/list.live';
import { loadFleetRunners } from '../../../src/virtual-fleets/runners/runners-tab.live';
import { BoardLoading } from '../../../src/skeleton/pages';
import { Streamed } from '../../../src/skeleton/Streamed';

// /app/ai-fleet (PRD 3233 s3): the AI fleets of the workspace, as their own menu entry under Inbox. Without `?fleet=`, the list: one row
// per fleet, read once with the Runners board. With `?fleet=<name>`, that fleet's page, today's tabs (`?tab=`), drawn by the Fleet
// screen; a name that is a players' fleet goes to /app/fleet with its query kept. Rendered per request, as the signed-in person.

export const metadata: Metadata = {
  title: 'AI Fleet · OMNI LOOP',
  description: 'The fleets of agents of the workspace: their missions, what waits on you and the runners they run on.',
  robots: { index: false, follow: false },
};

type Query = Record<string, string | string[] | undefined>;
type Screen = (view: FleetView, missions?: ReactNode, room?: ReactNode, runs?: { head: ReactNode; runners: ReactNode }) => ReactNode;
type Seen = Awaited<ReturnType<typeof viewer>>;

/** The page before anyone is signed in: the demo's list or fleet, the closed notice, or the sign-in card. */
function unsigned(seen: Exclude<Seen, { kind: 'signed-in' }>, asked: string | null, query: Query, screen: Screen, supabase: { url: string; key: string } | null): ReactNode {
  if (seen.kind === 'sign-in' && supabase) return <DashboardSignIn supabase={supabase} returnPath={APP_CALLBACK} error={one(query.signin_error)} />;
  return seen.kind === 'demo' ? demo(asked, query, screen) : screen({ kind: 'closed' });
}

/** The demo's list, or its fleet when one is asked. */
function demo(asked: string | null, query: Query, screen: Screen): ReactNode {
  const now = new Date();
  const { list: view, make } = demoAiFleets(now);
  return asked === null ? <AiFleetListScreen view={view} make={make} /> : screen(demoFleetBoard(asked, periodOf(one(query.period)), now));
}

/** The list of every AI fleet, streamed. */
function list(seen: Extract<Seen, { kind: 'signed-in' }>, screen: Screen): ReactNode {
  return (
    <Streamed read={loadAiFleets(seen.db, seen.user, new Date())} skeleton={<BoardLoading />}>
      {(read) => {
        if (read.kind === 'no-workspace') return screen({ kind: 'no-workspace' });
        if (read.kind === 'unreadable') return <Notice title="The AI fleets could not be loaded"><CouldNotLoad /></Notice>;
        return <AiFleetListScreen view={read.list} make={read.make} />;
      }}
    </Streamed>
  );
}

type Board = Extract<Awaited<ReturnType<typeof loadFleetBoard>>, { kind: 'board' }>;

/** The workspace an AI fleet's board was read in; null for a board that is not an AI fleet's. */
const aiWorkspaceOf = (view: Board): string | null => (view.virtual?.names.includes(view.fleet.name) === true ? view.virtual.workspace : null);

/** The head and the Runners tab of an AI fleet, from one read of the board; none for another fleet. */
function runsOf(seen: Extract<Seen, { kind: 'signed-in' }>, view: Awaited<ReturnType<typeof loadFleetBoard>>, query: Query): { head: ReactNode; runners: ReactNode } | undefined {
  const workspace = view.kind === 'board' ? aiWorkspaceOf(view) : null;
  if (view.kind !== 'board' || workspace === null) return undefined;
  return runnersBlocks(loadFleetRunners(seen.db, seen.user, workspace, { name: view.fleet.name, label: view.fleet.label }, new Date()), query);
}

/** One fleet's page, streamed. */
function fleet(seen: Extract<Seen, { kind: 'signed-in' }>, asked: string, query: Query, screen: Screen): ReactNode {
  return (
    <Streamed read={loadFleetBoard(seen.db, seen.user, asked, periodOf(one(query.period)), new Date())} skeleton={<BoardLoading />}>
      {(view) => screen(view, missionsBlock(seen.db, view, query), roomBlock(seen.db, view, query), runsOf(seen, view, query))}
    </Streamed>
  );
}

export default async function AiFleetPage({ searchParams }: { searchParams: Promise<Query> }) {
  const { query, asked, screen, supabase } = await fleetPageOf(searchParams);
  const seen = await viewer();
  if (seen.kind !== 'signed-in') return unsigned(seen, asked, query, screen, supabase);
  const moved = fleetRedirect(AI_FLEET_PATH, asked, await aiFleetNames(seen.db, seen.user), query);
  if (moved !== null) redirect(moved);
  return asked === null ? list(seen, screen) : fleet(seen, asked, query, screen);
}
