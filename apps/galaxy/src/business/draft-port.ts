import { claimOf, type Claim, type StoredClaim, type StoredReceipt } from './model';
import type { DraftView, WebPage } from './reveal';
import { MAX_PAGES } from './reveal';
import { COULD_NOT_SAVE, refusalOf } from './store';

// The draft's calls from Settings › Business (PRD 774 s3), as the signed-in person. Draft from my repos
// posts to the draft route (src/business/draft/api.ts), which answers the draft it started or the one
// already running; the page then reads the latest public.business_drafts row until it has ended, and
// every claim again, with its receipts. + add a web page and its removal go through the sources route,
// which checks the address is https and public. That's us is claims_confirm_proposed(), with the rows
// marked ✗. In the demo, a draft runs in memory over sample sources that name no real company.

export const DRAFT_ROUTE = '/api/business/draft';
export const SOURCES_ROUTE = '/api/business/sources';

export type Started = { ok: true; draft: DraftView } | { ok: false; message: string };
export type AddedPage = { ok: true; page: WebPage } | { ok: false; message: string };
export type Done = { ok: true } | { ok: false; message: string };

export interface DraftPort {
  /** Draft from my repos: a draft started, or the one running. */
  start(): Promise<Started>;
  /** The business's latest draft, or null (none, or not readable). */
  latest(): Promise<DraftView | null>;
  /** Every claim of the business, with its receipts; null when it could not be read. */
  claims(): Promise<Claim[] | null>;
  addPage(url: string): Promise<AddedPage>;
  removePage(id: string): Promise<Done>;
  /** That's us: every found row confirmed but those in `rejected`, which are rejected. */
  thatsUs(rejected: string[]): Promise<Done>;
}

type Answer = { data: unknown; error: unknown };
interface Query extends PromiseLike<Answer> {
  eq(column: string, value: unknown): Query;
  order(column: string, options?: { ascending: boolean }): Query;
  limit(n: number): Query;
}
export interface DraftDb {
  from(table: string): { select(columns: string): Query };
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<Answer>;
}

/** A draft row as the page keeps it. */
export function draftOf(row: Record<string, unknown>): DraftView {
  return {
    id: String(row.id),
    kind: row.kind === 'recheck' ? 'recheck' : 'draft',
    state: row.state === 'done' || row.state === 'failed' ? row.state : 'running',
    counts: (row.counts && typeof row.counts === 'object' ? row.counts : {}) as DraftView['counts'],
    scanned: Array.isArray(row.scanned) ? (row.scanned as DraftView['scanned']) : [],
    reason: typeof row.reason === 'string' ? row.reason : null,
  };
}

export const DRAFT_COLUMNS = 'id, kind, state, counts, scanned, reason';
export const CLAIM_COLUMNS = 'id, seq, kind, value, source, state, product_id, replaces';
export const RECEIPT_COLUMNS = 'claim_id, kind, location, quote, seen_at';

export function databaseDraft(db: DraftDb, workspace: string, fetch: typeof globalThis.fetch = (...args) => globalThis.fetch(...args)): DraftPort {
  /** A route's answer: its body when it said yes, else its `{error}` in plain words. */
  const send = async (url: string, method: string, body: unknown): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; message: string }> => {
    try {
      const response = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const said = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (response.ok && said) return { ok: true, body: said };
      return { ok: false, message: typeof said?.error === 'string' ? said.error : COULD_NOT_SAVE };
    } catch {
      return { ok: false, message: COULD_NOT_SAVE };
    }
  };
  return {
    async start() {
      const sent = await send(DRAFT_ROUTE, 'POST', { workspace });
      if (!sent.ok) return sent;
      const row = sent.body.draft;
      return row && typeof row === 'object' ? { ok: true, draft: draftOf(row as Record<string, unknown>) } : { ok: false, message: COULD_NOT_SAVE };
    },
    async latest() {
      try {
        const { data, error } = await db.from('business_drafts').select(DRAFT_COLUMNS).eq('workspace_id', workspace).order('started_at', { ascending: false }).limit(1);
        const row = Array.isArray(data) ? data[0] : null;
        return error || !row ? null : draftOf(row as Record<string, unknown>);
      } catch {
        return null;
      }
    },
    async claims() {
      try {
        const [claims, receipts] = await Promise.all([
          db.from('claims').select(CLAIM_COLUMNS).eq('workspace_id', workspace),
          db.from('claim_receipts').select(RECEIPT_COLUMNS).eq('workspace_id', workspace),
        ]);
        if (claims.error || receipts.error) return null;
        const quoted = (receipts.data ?? []) as StoredReceipt[];
        return ((claims.data ?? []) as StoredClaim[]).map((row) => claimOf(row, [], quoted)).sort((a, b) => a.seq - b.seq);
      } catch {
        return null;
      }
    },
    async addPage(url) {
      const sent = await send(SOURCES_ROUTE, 'POST', { workspace, url });
      if (!sent.ok) return sent;
      const page = sent.body.source as { id?: unknown; url?: unknown } | undefined;
      return typeof page?.id === 'string' ? { ok: true, page: { id: page.id, url: String(page.url) } } : { ok: false, message: COULD_NOT_SAVE };
    },
    async removePage(id) {
      const sent = await send(SOURCES_ROUTE, 'DELETE', { workspace, source: id });
      return sent.ok ? { ok: true } : sent;
    },
    async thatsUs(rejected) {
      try {
        const { error } = await db.rpc('claims_confirm_proposed', { p_workspace: workspace, p_rejected: rejected });
        return error ? { ok: false, message: refusalOf(error) } : { ok: true };
      } catch (err) {
        return { ok: false, message: refusalOf(err) };
      }
    },
  };
}

