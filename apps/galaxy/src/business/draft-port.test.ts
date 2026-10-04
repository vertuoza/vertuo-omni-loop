import { describe, expect, it, vi } from 'vitest';
import type { Claim } from './model';
import { databaseDraft, demoDraftPort, draftDbOver, DRAFT_ROUTE, SOURCES_ROUTE, type DraftDb } from './draft-port';
import { COULD_NOT_SAVE, NOT_MEMBER } from './store';
import { sure } from '../arcade/test/sure';
import { sentOf } from './json.fake';

// The draft's calls from Settings › Business (PRD 774 s3): start a draft through its route, read the
// latest draft row and the claims with their receipts again, add and remove a web page through the
// sources route, and That's us through claims_confirm_proposed(). And the demo, which drafts in memory.

type Answer = { data?: unknown; error?: unknown };

function db(tables: Record<string, Answer>, rpc: Answer = {}) {
  const reads: Array<{ table: string; select: string; filters: unknown[] }> = [];
  const calls: [string, unknown][] = [];
  const query = (table: string, select: string) => {
    const read = { table, select, filters: [] as unknown[] };
    reads.push(read);
    const answer = tables[table] ?? {};
    const q = {
      eq: (c: string, v: unknown) => (read.filters.push(['eq', c, v]), q),
      order: (c: string, o?: unknown) => (read.filters.push(['order', c, o]), q),
      limit: (n: number) => (read.filters.push(['limit', n]), q),
      then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null }).then(ok),
    };
    return q;
  };
  return {
    reads,
    calls,
    from: (table: string) => ({ select: (cols: string) => query(table, cols) }),
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push([fn, args]);
      return Promise.resolve({ data: rpc.data ?? null, error: rpc.error ?? null });
    },
  } as unknown as DraftDb & { reads: typeof reads; calls: typeof calls };
}

function fetcher(status: number, body: unknown) {
  const sent: Array<{ url: string; init: RequestInit }> = [];
  const fetch = ((url: string, init: RequestInit) => {
    sent.push({ url, init });
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  }) as unknown as typeof globalThis.fetch;
  return { sent, fetch };
}

const DRAFT = { id: 'd-1', kind: 'draft', state: 'running', started_at: '2026-09-30T10:00:00Z', finished_at: null, counts: {}, scanned: [], reason: null };

describe('starting a draft', () => {
  it('posts the workspace to the draft route, and reads the draft it answers', async () => {
    const f = fetcher(202, { draft: DRAFT, running: false });
    expect(await databaseDraft(db({}), 'ws-1', f.fetch).start()).toEqual({
      ok: true, draft: { id: 'd-1', kind: 'draft', state: 'running', counts: {}, scanned: [], reason: null },
    });
    expect(sure(f.sent[0], 'f.sent[0]').url).toBe(DRAFT_ROUTE);
    expect(sentOf(sure(f.sent[0], 'f.sent[0]').init.body)).toEqual({ workspace: 'ws-1' });
  });

  it('shows the route\'s refusal, and a plain one when the network fails', async () => {
    expect(await databaseDraft(db({}), 'ws-1', fetcher(403, { error: 'Only a member of the workspace can change its business.' }).fetch).start())
      .toEqual({ ok: false, message: 'Only a member of the workspace can change its business.' });
    const broken = (() => Promise.reject(new Error('offline'))) as unknown as typeof globalThis.fetch;
    expect(await databaseDraft(db({}), 'ws-1', broken).start()).toEqual({ ok: false, message: COULD_NOT_SAVE });
  });
});

