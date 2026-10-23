import { findingRoute, type DecisionReply, type FollowUp, type Verdict } from './rewind.contract';

// The browser's side of a decision (PRD 2410, s7): one POST to the finding's approve or reject route with the
// page's session cookies, answered as the reply or the route's own words. Browser-safe: no Supabase here.

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** One decision as the card sends it: the finding, the verdict, and a Reject's optional reason. */
export type Decision = { finding: string; verdict: Verdict; reason?: string };

/** What a decision answered: the reply, or why not in the route's words. */
export type Decided = { ok: true; reply: DecisionReply } | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function followUpOf(value: unknown): FollowUp | null {
  if (!isRecord(value) || typeof value.done !== 'boolean' || typeof value.words !== 'string') return null;
  return { done: value.done, words: value.words, link: typeof value.link === 'string' ? value.link : null };
}

/** Approves or rejects one finding as the page's member. */
export async function decideFinding({ finding, verdict, reason }: Decision, fetchImpl: Fetch = fetch): Promise<Decided> {
  const verb = verdict === 'approve' ? 'approved' : 'rejected';
  const body = verdict === 'reject' && reason !== undefined ? { reason } : {};
  let answer: Response;
  try {
    answer = await fetchImpl(findingRoute(finding, verdict), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    return { ok: false, error: `The finding was not ${verb}. Check your connection and try again.` };
  }
  const sent: unknown = await answer.json().catch(() => null);
  if (!answer.ok) {
    const error = isRecord(sent) && typeof sent.error === 'string' ? sent.error : `The finding was not ${verb} (${String(answer.status)}). Try again.`;
    return { ok: false, error };
  }
  const state = verdict === 'approve' ? 'approved' : 'rejected';
  return { ok: true, reply: { state, followUp: isRecord(sent) ? followUpOf(sent.followUp) : null } };
}
