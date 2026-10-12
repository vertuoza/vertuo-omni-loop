import { ANSWER_ROUTE, AnswerErrorSchema, AnswerReplySchema, type AnswerReply, type AnswerRequest } from './questions.contract';

// The Questions tab's call from the browser (PRD 1548 s9; ADR-0095): POST /api/outbox/answer, its answer
// parsed with questions.contract.ts. No Supabase client: the sign-in cookie goes with the request. It
// answers what was settled, or the route's own words.

/** The browser's fetch, or a stub in a test. */
type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export type Answered = { ok: true; reply: AnswerReply } | { ok: false; message: string };

/** What the tab sends: one answer at a time. */
export interface QuestionsPort {
  answer(request: AnswerRequest): Promise<Answered>;
}

const OFFLINE = 'Nothing was sent. Check your connection and try again.';

export function questionsClient(fetchFn: Fetch = (url, init) => fetch(url, init)): QuestionsPort {
  return {
    async answer(request) {
      let res: Response;
      try {
        res = await fetchFn(ANSWER_ROUTE, {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'content-type': 'application/json' }, body: JSON.stringify(request),
        });
      } catch {
        return { ok: false, message: OFFLINE };
      }
      const body: unknown = await res.json().catch(() => null);
      if (res.ok) {
        const reply = AnswerReplySchema.safeParse(body);
        return reply.success ? { ok: true, reply: reply.data } : { ok: false, message: `The answer was sent, but its reply was unreadable (${String(res.status)}). Reload the page.` };
      }
      const refusal = AnswerErrorSchema.safeParse(body);
      return { ok: false, message: refusal.success ? refusal.data.error : `The answer was not saved (${String(res.status)}). Try again.` };
    },
  };
}
