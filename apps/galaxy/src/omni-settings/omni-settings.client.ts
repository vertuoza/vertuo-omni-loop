import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { PLAYBOOK_PROPOSAL_ROUTE, PlaybookProposedSchema, type PlaybookEdit, type PlaybookProposed } from './omni-settings.contract';

// Settings → Playbook's one call from the browser (PRD 2417, s7): an owner's change to a page, posted
// as the signed-in person to the proposal route, which opens a pull request in the settings repository.
// The answer is the pull request, or the route's own words for why none opened. In the demo, the same
// shape kept in the page: nothing leaves the browser.

export type Proposed = { ok: true; proposed: PlaybookProposed } | { ok: false; message: string };

/** How the page proposes a change: through the route as the signed-in person, or the demo's stand-in. */
export type PlaybookEditing = { kind: 'database'; workspace: string } | { kind: 'demo' };

export const COULD_NOT_PROPOSE = 'Couldn’t open the pull request. Try again in a moment.';

/** The words a refusal carries (`{error}`), else the fallback. */
function wordsOf(body: unknown): string {
  const words = typeof body === 'object' && body !== null && 'error' in body ? body.error : null;
  return typeof words === 'string' && words !== '' ? words : COULD_NOT_PROPOSE;
}

/** Posts `edit` to the proposal route; the pull request it opened, or why none did. */
export async function proposePage(edit: PlaybookEdit, fetch: typeof globalThis.fetch = globalThis.fetch): Promise<Proposed> {
  try {
    const res = await fetch(PLAYBOOK_PROPOSAL_ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(edit) });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, message: wordsOf(body) };
    const parsed = PlaybookProposedSchema.safeParse(body);
    return parsed.success ? { ok: true, proposed: parsed.data } : { ok: false, message: COULD_NOT_PROPOSE };
  } catch {
    return { ok: false, message: COULD_NOT_PROPOSE };
  }
}

/** The demo's answer: a pull request in the demo's settings repository, opened nowhere. */
export function demoProposal(repository: string): Proposed {
  return { ok: true, proposed: { repository, pullRequest: { number: parsePr(1), url: `https://github.com/${repository}/pulls` } } };
}
