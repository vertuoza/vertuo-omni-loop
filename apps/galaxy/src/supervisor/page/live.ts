import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '../../../../../supabase/database.types.ts';
import { supabaseEnv } from '../../data/supabase-server';
import { memberWorkspace } from '../../data/workspace';
import { supervisorDeps } from '../api/supervisor.live';
import type { Served, Viewer } from '../api/supervisor.service';
import type { SupervisorPageReads } from './load';
import { seatRunnerRepository } from './seat-runner.repository';

// The Supervisor page's real reads (PRD omni-loop-34 s5): the workspace and the seat's runner as the signed-in person
// (row-level security), everything else through the Supervisor API's service, as the service role, which holds the
// rules itself (../api/supervisor.live.ts): the person is checked a member of the workspace first, once per read of
// the page. Null when this deployment has no service role: the page is closed. The sign-in card's Supabase settings
// are read here too, so the page itself reaches no database module.

/** The browser's Supabase settings for the sign-in card, or null with no database. */
export const supervisorPageSupabase = () => supabaseEnv();

export function supervisorPageReads(db: SupabaseClient<Database>, user: Pick<User, 'id'>): SupervisorPageReads | null {
  const { service } = supervisorDeps();
  if (!service) return null;
  const people = new Map<string, Promise<Served<Viewer & { kind: 'person' }>>>();
  const person = (workspace: string) => {
    const known = people.get(workspace) ?? service.person(user.id, workspace);
    people.set(workspace, known);
    return known;
  };
  const as = async <T>(workspace: string, read: (viewer: Viewer) => Promise<Served<T>>): Promise<Served<T>> => {
    const viewer = await person(workspace);
    return viewer.ok ? read(viewer.value) : viewer;
  };
  const runners = seatRunnerRepository(db);
  return {
    workspace: () => memberWorkspace(db, user.id),
    role: async (workspace) => {
      const viewer = await person(workspace);
      return viewer.ok ? { ok: true, value: { owner: viewer.value.owner } } : viewer;
    },
    seat: (workspace) => as(workspace, (viewer) => service.seatRead(viewer)),
    findings: (workspace, open) => as(workspace, (viewer) => service.findings(viewer, open)),
    messages: (workspace, finding) => as(workspace, (viewer) => service.messages(viewer, finding, null)),
    notes: (workspace) => as(workspace, (viewer) => service.memory(viewer, null)),
    runner: (id) => runners.runner(id),
  };
}
