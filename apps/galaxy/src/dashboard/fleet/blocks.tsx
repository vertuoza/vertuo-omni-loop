import type { ReactNode } from 'react';
import { loadMissionsTab } from '../../missions/page/missions-tab.live';
import { MissionsTab } from '../../missions/page/MissionsTab';
import { loadRoom } from '../../missions/room/room.live';
import { RoomTab } from '../../missions/room/RoomTab';
import { Streamed } from '../../skeleton/Streamed';
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


/** What both fleet pages start from (PRD 3233 s3): the query, the fleet asked for and the screen drawn for a view. */
export async function fleetPageOf(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const query = await searchParams;
  const screen = (view: FleetView, missions?: ReactNode, room?: ReactNode) => (
    <FleetScreen view={view} supabase={supabaseEnv()} signinError={one(query.signin_error)} query={query} missions={missions} room={room} />
  );
  return { query, asked: one(query.fleet), screen, supabase: supabaseEnv() };
}
