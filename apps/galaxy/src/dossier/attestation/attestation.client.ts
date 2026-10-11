import { APPROVAL_ROUTE } from '../page/approval';

// The Attestation page's one call from the browser (PRD 1612 s4): Approve again, through the PRD page's
// approval route (src/approval/approval-api.ts), as the signed-in person.

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** Approves dossier `dossier` again; null once approved, else what to say: the route's own words when it
 * gives any. */
export async function approveAgain(dossier: string, send: Fetch): Promise<string | null> {
  try {
    const answer = await send(APPROVAL_ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dossier }) });
    if (answer.ok) return null;
    const body: unknown = await answer.json().catch(() => null);
    const error = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string' ? body.error : null;
    return error ?? `The PRD was not approved (${answer.status}). Try again.`;
  } catch {
    return 'The PRD was not approved. Check your connection and try again.';
  }
}