// ── The demo ─────────────────────────────────────────────────────────────────────

const DEMO_SCANNED: DraftView['scanned'] = [
  { source: 'demo-app · README.md', state: 'read' },
  { source: 'demo-app · docs/positioning.md', state: 'read' },
  { source: 'example.com/pricing', state: 'read' },
  { source: 'example.com/about', state: 'skipped', why: 'no answer in 10 s' },
];

/** What the demo's draft finds: sample values and quotes, naming no real company. */
const DEMO_FOUND: Array<Pick<Claim, 'kind' | 'value'> & { receipt: { kind: 'file' | 'link'; where: string; quote: string } }> = [
  { kind: 'region', value: 'France', receipt: { kind: 'file', where: 'demo/demo-app/README.md', quote: 'Invoices in euros for Belgium and France.' } },
  { kind: 'rival', value: 'Brick & Co', receipt: { kind: 'file', where: 'demo/demo-app/docs/positioning.md', quote: 'Brick & Co is too heavy for a 10-person firm.' } },
  { kind: 'trade', value: 'construction', receipt: { kind: 'link', where: 'https://example.com/pricing', quote: 'Built for construction companies.' } },
];

const WHEN = '2026-09-30T10:00:00Z';

/** A draft over sample sources, in memory, beside the claims the page holds now (`current`, changed
 * by the demo's picks): the page can be tried with no database and no model. */
export function demoDraftPort(current: () => readonly Claim[]): DraftPort {
  let found: Claim[] = [];
  let pages: WebPage[] = [];
  let made = 0;
  let draft: DraftView | null = null;
  const all = () => {
    const held = current();
    return [...held, ...found.filter((f) => !held.some((c) => c.id === f.id))];
  };
  return {
    async start() {
      draft = { id: 'demo-draft', kind: 'draft', state: 'running', counts: {}, scanned: DEMO_SCANNED.slice(0, 2), reason: null };
      return { ok: true, draft };
    },
    async latest() {
      if (!draft) return null;
      if (draft.state === 'running') {
        const held = all();
        let seq = Math.max(0, ...held.map((c) => c.seq));
        for (const f of DEMO_FOUND) {
          if (held.some((c) => c.kind === f.kind && c.value.toLowerCase() === f.value.toLowerCase())) continue;
          seq += 1;
          found = [...found, {
            id: `demo-found-${seq}`, seq, kind: f.kind, value: f.value, source: 'evidence', state: 'proposed', cited: 0, lastBy: null,
            receipts: [{ ...f.receipt, seenAt: WHEN }],
          }];
        }
        draft = { ...draft, state: 'done', scanned: DEMO_SCANNED, counts: { readmes: 1, docs: 1, prds: 0, pages: 1, kept: DEMO_FOUND.length } };
      }
      return draft;
    },
    async claims() {
      return all();
    },
    async addPage(url) {
      const v = url.trim();
      if (!/^https:\/\/\S+$/i.test(v)) return { ok: false, message: 'Only an https:// address can be read.' };
      if (pages.length >= MAX_PAGES) return { ok: false, message: 'Three web pages at most: remove one to add another.' };
      made += 1;
      const page = { id: `demo-page-${made}`, url: v };
      pages = [...pages, page];
      return { ok: true, page };
    },
    async removePage(id) {
      pages = pages.filter((p) => p.id !== id);
      return { ok: true };
    },
    async thatsUs(rejected) {
      found = found.map((c) => (c.state === 'proposed' && c.source === 'evidence' ? { ...c, state: rejected.includes(c.id) ? 'rejected' : 'confirmed' } : c));
      return { ok: true };
    },
  };
}
