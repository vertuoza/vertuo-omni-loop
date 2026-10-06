// The two actions on a red canon check (PRD 839), pure: the check run's buttons, the facts a click
// needs, and the one comment each action posts.
//
//   Rewrite for <persona>  posts "To rewrite the spec for <persona>, run `/omni:brainstorm --rework <n>`"
//   Change the line        posts a link to each cited line on Settings › Business (a Never line at
//                          its `#never-<seq>` anchor, the Statement at `#statement`, the page itself
//                          for any other claim). Its identifier stays `canon-claim` (PRD 839), so a
//                          button on a check run published before PRD 871 still answers
//
// GitHub's `requested_action` delivery carries only the button's identifier and the check run, so the
// facts a comment needs (the PRD, the persona, the cited claims) ride in the check run's summary as a
// hidden HTML comment, written by `evaluateInbox` on a red canon only. Each posted comment carries a
// marker of its action, so a second click of the same button edits that comment, never a new one.
import { z } from 'zod';
import { PrdNumberSchema, type PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { CanonFacts } from '../inngest-client.ts';
import type { CheckAction } from './github.ts';

/** The event the webhook sends for a click on a canon button; the `canon-action` function posts. */
export const CANON_ACTION_EVENT = 'omni-loop/canon.action.requested';

/** The buttons' identifiers, as GitHub sends them back (20 characters at most). */
export const CANON_ACTION = Object.freeze({ rewrite: 'canon-rewrite', claim: 'canon-claim' });

/** GitHub's limits on a check run action. */
const MAX_LABEL = 20;

const FACTS = /<!--\s*omni-canon\s+(\{[^\n]*?\})\s*-->/;

/** What the buttons and the marker read of a canon gate's facts. */
type CanonState = {
  state: string;
  persona: { name: string } | null;
  findings: readonly { claims: readonly string[] }[];
};

/** The facts as the marker carries them; read leniently, as they always were. */
const MarkerSchema = z.looseObject({ prd: z.unknown(), persona: z.unknown(), claims: z.unknown() });

/** The buttons of a check run whose canon gate is red; none on a green, neutral or absent one. */
export function canonActions(canon: Pick<CanonState, 'state' | 'persona'> | null | undefined): CheckAction[] {
  if (canon?.state !== 'red') return [];
  const persona = canon.persona?.name;
  return [
    {
      label: (persona ? `Rewrite for ${persona}` : 'Rewrite the spec').slice(0, MAX_LABEL),
      description: 'Post the command that reworks the spec',
      identifier: CANON_ACTION.rewrite,
    },
    { label: 'Change the line', description: 'Open the line on Settings › Business', identifier: CANON_ACTION.claim },
  ];
}

/**
 * The hidden line carrying a red canon's facts into the check run's summary, or `null` when the
 * canon is not red or the PRD is unknown.
 */
export function canonMarker({ prd, canon }: { prd: PrdNumber | null; canon: CanonState | null | undefined }): string | null {
  if (!canon || canon.state !== 'red' || prd === null) return null;
  const claims = [...new Set(canon.findings.flatMap((finding) => finding.claims))];
  return `<!-- omni-canon ${JSON.stringify({ prd, persona: canon.persona?.name ?? null, claims })} -->`;
}

/** The facts `canonMarker` hid in a summary, or `null` when there are none. */
export function readCanonMarker(summary: unknown): CanonFacts | null {
  const match = FACTS.exec(summary === undefined || summary === null ? '' : printed(summary));
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1] ?? '');
  } catch {
    return null;
  }
  const read = MarkerSchema.safeParse(parsed);
  if (!read.success) return null;
  const facts = read.data;
  const prd = PrdNumberSchema.safeParse(facts.prd);
  if (!prd.success || !Array.isArray(facts.claims)) return null;
  const claims: unknown[] = facts.claims;
  return {
    prd: prd.data,
    persona: typeof facts.persona === 'string' && facts.persona ? facts.persona : null,
    claims: claims.filter((id): id is string => typeof id === 'string'),
  };
}

/** A summary, as `String` prints it: the webhook hands it over as GitHub sent it, unparsed. */
const printed = (value: unknown) => String(value);

/** The line that marks the comment an action posted, so the next click finds it. */
export const commentMarker = (action: string): string => `<!-- omni-canon-action:${action} -->`;

/** Settings › Business at a line: a Never line at its `#never-<seq>`, the Statement at `#statement`, any other claim the page. */
function claimLink(galaxyUrl: string, id: string): string {
  const page = `${galaxyUrl.replace(/\/+$/, '')}/app/settings/business`;
  if (id === 'statement') return `${page}#statement`;
  const never = /^never#(\d+)$/.exec(id);
  return never ? `${page}#never-${never[1]}` : page;
}

/** Whether a cited id is a constituent (the Statement or a Never line, PRD 871) rather than a claim. */
const isConstituent = (id: string) => id === 'statement' || /^never#\d+$/.test(id);

/** The one comment an action posts (`action`: the button's identifier), or `null` for one that is not a canon button. */
export function canonComment(action: string, facts: CanonFacts, { galaxyUrl }: { galaxyUrl: string }): string | null {
  if (action === CANON_ACTION.rewrite) {
    const whom = facts.persona ? ` for ${facts.persona}` : '';
    return [commentMarker(action), `To rewrite the spec${whom}, run \`/omni:brainstorm --rework ${facts.prd}\`.`].join('\n');
  }
  if (action === CANON_ACTION.claim) {
    const lines = facts.claims.map((id) => `- [${id}](${claimLink(galaxyUrl, id)})`);
    const how: string[] = [];
    if (facts.claims.some(isConstituent)) {
      how.push('To change the Statement or a Never line, open it on Settings › Business: an owner of the workspace changes it on the Constituents panel; then re-run the inbox check.');
    }
    if (facts.claims.some((id) => !isConstituent(id))) {
      how.push('To change the claim, open it on Settings › Business. A new wording is saved as proposed and confirmed like any other; then re-run the inbox check.');
    }
    return [commentMarker(action), ...how, '', ...lines].join('\n');
  }
  return null;
}
