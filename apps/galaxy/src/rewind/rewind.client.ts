import { REWIND_DECIDE_ROUTE, type DecideBody, type DecisionReply, type FollowUp } from './rewind.contract';

// The browser's side of a decision (PRD 2410, s7): one POST to the decide route with the page's session
// cookies, answered as the reply or the route's own words. Browser-safe: no Supabase here.

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** What a decision answered: the reply, or why not in the route's words. */
export type Decided = { ok: true; reply: DecisionReply } | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function followUpOf(value: unknown): FollowUp | null {
  if (!isRecord(value) || typeof value.done !== 'boolean' || typeof value.words !== 'string') return null;
  return { done: value.done, words: value.words, link: typeof value.link === 'string' ? value.link : null };
}

/** Approves or rejects one finding as the page's member. */
export async function decideFinding(body: DecideBody, fetchImpl: Fetch = fetch): Promise<Decided> {
  const verb = body.verdict === 'approve' ? 'approved' : 'rejected';
  let answer: Response;
  try {
    answer = await fetchImpl(REWIND_DECIDE_ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    return { ok: false, error: `The finding was not ${verb}. Check your connection and try again.` };
  }
  const sent: unknown = await answer.json().catch(() => null);
  if (!answer.ok) {
    const error = isRecord(sent) && typeof sent.error === 'string' ? sent.error : `The finding was not ${verb} (${String(answer.status)}). Try again.`;
    return { ok: false, error };
  }
  const state = isRecord(sent) && (sent.state === 'approved' || sent.state === 'rejected') ? sent.state : body.verdict === 'approve' ? 'approved' : 'rejected';
  return { ok: true, reply: { state, followUp: isRecord(sent) ? followUpOf(sent.followUp) : null } };
}
