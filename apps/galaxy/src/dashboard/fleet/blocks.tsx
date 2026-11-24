import type { ReactNode } from 'react';
import { loadMissionsTab } from '../../missions/page/missions-tab.live';
import { MissionsTab } from '../../missions/page/MissionsTab';
import { loadRoom } from '../../missions/room/room.live';
import { RoomTab } from '../../missions/room/RoomTab';
import { Streamed } from '../../skeleton/Streamed';
import { CouldNotLoad } from '../Notes';
import { listedAnswer } from '../../runners/page/need-human';
import { terminalOf } from '../../runners/page/terminal-model';
import { FleetHeadLines } from '../../virtual-fleets/runners/RunsOn';
import { RunnersTabScreen } from '../../virtual-fleets/runners/RunnersTab';
import type { FleetRunnersRead } from '../../virtual-fleets/runners/runners-tab.live';
import { AI_FLEET_PATH } from './redirect';
import { hrefWith } from '../board/links';
import { supabaseEnv } from '../../data/supabase-server';
import { FleetScreen, type FleetView } from './FleetScreen';
import { tabOf } from './tabs';

// The blocks an AI fleet's tabs stream in (PRD 2842 s7, s8), shared by /app/fleet and /app/ai-fleet (PRD 3233 s3).

/** A query value, or null when absent or empty. */
export const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || null;

/** PRD 2842 s7: the Missions tab of a virtual fleet streams in its own block, read as the signed-in person; any other tab, or fleet, has none. */
export function missionsBlock(db: Parameters<typeof loadMissionsTab>[0], view: FleetView, query: Record<string, string | string[] | undefined>): ReactNode {
  if (view.kind !== 'board' || !view.virtual?.workspace || !view.virtual.names.includes(view.fleet.name) || tabOf(query.tab) !== 'missions') return undefined;
  return (
    <Streamed read={loadMissionsTab(db, view.virtual.workspace, view.fleet.name)} skeleton={<p className="fleet-line ask-muted">Loading the missions…</p>}>
      {(missions) => <MissionsTab view={missions} />}
    </Streamed>
  );
}

/** PRD 2842 s8: the Operation room (the default tab) of a virtual fleet streams in its own block, read as the signed-in person. */
export function roomBlock(db: Parameters<typeof loadRoom>[0], view: FleetView, query: Record<string, string | string[] | undefined>): ReactNode {
  if (view.kind !== 'board' || !view.virtual?.workspace || !view.virtual.names.includes(view.fleet.name) || tabOf(query.tab) !== 'room') return undefined;
  const keep = Object.fromEntries(Object.entries(query).flatMap(([name, value]) => (name === 'role' || name === 'mission' || one(value) === null ? [] : [[name, one(value) ?? '']])));
  return (
    <Streamed read={loadRoom(db, view.virtual.workspace, view.fleet.name, view.fleet.color, query)} skeleton={<p className="fleet-line ask-muted">Loading the room…</p>}>
      {(room) => <RoomTab view={room} keep={keep} />}
    </Streamed>
  );
}

/** PRD 3233 s4: the head under an AI fleet's name (its mission line and Runs on) and, on the Runners tab, the tab itself, both from one read of the board. */
export function runnersBlocks(read: Promise<FleetRunnersRead>, query: Record<string, string | string[] | undefined>): { head: ReactNode; runners: ReactNode } {
  const head = (
    <Streamed read={read} skeleton={<p className="fleet-line ask-muted">Loading the runners…</p>}>
      {(value) => (value.kind === 'ok' ? <FleetHeadLines head={value.head} href={hrefWith(AI_FLEET_PATH, query, { tab: 'runners' })} /> : <CouldNotLoad />)}
    </Streamed>
  );
  if (tabOf(query.tab) !== 'runners') return { head, runners: undefined };
  const runners = (
    <Streamed read={read} skeleton={<p className="fleet-line ask-muted">Loading the runners…</p>}>
      {(value) => {
        if (value.kind !== 'ok') return <CouldNotLoad />;
        const asked = listedAnswer(one(query.answer), value.board.jobs);
        const names = new Map(value.board.runners.map((runner) => [runner.id, runner.name]));
        return (
          <RunnersTabScreen
            tab={value.tab}
            terminal={value.board.jobs.map((job) => ({ id: job.id, repo: job.repo, runner: job.runner === null ? null : names.get(job.runner) ?? null, status: job.status }))}
            need={value.board.jobs.map((job) => ({ id: job.id, repo: job.repo }))}
            openTerminal={terminalOf(one(query.terminal))}
            openAnswer={asked}
          />
        );
      }}
    </Streamed>
  );
  return { head, runners };
}

/** What both fleet pages start from (PRD 3233 s3): the query, the fleet asked for and the screen drawn for a view. */
export async function fleetPageOf(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const query = await searchParams;
  const screen = (view: FleetView, missions?: ReactNode, room?: ReactNode, runs?: { head: ReactNode; runners: ReactNode }) => (
    <FleetScreen view={view} supabase={supabaseEnv()} signinError={one(query.signin_error)} query={query} missions={missions} room={room} head={runs?.head} runners={runs?.runners} />
  );
  return { query, asked: one(query.fleet), screen, supabase: supabaseEnv() };
}