describe('reading the draft again', () => {
  it('reads the business\'s latest draft row', async () => {
    const d = db({ business_drafts: { data: [{ ...DRAFT, state: 'done', counts: { readmes: 1 } }] } });
    expect(await databaseDraft(d, 'ws-1').latest()).toMatchObject({ id: 'd-1', state: 'done', counts: { readmes: 1 } });
    expect(d.reads[0]).toMatchObject({ table: 'business_drafts', filters: [['eq', 'workspace_id', 'ws-1'], ['order', 'started_at', { ascending: false }], ['limit', 1]] });
    expect(await databaseDraft(db({ business_drafts: { data: [] } }), 'ws-1').latest()).toBeNull();
    expect(await databaseDraft(db({ business_drafts: { error: { message: 'down' } } }), 'ws-1').latest()).toBeNull();
  });

  it('reads every claim again, each with its receipts', async () => {
    const d = db({
      claims: { data: [{ id: 'c-1', seq: 1, kind: 'region', value: 'France', source: 'evidence', state: 'proposed', product_id: null, replaces: null }] },
      claim_receipts: { data: [{ claim_id: 'c-1', kind: 'file', location: 'acme/app/README.md', quote: 'Sold in France', seen_at: '2026-09-30T10:00:00Z' }] },
    });
    const claims = await databaseDraft(d, 'ws-1').claims();
    expect(claims?.map((c) => [c.value, c.receipts?.[0]?.quote])).toEqual([['France', 'Sold in France']]);
    expect(d.reads.map((r) => [r.table, r.filters[0]])).toEqual([['claims', ['eq', 'workspace_id', 'ws-1']], ['claim_receipts', ['eq', 'workspace_id', 'ws-1']]]);
    expect(await databaseDraft(db({ claims: { error: { message: 'down' } } }), 'ws-1').claims()).toBeNull();
  });
});

describe('reading what does not parse (PRD 1030)', () => {
  it('reads a draft row that is not one as none, and claims that are not claims as unreadable', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await databaseDraft(db({ business_drafts: { data: [{ ...DRAFT, scanned: [{ source: 'x', state: 'lost' }] }] } }), 'ws-1').latest()).toBeNull();
    const claims = { data: [{ id: 'c-1', seq: '1', kind: 'region', value: 'France', source: 'evidence', state: 'proposed' }] };
    expect(await databaseDraft(db({ claims }), 'ws-1').claims()).toBeNull();
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('business/draft-port: claims: the answer does not parse: [0].seq invalid_type'));
    logged.mockRestore();
  });

  it('answers could-not-save when the draft route answers no draft row', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { fetch } = fetcher(200, { draft: { id: 'd-1' } });
    expect(await databaseDraft(db({}), 'ws-1', fetch).start()).toEqual({ ok: false, message: COULD_NOT_SAVE });
    logged.mockRestore();
  });
});

describe('the browser client as the draft\'s port', () => {
  it('replays each select\'s chain on the client\'s own builder when it is awaited', async () => {
    const steps: unknown[] = [];
    const builder = {
      eq: (c: string, v: unknown) => (steps.push(['eq', c, v]), builder),
      order: (c: string, o?: unknown) => (steps.push(['order', c, o]), builder),
      limit: (n: number) => (steps.push(['limit', n]), builder),
      then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: [DRAFT], error: null }).then(ok),
    };
    const client = {
      from: (table: string) => ({ select: (columns: string) => (steps.push(['from', table, columns]), builder) }),
      rpc: (fn: string, args: unknown) => Promise.resolve({ data: { fn, args }, error: null }),
    };
    const port = draftDbOver(client as never);
    const query = port.from('business_drafts').select('id').eq('workspace_id', 'ws-1').order('started_at', { ascending: false }).limit(1);
    expect(steps).toEqual([]);
    expect(await query).toEqual({ data: [DRAFT], error: null });
    expect(steps).toEqual([['from', 'business_drafts', 'id'], ['eq', 'workspace_id', 'ws-1'], ['order', 'started_at', { ascending: false }], ['limit', 1]]);
    expect(await port.rpc('claim_still_true', { p_claim: 'c-1' })).toEqual({ data: { fn: 'claim_still_true', args: { p_claim: 'c-1' } }, error: null });
  });
});

describe('web pages', () => {
  it('adds one through the sources route, and shows its refusal', async () => {
    const f = fetcher(201, { source: { id: 'p-1', url: 'https://example.com/pricing', added_at: '2026-09-30T10:00:00Z' } });
    expect(await databaseDraft(db({}), 'ws-1', f.fetch).addPage('https://example.com/pricing')).toEqual({ ok: true, page: { id: 'p-1', url: 'https://example.com/pricing' } });
    expect(f.sent[0]).toMatchObject({ url: SOURCES_ROUTE, init: { method: 'POST' } });
    expect(sentOf(sure(f.sent[0], 'f.sent[0]').init.body)).toEqual({ workspace: 'ws-1', url: 'https://example.com/pricing' });
    expect(await databaseDraft(db({}), 'ws-1', fetcher(400, { error: 'Three web pages at most.' }).fetch).addPage('https://d.example'))
      .toEqual({ ok: false, message: 'Three web pages at most.' });
  });

  it('removes one through the sources route', async () => {
    const f = fetcher(200, { removed: 'p-1' });
    expect(await databaseDraft(db({}), 'ws-1', f.fetch).removePage('p-1')).toEqual({ ok: true });
    expect(f.sent[0]).toMatchObject({ url: SOURCES_ROUTE, init: { method: 'DELETE' } });
    expect(sentOf(sure(f.sent[0], 'f.sent[0]').init.body)).toEqual({ workspace: 'ws-1', source: 'p-1' });
  });
});

