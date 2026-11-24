import { hrefWith, type Query } from '../board/links';

// Which of the two fleet pages a fleet belongs on (PRD 3233 s3, AC-8): an AI fleet's page is /app/ai-fleet?fleet=<name>, a
// players' fleet's /app/fleet?fleet=<name>. A link to the wrong one lands on the right one, every other query kept (`tab`
// included), so the links written before the move (pull requests, missions, notifications) still land.

export const PLAYERS_FLEET_PATH = '/app/fleet';
export const AI_FLEET_PATH = '/app/ai-fleet';

/** Where `?fleet=<asked>` of `from` should go instead, or null when it is on the right page. `names` are the workspace's AI fleets. */
export function fleetRedirect(from: typeof PLAYERS_FLEET_PATH | typeof AI_FLEET_PATH, asked: string | null, names: readonly string[], query: Query): string | null {
  if (asked === null) return null;
  const ai = names.includes(asked);
  if (from === PLAYERS_FLEET_PATH && ai) return hrefWith(AI_FLEET_PATH, query, {});
  if (from === AI_FLEET_PATH && !ai) return hrefWith(PLAYERS_FLEET_PATH, query, {});
  return null;
}
