import type { ApproverState } from '../products/approvers';
import {
  ApproverRemovedSchema, ApproverSavedSchema, approversRoute, LinkRemovedSchema, LinkSavedSchema, linksRoute, TabErrorSchema,
  type Link, type LinkWrite,
} from './repositories-tab.contract';

// The Repositories & approvers tab's calls from the browser (PRD 1364 s11; ADR-0095): the tab's own
// routes under /app/products/<id>/repositories, every answer parsed with repositories-tab.contract.ts.
// No Supabase client: the sign-in cookie goes with each request. Each call answers what it changed, or
// the route's own words.

/** The browser's fetch, or a stub in a test. */
type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export type Changed<T> = ({ ok: true } & T) | { ok: false; message: string };

/** What the tab changes: its links and its Approvers list. */
export interface RepositoriesTabPort {
  saveLink(write: LinkWrite): Promise<Changed<{ link: Link }>>;
  removeLink(repo: string): Promise<Changed<{ repo: string }>>;
  setApprover(member: string, state: ApproverState): Promise<Changed<{ state: ApproverState }>>;
  removeApprover(member: string): Promise<Changed<object>>;
}

const OFFLINE = 'Nothing was saved. Check your connection and try again.';

export function repositoriesTabClient(product: string, fetchFn: Fetch = (url, init) => fetch(url, init)): RepositoriesTabPort {
  async function call<T>(url: string, init: RequestInit, parse: (body: unknown) => T): Promise<Changed<T>> {
    let answer: Response;
    try {
      answer = await fetchFn(url, { credentials: 'same-origin', cache: 'no-store', ...init });
    } catch {
      return { ok: false, message: OFFLINE };
    }
    const body: unknown = await answer.json().catch(() => null);
    if (answer.ok) {
      try {
        return { ok: true, ...parse(body) };
      } catch {
        return { ok: false, message: `Nothing was saved (${answer.status}). Reload the page.` };
      }
    }
    const refusal = TabErrorSchema.safeParse(body);
    return { ok: false, message: refusal.success ? refusal.data.error : `Nothing was saved (${answer.status}). Try again.` };
  }
  const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  return {
    saveLink: (write) => call(linksRoute(product), json(write), (body) => ({ link: LinkSavedSchema.parse(body).link })),
    removeLink: (repo) => call(`${linksRoute(product)}?repo=${encodeURIComponent(repo)}`, { method: 'DELETE' }, (body) => ({ repo: LinkRemovedSchema.parse(body).repo })),
    setApprover: (member, state) => call(approversRoute(product), json({ member, state }), (body) => ({ state: ApproverSavedSchema.parse(body).state })),
    removeApprover: (member) => call(`${approversRoute(product)}?member=${encodeURIComponent(member)}`, { method: 'DELETE' }, (body) => { ApproverRemovedSchema.parse(body); return {}; }),
  };
}