describe('That\'s us', () => {
  it('calls claims_confirm_proposed() with the rows marked ✗', async () => {
    const d = db({}, { data: 3 });
    expect(await databaseDraft(d, 'ws-1').thatsUs(['c-2'])).toEqual({ ok: true });
    expect(d.calls).toEqual([['claims_confirm_proposed', { p_workspace: 'ws-1', p_rejected: ['c-2'] }]]);
    expect(await databaseDraft(db({}, { error: { code: '42501' } }), 'ws-1').thatsUs([])).toEqual({ ok: false, message: NOT_MEMBER });
  });
});

describe('✓ Still true (s4)', () => {
  it('calls claim_still_true() and answers when the claim was seen', async () => {
    const d = db({}, { data: { id: 'c-5', last_seen: '2026-10-05T09:00:00Z' } });
    expect(await databaseDraft(d, 'ws-1').stillTrue('c-5')).toEqual({ ok: true, at: '2026-10-05T09:00:00Z' });
    expect(d.calls).toEqual([['claim_still_true', { p_workspace: 'ws-1', p_claim: 'c-5' }]]);
  });

  it('says why it was refused', async () => {
    expect(await databaseDraft(db({}, { error: { code: '42501' } }), 'ws-1').stillTrue('c-5')).toEqual({ ok: false, message: NOT_MEMBER });
    expect(await databaseDraft(db({}, { data: null }), 'ws-1').stillTrue('c-5')).toEqual({ ok: false, message: COULD_NOT_SAVE });
  });

  it('in the demo, is seen now', async () => {
    const kept = await demoDraftPort(() => []).stillTrue('demo-1');
    expect(kept.ok && Number.isNaN(Date.parse(kept.at))).toBe(false);
  });
});

describe('the demo', () => {
  const ERP: Claim = { id: 'demo-1', seq: 1, kind: 'offering', value: 'ERP', source: 'pick', state: 'confirmed', cited: 0, lastBy: null };

  it('drafts in memory over the page\'s claims: a running draft, then a done one with the scan, and claims it found with receipts', async () => {
    let page: Claim[] = [ERP];
    const port = demoDraftPort(() => page);
    const started = await port.start();
    expect(started).toMatchObject({ ok: true, draft: { state: 'running' } });
    const done = await port.latest();
    expect(done?.state).toBe('done');
    expect(done?.scanned.some((s) => s.state === 'skipped')).toBe(true);
    const claims = (await port.claims()) ?? [];
    const found = claims.filter((c) => c.state === 'proposed' && c.source === 'evidence');
    expect(found.length).toBeGreaterThanOrEqual(2);
    expect(found.every((c) => (c.receipts ?? []).length > 0)).toBe(true);
    expect(claims[0]).toEqual(ERP);
    expect(new Set(claims.map((c) => c.id)).size).toBe(claims.length);
    // A claim picked in the page after the draft stays.
    page = [...page, { ...ERP, id: 'demo-9', seq: 9, kind: 'rival', value: 'Acme Build' }];
    expect((await port.claims())?.map((c) => c.id)).toContain('demo-9');
  });

  it('proposes nothing the page already holds', async () => {
    const port = demoDraftPort(() => [{ ...ERP, kind: 'region', value: 'France' }]);
    await port.start();
    await port.latest();
    expect((await port.claims())?.filter((c) => c.value === 'France')).toHaveLength(1);
  });

  it('keeps three web pages at most, https only', async () => {
    const port = demoDraftPort(() => []);
    for (const n of [1, 2, 3]) expect((await port.addPage(`https://example.com/${n}`)).ok).toBe(true);
    expect(await port.addPage('https://example.com/4')).toMatchObject({ ok: false });
    expect(await port.addPage('http://example.com/5')).toMatchObject({ ok: false });
    expect(await port.removePage('demo-page-1')).toEqual({ ok: true });
  });
});
