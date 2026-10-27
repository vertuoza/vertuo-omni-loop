// `fleet-board`: a pull request the loop signed, into the default branch, goes on the GitHub project board
// of its author's fleet (PRD 2530 s2). The webhook sends its event (./events.ts); this function decides,
// workspace by workspace:
//
//   step "workspaces"          every workspace that tracks the repository through the delivery's own
//                              installation (./store.ts): each is handled on its own, with its own fleets
//   step "fleet-<workspace>"   the author's active fleet there, its login matched case-insensitively; none,
//                              or a fleet with no board: nothing is called and nothing is written
//   step "add-<workspace>"     the card, through GitHub's GraphQL (./github.ts): the project's node id, then
//                              `addProjectV2ItemById`; a refusal is an answer, never retried
//   step "note-<workspace>"    the outcome on the fleet: `Added #<n> · <owner>/<repo>`, or
//                              `Not added: ask an org admin` (the App may not write the organization's
//                              projects), or `Not added: no such project`
//
// A GitHub error of 5xx or a rate limit fails its step, and Inngest retries the run twice. Nothing is ever
// posted on the pull request. Adding a card already on the board changes nothing, so a replayed event is
// harmless.
//
// `createFleetBoard` takes the Inngest client, `octokitFor(installationId)` and the store, so a test runs
// the real function against a faked GitHub and an in-memory store. No store (no database): the run ends
// before reading anything.
import type { Inngest } from 'inngest';
import { z } from 'zod';
import { parseOrThrow } from 'omni-loop/kit/lib/schema/parse-or-throw.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { savedStep } from '../saved-step.ts';
import { FLEET_BOARD_EVENT, FleetBoardDataSchema, type FleetBoardData } from './events.ts';
import { addToBoard, AddedSchema, type Added, type GraphqlOctokit } from './github.ts';
import { FleetSchema, NOTE_MAX, type FleetBoardStore } from './store.ts';

export const FLEET_BOARD_FUNCTION_ID = 'fleet-board';

/** A GitHub error of 5xx or a rate limit is retried twice; a refusal never is. */
const RETRIES = 2;

export type FleetBoardDeps = {
  client: Inngest.Any;
  octokitFor: OctokitFor<GraphqlOctokit>;
  /** The fleets, as the service role; `null` (no database): nothing is read or added. */
  store: FleetBoardStore | null;
  /** The clock the note is dated with. */
  now?: () => Date;
};

/** What the run did in one workspace. */
type WorkspaceOutcome = { workspace: string; skipped: string } | { workspace: string; fleet: string; skipped: string } | { workspace: string; fleet: string; note: string };

const WorkspacesSchema = z.array(z.string().min(1));
const NotedSchema = z.object({ noted: z.boolean() });

export function createFleetBoard({ client, octokitFor, store, now = () => new Date() }: FleetBoardDeps) {
  return client.createFunction(
    { id: FLEET_BOARD_FUNCTION_ID, name: 'omni-loop · fleet board', triggers: [{ event: FLEET_BOARD_EVENT }], retries: RETRIES },
    async ({ event, step }) => {
      const data = parseOrThrow(FleetBoardDataSchema, event.data, `The ${FLEET_BOARD_EVENT} event carries an unexpected shape`);
      const pull = `${data.repository}#${String(data.prNumber)}`;
      if (!store) return { pull, skipped: 'no database to read the fleets from' };

      const workspaces = await savedStep(step, 'workspaces', WorkspacesSchema, () => store.workspaces({ installationId: data.installationId, repository: data.repository }));
      const outcomes: WorkspaceOutcome[] = [];
      for (const workspace of workspaces) {
        const fleet = await savedStep(step, `fleet-${workspace}`, FleetSchema.nullable(), () => store.fleetOf({ workspace, login: data.author }));
        if (!fleet) {
          outcomes.push({ workspace, skipped: 'the author is in no active fleet' });
          continue;
        }
        const board = fleet.projectUrl;
        if (!board) {
          outcomes.push({ workspace, fleet: fleet.name, skipped: 'the fleet has no board' });
          continue;
        }
        const added = await savedStep(step, `add-${workspace}`, AddedSchema, async () => addToBoard(await octokitFor(data.installationId), { url: board, contentId: data.nodeId }));
        const note = noteOf(added, data);
        await savedStep(step, `note-${workspace}`, NotedSchema, () => store.note({ workspace, fleet: fleet.name, projectUrl: board, note, at: now().toISOString() }));
        outcomes.push({ workspace, fleet: fleet.name, note });
      }
      return { pull, workspaces: outcomes };
    },
  );
}

/** The fleet's note for what adding the card came to, at most `NOTE_MAX` characters. */
function noteOf(added: Added, { owner, repo, prNumber }: Pick<FleetBoardData, 'owner' | 'repo' | 'prNumber'>): string {
  if (added.outcome === 'added') return `Added #${String(prNumber)} · ${owner}/${repo}`.slice(0, NOTE_MAX);
  return added.reason === 'permission' ? 'Not added: ask an org admin' : 'Not added: no such project';
}
