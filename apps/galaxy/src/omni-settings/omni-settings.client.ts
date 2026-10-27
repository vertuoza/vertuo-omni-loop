import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import {
  PLAYBOOK_PROPOSAL_ROUTE, PlaybookProposedSchema, SETTINGS_REPOSITORY_ROUTE, SettingsRepositoryChosenSchema,
  type PlaybookEdit, type PlaybookProposed, type SettingsRepositoryChoice,
} from './omni-settings.contract';

// Settings → Playbook's one call from the browser (PRD 2417, s7): an owner's change to a page, posted
// as the signed-in person to the proposal route, which opens a pull request in the settings repository.
// The answer is the pull request, or the route's own words for why none opened. In the demo, the same
// shape kept in the page: nothing leaves the browser.

export type Proposed = { ok: true; proposed: PlaybookProposed } | { ok: false; message: string };

/** How the page proposes a change: through the route as the signed-in person, or the demo's stand-in. */
export type PlaybookEditing = { kind: 'database'; workspace: string } | { kind: 'demo' };

export const COULD_NOT_PROPOSE = 'Couldn’t open the pull request. Try again in a moment.';

/** The words a refusal carries (`{error}`), else the fallback. */
function wordsOf(body: unknown, fallback: string = COULD_NOT_PROPOSE): string {
  const words = typeof body === 'object' && body !== null && 'error' in body ? body.error : null;
  return typeof words === 'string' && words !== '' ? words : fallback;
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

// Settings → Playbook's other call from the browser (PRD 2543, s3): an owner's choice of the settings
// repository, posted as the signed-in person to the settings-repository route, which stores it through
// the database's owner-only function. The answer is the repository now stored (null once cleared), or the
// route's own words for why it was not. In the demo, the same shape kept in the page.

export type Chosen = { ok: true; repository: string | null } | { ok: false; message: string };

export const COULD_NOT_CHOOSE = 'Couldn’t save the settings repository. Try again in a moment.';

/** Posts `choice` to the settings-repository route; the repository now stored, or why none was. */
export async function chooseRepository(choice: SettingsRepositoryChoice, fetch: typeof globalThis.fetch = globalThis.fetch): Promise<Chosen> {
  try {
    const res = await fetch(SETTINGS_REPOSITORY_ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(choice) });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, message: wordsOf(body, COULD_NOT_CHOOSE) };
    const parsed = SettingsRepositoryChosenSchema.safeParse(body);
    return parsed.success ? { ok: true, repository: parsed.data.repository } : { ok: false, message: COULD_NOT_CHOOSE };
  } catch {
    return { ok: false, message: COULD_NOT_CHOOSE };
  }
}

/** The demo's answer: the choice kept in the page, stored nowhere. */
export function demoChoice(repository: string | null): Chosen {
  return { ok: true, repository };
}
