import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { CLAIM_COLUMNS, claimOf, RECEIPT_COLUMNS, StoredClaim, StoredReceipt, type Claim } from './model';
import type { DraftView, WebPage } from './reveal';
import { MAX_PAGES } from './reveal';
import { COULD_NOT_SAVE, refusalOf } from './store';
import { orNull, parseRow, parseRows } from '../data/parse-rows';
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';

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
  /** ✓ Still true on a faded claim (PRD 774 s4): claim_still_true(); when it was seen, saved. */
  stillTrue(claim: string): Promise<{ ok: true; at: string } | { ok: false; message: string }>;
}

type Answer = { data: unknown; error: unknown };
interface Query extends PromiseLike<Answer> {
  eq(column: string, value: string): Query;
  order(column: string, options?: { ascending: boolean }): Query;
  limit(n: number): Query;
}
export interface DraftDb {
  from(table: string): { select(columns: string): Query };
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<Answer>;
}

/** One link of a select's chain, kept until the query is awaited. */
type Step =
  | { kind: 'eq'; column: string; value: string }
  | { kind: 'order'; column: string; options?: { ascending: boolean } | undefined }
  | { kind: 'limit'; n: number };

/** A Query that records its chain and hands it to `run` when it is awaited. */
function recorded(run: (steps: readonly Step[]) => PromiseLike<Answer>, steps: readonly Step[] = []): Query {
  const next = (step: Step) => recorded(run, [...steps, step]);
  return {
    eq: (column, value) => next({ kind: 'eq', column, value }),
    order: (column, options) => next({ kind: 'order', column, options }),
    limit: (n) => next({ kind: 'limit', n }),
    then: (ok, ko) => run(steps).then(ok, ko),
  };
}

/** A Supabase client seen through DraftDb: each select's chain is replayed on the client's own query
 * builder when awaited, so the deep builder types are never compared with the port's. */
export function draftDbOver(client: Pick<SupabaseClient, 'from' | 'rpc'>): DraftDb {
  return {
    from: (table) => ({
      select: (columns) => recorded((steps) => {
        let query = client.from(table).select(columns);
        for (const step of steps) {
          if (step.kind === 'eq') query = query.eq(step.column, step.value);
          else if (step.kind === 'order') query = query.order(step.column, step.options);
          else query = query.limit(step.n);
        }
        return query;
      }),
    }),
    rpc: (fn, args) => client.rpc(fn, args),
  };
}

/** One source a draft scanned, as its run writes it in `business_drafts.scanned` (./draft/run.ts). */
const ScannedSource = z.object({ source: z.string(), state: z.enum(['read', 'skipped']), why: z.string().optional() });

/** A public.business_drafts row, as the page reads it: the columns of DRAFT_COLUMNS, or the whole row
 * the draft route answers. `counts` and `scanned` are the JSON columns the draft run writes. */
export const StoredDraft = z.object({
  id: z.string(),
  kind: z.enum(['draft', 'recheck']),
  state: z.enum(['running', 'done', 'failed']),
  counts: z.record(z.string(), z.number()),
  scanned: z.array(ScannedSource),
  reason: z.string().nullable(),
});
export type StoredDraft = z.infer<typeof StoredDraft>;

export const DRAFT_COLUMNS = 'id, kind, state, counts, scanned, reason';

/** A draft row as the page keeps it, or null (logged) when it is not one. */
export function draftOf(row: unknown, where: string): DraftView | null {
  return orNull(parseRow(StoredDraft, row, where));
}

export function databaseDraft(db: DraftDb, workspace: string, fetch: typeof globalThis.fetch = (...args) => globalThis.fetch(...args)): DraftPort {
  /** A route's answer: its body when it said yes, else its `{error}` in plain words. */
  const send = async (url: string, method: string, body: unknown): Promise<{ ok: true; body: unknown } | { ok: false; message: string }> => {
    try {
      const response = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const said: unknown = await response.json().catch(() => null);
      if (response.ok && said) return { ok: true, body: said };
      const error = propertyOf(said, 'error');
      return { ok: false, message: typeof error === 'string' ? error : COULD_NOT_SAVE };
    } catch {
      return { ok: false, message: COULD_NOT_SAVE };
    }
  };
  return {
    async start() {
      const sent = await send(DRAFT_ROUTE, 'POST', { workspace });
      if (!sent.ok) return sent;
      const draft = draftOf(propertyOf(sent.body, 'draft'), `business/draft-port: ${DRAFT_ROUTE}`);
      return draft ? { ok: true, draft } : { ok: false, message: COULD_NOT_SAVE };
    },
    async latest() {
      try {
        const { data, error } = await db.from('business_drafts').select(DRAFT_COLUMNS).eq('workspace_id', workspace).order('started_at', { ascending: false }).limit(1);
        const row: unknown = Array.isArray(data) ? data[0] : null;
        return error || !row ? null : draftOf(row, 'business/draft-port: business_drafts');
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
        const quoted = parseRows(StoredReceipt, receipts.data, 'business/draft-port: claim_receipts');
        const rows = parseRows(StoredClaim, claims.data, 'business/draft-port: claims');
        if (!quoted.ok || !rows.ok) return null;
        return rows.value.map((row) => claimOf(row, [], quoted.value)).sort((a, b) => a.seq - b.seq);
      } catch {
        return null;
      }
    },
    async addPage(url) {
      const sent = await send(SOURCES_ROUTE, 'POST', { workspace, url });
      if (!sent.ok) return sent;
      const page = propertyOf(sent.body, 'source');
      const id = propertyOf(page, 'id');
      return typeof id === 'string' ? { ok: true, page: { id, url: String(propertyOf(page, 'url')) } } : { ok: false, message: COULD_NOT_SAVE };
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
    async stillTrue(claim) {
      try {
        const { data, error } = await db.rpc('claim_still_true', { p_workspace: workspace, p_claim: claim });
        const seen = propertyOf(data, 'last_seen');
        if (error || typeof seen !== 'string') return { ok: false, message: refusalOf(error) };
        return { ok: true, at: seen };
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
    start() {
      draft = { id: 'demo-draft', kind: 'draft', state: 'running', counts: {}, scanned: DEMO_SCANNED.slice(0, 2), reason: null };
      return Promise.resolve({ ok: true, draft });
    },
    latest() {
      if (!draft) return Promise.resolve(null);
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
      return Promise.resolve(draft);
    },
    claims() {
      return Promise.resolve(all());
    },
    addPage(url) {
      const v = url.trim();
      if (!/^https:\/\/\S+$/i.test(v)) return Promise.resolve({ ok: false, message: 'Only an https:// address can be read.' });
      if (pages.length >= MAX_PAGES) return Promise.resolve({ ok: false, message: 'Three web pages at most: remove one to add another.' });
      made += 1;
      const page = { id: `demo-page-${made}`, url: v };
      pages = [...pages, page];
      return Promise.resolve({ ok: true, page });
    },
    removePage(id) {
      pages = pages.filter((p) => p.id !== id);
      return Promise.resolve({ ok: true });
    },
    stillTrue() {
      return Promise.resolve({ ok: true, at: new Date().toISOString() });
    },
    thatsUs(rejected) {
      found = found.map((c) => (c.state === 'proposed' && c.source === 'evidence' ? { ...c, state: rejected.includes(c.id) ? 'rejected' : 'confirmed' } : c));
      return Promise.resolve({ ok: true });
    },
  };
}
