// The fleet board's store (PRD 2530 s2), as the service role (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`):
// the App has no person's session. It reads only what the delivery's own installation reaches, and writes
// only a fleet's note:
//
//   workspaces  every workspace that tracks the repository (`repositories.tracked`, not removed) and whose
//               `github_installation_id` is the delivery's installation: never a workspace of another
//               installation
//   fleetOf     in one workspace, the active fleet (`teams.retired_at` null) of the player whose
//               `github_login` is the author's, matched case-insensitively, with its board; none when the
//               author is no player there, is in no fleet, or the fleet is retired
//   jobFleet    in one workspace, the runner job whose `prs` holds the pull request's link: `found` says a
//               job holds it, `fleet` the active fleet of the person who sent it (`sent_by` → their player
//               there); a job sent by an API key (`sent_by_key`) or by the App has no person: found, no fleet
//   note        the fleet's `project_note` (at most 200 characters) and `project_noted_at`, only while the
//               fleet still holds the board the card went to: a board cleared or changed meanwhile keeps
//               no note of the old one
//
// Throws when the database refuses or answers out of shape: the step retries.
import { z } from 'zod';
import type { Connection } from '../approved-check/record.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';

/** A fleet as the board reads it: its name and its board's link, `null` when it has none. */
export const FleetSchema = z.object({ name: z.string().min(1), projectUrl: z.string().nullable() });
export type Fleet = z.infer<typeof FleetSchema>;

/** What the runner job of a pull request's link says: whether one holds it, and its sender's fleet. */
export const JobFleetSchema = z.object({ found: z.boolean(), fleet: FleetSchema.nullable() });
export type JobFleet = z.infer<typeof JobFleetSchema>;

export type FleetBoardStore = {
  workspaces(input: { installationId: number; repository: string }): Promise<string[]>;
  fleetOf(input: { workspace: string; login: string }): Promise<Fleet | null>;
  jobFleet(input: { workspace: string; url: string }): Promise<JobFleet>;
  note(input: { workspace: string; fleet: string; projectUrl: string; note: string; at: string }): Promise<{ noted: boolean }>;
};

/** The longest note the database keeps (`teams_project_note_length`). */
export const NOTE_MAX = 200;

/** A GitHub login: letters, digits and single hyphens. Anything else (a bot's `[bot]`) is no player's. */
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

/** The columns each read selects, shared with ./store.boundary.ts. */
export const TRACKED = 'workspace_id, workspaces!inner(github_installation_id)';
export const PLAYER = 'team';
export const JOB = 'sent_by, sent_by_key';
export const TEAM = 'name, project_url';

/** A tracking workspace, as the read returns it. */
export const TrackedRowSchema = z.object({ workspace_id: z.string().min(1), workspaces: z.object({ github_installation_id: z.union([z.number(), z.string()]).nullable() }) });
/** A player's fleet. */
export const PlayerRowSchema = z.object({ team: z.string().nullable() });
/** A runner job's sender: a person, or none (an API key, or the App). */
export const JobRowSchema = z.object({ sent_by: z.string().nullable(), sent_by_key: z.string().nullable() });
/** A fleet and its board. */
export const TeamRowSchema = z.object({ name: z.string().min(1), project_url: z.string().nullable() });

/** The store, as the service role on `connection`. */
export function fleetBoardStore(connection: Connection): FleetBoardStore {
  const db = serviceDb(connection);
  async function activeFleet(workspace: string, name: string): Promise<Fleet | null> {
    const [team] = rowsOf(TeamRowSchema, await db.from('teams').select(TEAM).eq('workspace_id', workspace).eq('name', name).is('retired_at', null).limit(1));
    return team ? { name: team.name, projectUrl: team.project_url } : null;
  }
  return {
    async workspaces({ installationId, repository }) {
      const rows = rowsOf(
        TrackedRowSchema,
        await db
          .from('repositories')
          .select(TRACKED)
          .eq('full_name', repository.toLowerCase())
          .eq('tracked', true)
          .is('removed_at', null)
          .eq('workspaces.github_installation_id', installationId)
          .order('workspace_id'),
      );
      return [...new Set(rows.filter((row) => Number(row.workspaces.github_installation_id) === installationId).map((row) => row.workspace_id))];
    },

    async fleetOf({ workspace, login }) {
      if (!LOGIN.test(login)) return null;
      const [player] = rowsOf(PlayerRowSchema, await db.from('players').select(PLAYER).eq('workspace_id', workspace).ilike('github_login', login).not('team', 'is', null).limit(1));
      if (!player?.team) return null;
      return activeFleet(workspace, player.team);
    },

    async jobFleet({ workspace, url }) {
      const [job] = rowsOf(
        JobRowSchema,
        await db.from('runner_jobs').select(JOB).eq('workspace_id', workspace).contains('prs', JSON.stringify([url])).order('queued_at', { ascending: false }).limit(1),
      );
      if (!job) return { found: false, fleet: null };
      if (!job.sent_by || job.sent_by_key) return { found: true, fleet: null };
      const [player] = rowsOf(PlayerRowSchema, await db.from('players').select(PLAYER).eq('workspace_id', workspace).eq('user_id', job.sent_by).not('team', 'is', null).limit(1));
      return { found: true, fleet: player?.team ? await activeFleet(workspace, player.team) : null };
    },

    async note({ workspace, fleet, projectUrl, note, at }) {
      const written = rowsOf(
        TeamRowSchema,
        await db
          .from('teams')
          .update({ project_note: note.slice(0, NOTE_MAX), project_noted_at: at })
          .eq('workspace_id', workspace)
          .eq('name', fleet)
          .eq('project_url', projectUrl)
          .select(TEAM),
      );
      return { noted: written.length > 0 };
    },
  };
}
