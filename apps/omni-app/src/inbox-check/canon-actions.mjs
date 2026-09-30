// The two actions on a red canon check (PRD 839), pure: the check run's buttons, the facts a click
// needs, and the one comment each action posts.
//
//   Rewrite for <persona>  posts "To rewrite the spec for <persona>, run `/omni:brainstorm --rework <n>`"
//   Change the claim       posts a link to each cited claim on Settings › Business (a Never line at
//                          its `#never-<seq>` anchor, the page itself for any other kind)
//
// GitHub's `requested_action` delivery carries only the button's identifier and the check run, so the
// facts a comment needs (the PRD, the persona, the cited claims) ride in the check run's summary as a
// hidden HTML comment, written by `evaluateInbox` on a red canon only. Each posted comment carries a
// marker of its action, so a second click of the same button edits that comment, never a new one.

/** The event the webhook sends for a click on a canon button; the `canon-action` function posts. */
export const CANON_ACTION_EVENT = 'omni-loop/canon.action.requested';

/** The buttons' identifiers, as GitHub sends them back (20 characters at most). */
export const CANON_ACTION = Object.freeze({ rewrite: 'canon-rewrite', claim: 'canon-claim' });

/** GitHub's limits on a check run action. */
const MAX_LABEL = 20;

const FACTS = /<!--\s*omni-canon\s+(\{[^\n]*?\})\s*-->/;

/**
 * The buttons of a check run whose canon gate is red; none on a green, neutral or absent one.
 * @param {{ state: string, persona: { name: string } | null } | null | undefined} canon
 */
export function canonActions(canon) {
  if (canon?.state !== 'red') return [];
  const persona = canon.persona?.name;
  return [
    {
      label: (persona ? `Rewrite for ${persona}` : 'Rewrite the spec').slice(0, MAX_LABEL),
      description: 'Post the command that reworks the spec',
      identifier: CANON_ACTION.rewrite,
    },
    { label: 'Change the claim', description: 'Open the claim on Settings › Business', identifier: CANON_ACTION.claim },
  ];
}

/**
 * The hidden line carrying a red canon's facts into the check run's summary, or `null` when the
 * canon is not red or the PRD is unknown.
 */
export function canonMarker({ prd, canon }) {
  if (canon?.state !== 'red' || !Number.isInteger(prd)) return null;
  const claims = [...new Set(canon.findings.flatMap((finding) => finding.claims))];
  return `<!-- omni-canon ${JSON.stringify({ prd, persona: canon.persona?.name ?? null, claims })} -->`;
}

/**
 * The facts `canonMarker` hid in a summary, or `null` when there are none.
 * @returns {{ prd: number, persona: string | null, claims: string[] } | null}
 */
export function readCanonMarker(summary) {
  const match = FACTS.exec(String(summary ?? ''));
  if (!match) return null;
  let facts;
  try {
    facts = JSON.parse(match[1]);
  } catch {
    return null;
  }
  if (!Number.isInteger(facts?.prd) || !Array.isArray(facts.claims)) return null;
  return {
    prd: facts.prd,
    persona: typeof facts.persona === 'string' && facts.persona ? facts.persona : null,
    claims: facts.claims.filter((id) => typeof id === 'string'),
  };
}

/** The line that marks the comment an action posted, so the next click finds it. */
export const commentMarker = (action) => `<!-- omni-canon-action:${action} -->`;

/** Settings › Business at a claim: a Never line at its `#never-<seq>`, any other claim the page. */
function claimLink(galaxyUrl, id) {
  const page = `${galaxyUrl.replace(/\/+$/, '')}/app/settings/business`;
  const never = /^never#(\d+)$/.exec(id);
  return never ? `${page}#never-${never[1]}` : page;
}

/**
 * The one comment an action posts, or `null` for an identifier that is not a canon button.
 * @param {string} action  the button's identifier
 * @param {{ prd: number, persona: string | null, claims: string[] }} facts
 * @param {{ galaxyUrl: string }} where
 */
export function canonComment(action, facts, { galaxyUrl }) {
  if (action === CANON_ACTION.rewrite) {
    const whom = facts.persona ? ` for ${facts.persona}` : '';
    return [commentMarker(action), `To rewrite the spec${whom}, run \`/omni:brainstorm --rework ${facts.prd}\`.`].join('\n');
  }
  if (action === CANON_ACTION.claim) {
    const lines = facts.claims.map((id) => `- [${id}](${claimLink(galaxyUrl, id)})`);
    return [
      commentMarker(action),
      'To change the claim, open it on Settings › Business. A new wording is saved as proposed and confirmed like any other; then re-run the inbox check.',
      '',
      ...lines,
    ].join('\n');
  }
  return null;
}
