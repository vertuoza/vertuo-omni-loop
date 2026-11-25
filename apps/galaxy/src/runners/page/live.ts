import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '../../../../../supabase/database.types.ts';
import { supabaseEnv } from '../../data/supabase-server';
import { memberWorkspace } from '../../data/workspace';
import { serviceDb } from '../../data/sign-in-live';
import { runnersDeps } from '../runners.live';
import { supervisorDeps } from '../../supervisor/api/supervisor.live';
import { standOf } from './fix.live';
import { fleetsRepository } from './fleets.repository';
import { readHistory } from '../../dossier/page/source';
import type { RunnersPageReads } from './load';
import { prdKey } from './model';

// The Runners page's real reads (PRD 1830 s3): the workspace and the fleets as the signed-in person
// (row-level security), the board through the runners' service, as the service role, which holds the
// rules itself (../runners.live.ts). Null when this deployment has no service role: the page is closed.
// The Supervisor's seat is read through its own service as the person, a member checked first (PRD omni-loop-34 s8);
// a deployment without it serves no seat. The sign-in card's Supabase settings are read here too, so the page itself reaches no database module.

/** The browser's Supabase settings for the sign-in card, or null with no database. */
export const runnersPageSupabase = () => supabaseEnv();

export function runnersPageReads(db: SupabaseClient<Database>, user: Pick<User, 'id'>): RunnersPageReads | null {
  const { service } = runnersDeps();
  if (!service) return null;
  const fleets = fleetsRepository(db);
  const supervisor = supervisorDeps().service;
  return {
    workspace: () => memberWorkspace(db, user.id),
    board: (workspaceId) => service.board(user.id, workspaceId),
    fleets: (workspaceId) => fleets.fleets(workspaceId),
    stand: standOf(serviceDb()),
    ...(supervisor === null ? {} : {
      seat: async (workspaceId: string) => {
        const viewer = await supervisor.person(user.id, workspaceId);
        if (!viewer.ok) throw new Error(viewer.error);
        const seat = await supervisor.seatRead(viewer.value);
        if (!seat.ok) throw new Error(seat.error);
        return seat.value;
      },
    }),
    prds: async () => Object.fromEntries((await readHistory(db)).filter((row) => row.prd !== null).map((row) => [prdKey(row.home_repo, row.prd ?? 0), row.title])),
  };
}
