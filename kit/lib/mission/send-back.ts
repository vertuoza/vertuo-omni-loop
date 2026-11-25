// A person sends a PM product PRD back to the PM (bug #3302). Pure: what the waiting line of such a PRD says, which a send-back is
// offered on, and what the person's event says. `omni mission send-back`, the Omni app, the Missions tab and the App's supervisor
// (apps/omni-app/src/missions/tech.ts) read the same words.
//
//   the PRD        a product PRD the mission's PM wrote at `alone`, waiting on a person once the Architect left it to them, the PM's
//                  own plan approval went to them, or the PM's and the Architect's rounds were spent without one plan version
//   the send-back  a person's own event, `sent-back`, signed with their login, naming the PRD and the last plan or tech decision it
//                  follows: no decision is edited (BR-PRODUCT-12). The rounds restart from it: the PM is sent its plan job again with the
//                  Architect's latest open points (read through `omni mission get`), then the Architect reviews what it approves
import type { ProductPrdId } from '../ids.ts';

/** The event a person's send-back is recorded as. */
export const SENT_BACK = 'sent-back';

/** What a PM product PRD waits on once the Architect escalated it to a person: its reasons follow. */
export const architectLeftWords = (prd: ProductPrdId): string => `PRD ${prd}: the Architect left it to you`;

/** What a PM product PRD waits on once the PM's own plan approval escalated: its reasons follow. */
export const pmLeftWords = (prd: ProductPrdId): string => `PRD ${prd}: the PM's plan approval went to you`;

/** What a PM product PRD waits on once its rounds are spent without one plan version: the rounds follow. */
export const roundsSpentWords = (prd: ProductPrdId): string => `PRD ${prd}: the PM and the Architect did not approve one plan version`;

/** Whether a mission's waiting line holds PM product PRD `prd` waiting on a person after its review: what a send-back is offered on. */
export function waitsOnReview(waitingOn: string | null, prd: ProductPrdId): boolean {
  const parts = (waitingOn ?? '').split(' · ');
  return parts.some((part) => [architectLeftWords(prd), pmLeftWords(prd), roundsSpentWords(prd)].some((words) => part.startsWith(words)));
}

/** What the person's send-back says in the mission's events. */
export const sentBackSentence = (login: string, prd: ProductPrdId): string =>
  `${login} sent PRD ${prd} back to the PM: one more round with the Architect's open points.`;

/** What `omni mission send-back` prints once the send-back is recorded. */
export const sentBackWords = (prd: ProductPrdId, mission: number): string[] => [
  `PRD ${prd} goes back to the PM of mission ${String(mission)}: its rounds start again with the Architect's latest open points.`,
  'The PM answers them, rewording its spec or re-planning when it must, and approves a version the Architect then reviews.',
];
