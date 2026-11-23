// PRD 2898 s3, moved to the page by PRD 3194 s3: whether a PRD belongs to a mission, as the Omni page
// records it. The page holds a mission's brief, so it answers which missions name the PRD; a checkout's
// missions folder is no longer read for it. A page that cannot be read is never "in no mission": the
// answer is then the one line saying why, and the reader holds.
import { AskCallError } from '../ask/client.ts';
import type { askClient } from '../ask/client.ts';
import { field } from '../ask/schema.ts';
import type { PrdNumber } from '../ids.ts';

/** The missions naming a PRD, by number (empty when none does), or why the page could not say. */
export type Membership = { ok: true; missions: number[] } | { ok: false; why: string };

/** The one line a failed call is reported with, as `omni mission` words it. */
function whyOf(error: unknown): string {
  if (!(error instanceof AskCallError)) throw error;
  if (error.status === null) return 'unreachable';
  return error.reason ? `refused (${error.status}): ${error.reason}` : `refused (${error.status})`;
}

/** The missions of `repo` whose brief names PRD `prd`, read from the page; a reply without a list of numbers is a refusal. */
export function missionsOfPrd(client: ReturnType<typeof askClient>, repo: string, prd: PrdNumber): Promise<Membership> {
  return client.missionsOfPrd({ repo, prd }).then(
    (reply: unknown): Membership => {
      const missions = field(reply, 'missions');
      return Array.isArray(missions) && missions.every((one) => typeof one === 'number')
        ? { ok: true, missions: missions.filter((one): one is number => typeof one === 'number') }
        : { ok: false, why: 'refused (no missions in the reply)' };
    },
    (error: unknown): Membership => ({ ok: false, why: whyOf(error) }),
  );
}
