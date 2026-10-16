import { changesRoute, KnowledgeDoneSchema, KnowledgeErrorSchema, type Done, type KnowledgeWrite } from './product-knowledge.contract';

// The Knowledge tab's calls from the browser (PRD 1795 s2): its one route under
// /app/products/<id>/knowledge, every answer parsed with product-knowledge.contract.ts. No Supabase
// client: the sign-in cookie goes with each request. A call answers what it did, or the route's own words.

/** The browser's fetch, or a stub in a test. */
type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export type Changed = { ok: true; done: Done } | { ok: false; message: string };

/** What the tab changes. */
export interface KnowledgePort {
  send(write: KnowledgeWrite): Promise<Changed>;
}

const OFFLINE = 'Nothing was saved. Check your connection and try again.';

export function knowledgeClient(product: string, fetchFn: Fetch = (url, init) => fetch(url, init)): KnowledgePort {
  return {
    async send(write) {
      let answer: Response;
      try {
        answer = await fetchFn(changesRoute(product), {
          method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify(write),
        });
      } catch {
        return { ok: false, message: OFFLINE };
      }
      const body: unknown = await answer.json().catch(() => null);
      if (answer.ok) {
        const done = KnowledgeDoneSchema.safeParse(body);
        return done.success ? { ok: true, done: done.data.done } : { ok: false, message: `Nothing was saved (${answer.status}). Reload the page.` };
      }
      const refusal = KnowledgeErrorSchema.safeParse(body);
      return { ok: false, message: refusal.success ? refusal.data.error : `Nothing was saved (${answer.status}). Try again.` };
    },
  };
}

/** The demo's port: nothing is saved. */
export const demoKnowledgePort: KnowledgePort = {
  send: () => Promise.resolve({ ok: false, message: 'The demo does not save changes.' }),
};
