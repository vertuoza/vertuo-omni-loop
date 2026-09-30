import { describe, expect, it } from 'vitest';
import { planPick, type Claim } from './model';
import { callsOf, confirmCalls, COULD_NOT_SAVE, databaseBusiness, demoBusinessPort, INVALID, NOT_MEMBER, refusalOf, run, type Step } from './store';

// Settings → Business's calls (PRD 748 s2): claim_pick() and claim_set_state(), as the signed-in
// person, each answering the row it saved or a refusal the page shows; a re-pick of a one-value kind,
// which rejects the old claim before it picks the new one; and the demo, which keeps the same rules in
// memory.

function db(answers: Array<{ data?: unknown; error?: unknown } | Error>) {
  const calls: [string, unknown][] = [];
  return {
    calls,
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push([fn, args]);
      const answer = answers[Math.min(calls.length - 1, answers.length - 1)];
      if (answer instanceof Error) throw answer;
      return { data: answer.data ?? null, error: answer.error ?? null };
    },
  };
}

const row = (over: Record<string, unknown> = {}) => ({ id: 'c-1', seq: 1, kind: 'offering', value: 'ERP', source: 'pick', state: 'confirmed', product_id: 'p-1', ...over });
const CLAIM: Claim = { id: 'c-1', seq: 1, kind: 'offering', value: 'ERP', source: 'pick', state: 'confirmed', product: 'p-1', cited: 0, lastBy: null };

describe('the database calls', () => {
  it('picks with claim_pick(), confirmed with source pick, on the product the page shows', async () => {
    const d = db([{ data: row() }]);
    expect(await databaseBusiness(d, 'ws-1', 'p-1').pick('offering', 'ERP')).toEqual({ ok: true, claim: CLAIM });
    expect(d.calls).toEqual([['claim_pick', { p_workspace: 'ws-1', p_product: 'p-1', p_kind: 'offering', p_value: 'ERP', p_source: 'pick' }]]);
  });

  it('picks a region on the business, with no product', async () => {
    const d = db([{ data: row({ kind: 'region', value: 'Belgium', product_id: null }) }]);
    await databaseBusiness(d, 'ws-1', 'p-1').pick('region', 'Belgium');
    expect(d.calls[0][1]).toMatchObject({ p_product: null, p_kind: 'region' });
  });

  it('sets ✓ and ✗ with claim_set_state()', async () => {
    const d = db([{ data: row({ state: 'rejected' }) }]);
    expect(await databaseBusiness(d, 'ws-1', 'p-1').setState(CLAIM, 'rejected')).toMatchObject({ ok: true, claim: { state: 'rejected' } });
    expect(d.calls).toEqual([['claim_set_state', { p_workspace: 'ws-1', p_claim: 'c-1', p_state: 'rejected' }]]);
  });

  it('answers a refusal for a non-member, a bad value, an error, nothing, or a failed call', async () => {
    const port = (answer: { data?: unknown; error?: unknown } | Error) => databaseBusiness(db([answer]), 'ws-1', 'p-1');
    expect(await port({ error: { code: '42501' } }).pick('rival', 'x')).toEqual({ ok: false, message: NOT_MEMBER });
    expect(await port({ error: { code: '22023' } }).pick('rival', 'x')).toEqual({ ok: false, message: INVALID });
    expect(await port({ error: { code: 'XX000' } }).pick('rival', 'x')).toEqual({ ok: false, message: COULD_NOT_SAVE });
    expect(await port({}).setState(CLAIM, 'confirmed')).toEqual({ ok: false, message: COULD_NOT_SAVE });
    expect(await port(new Error('fetch failed')).pick('rival', 'x')).toEqual({ ok: false, message: COULD_NOT_SAVE });
  });
});

describe('a refusal', () => {
  it('names membership for 42501, and asks to try again otherwise', () => {
    expect(refusalOf({ code: '42501' })).toBe(NOT_MEMBER);
    expect(refusalOf({ code: 'P0002' })).toContain('Reload the page');
    expect(refusalOf(null)).toBe(COULD_NOT_SAVE);
  });
});

describe('a re-pick', () => {
  it('rejects the old size through claim_set_state() before it picks the new one, so one size stays confirmed', async () => {
    const old: Claim = { ...CLAIM, id: 'c-2', seq: 2, kind: 'size', value: '2-50' };
    const d = db([{ data: row({ id: 'c-2', seq: 2, kind: 'size', value: '2-50', state: 'rejected' }) }, { data: row({ id: 'c-3', seq: 3, kind: 'size', value: '5-100' }) }]);
    const steps: Step[] = [];
    const port = databaseBusiness(d, 'ws-1', 'p-1');
    expect(await run(callsOf(port, 'size', planPick([old], 'size', '5-100')), (s) => steps.push(s))).toBe(true);
    expect(d.calls.map((c) => c[0])).toEqual(['claim_set_state', 'claim_pick']);
    expect(d.calls[0][1]).toMatchObject({ p_claim: 'c-2', p_state: 'rejected' });
    expect(d.calls[1][1]).toMatchObject({ p_kind: 'size', p_value: '5-100' });
    expect(steps.map((s) => s.type === 'saved' && [s.claim.value, s.claim.state])).toEqual([['2-50', 'rejected'], ['5-100', 'confirmed']]);
  });

  it('stops at the first refusal, and never picks after a rejection that failed', async () => {
    const d = db([{ error: { code: '42501' } }]);
    const steps: Step[] = [];
    const port = databaseBusiness(d, 'ws-1', 'p-1');
    expect(await run(callsOf(port, 'offering', planPick([CLAIM], 'offering', 'CRM')), (s) => steps.push(s))).toBe(false);
    expect(d.calls.map((c) => c[0])).toEqual(['claim_set_state']);
    expect(steps).toEqual([{ type: 'refused', message: NOT_MEMBER }]);
  });

  it('confirms a row after rejecting the one it replaces', async () => {
    const d = db([{ data: row({ state: 'rejected' }) }, { data: row({ id: 'c-5', seq: 5, value: 'CRM' }) }]);
    const crm: Claim = { ...CLAIM, id: 'c-5', seq: 5, value: 'CRM', state: 'rejected' };
    await run(confirmCalls(databaseBusiness(d, 'ws-1', 'p-1'), [CLAIM], crm), () => {});
    expect(d.calls).toEqual([
      ['claim_set_state', { p_workspace: 'ws-1', p_claim: 'c-1', p_state: 'rejected' }],
      ['claim_set_state', { p_workspace: 'ws-1', p_claim: 'c-5', p_state: 'confirmed' }],
    ]);
  });
});

describe('the demo', () => {
  it('picks a new claim with the next number, confirms one already there, and rejects', async () => {
    const port = demoBusinessPort([CLAIM]);
    expect(await port.pick('rival', ' Acme Build ')).toMatchObject({ ok: true, claim: { seq: 2, kind: 'rival', value: 'Acme Build', state: 'confirmed', source: 'pick' } });
    expect(await port.setState(CLAIM, 'rejected')).toMatchObject({ ok: true, claim: { state: 'rejected' } });
    expect(await port.pick('offering', 'erp')).toMatchObject({ ok: true, claim: { id: 'c-1', state: 'confirmed' } });
  });

  it('refuses an empty value, and a claim it does not hold', async () => {
    expect(await demoBusinessPort([]).pick('rival', '  ')).toEqual({ ok: false, message: INVALID });
    expect(await demoBusinessPort([]).setState(CLAIM, 'confirmed')).toMatchObject({ ok: false });
  });
});

describe('suggested rivals', () => {
  function stubFetch(reply: { ok: boolean; body?: unknown } | Error) {
    const calls: Array<[string, RequestInit]> = [];
    const fetch = (async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      if (reply instanceof Error) throw reply;
      return { ok: reply.ok, json: async () => reply.body } as Response;
    }) as unknown as typeof globalThis.fetch;
    return { calls, fetch };
  }

  it('asks the suggest-rivals route for the workspace and product the page shows, and reads the proposed rivals', async () => {
    const s = stubFetch({ ok: true, body: { claims: [row({ id: 'c-7', seq: 7, kind: 'rival', value: 'Alpha', source: 'suggestion', state: 'proposed' })] } });
    const found = await databaseBusiness(db([]), 'ws-1', 'p-1', s.fetch).suggest();
    expect(found).toEqual([{ id: 'c-7', seq: 7, kind: 'rival', value: 'Alpha', source: 'suggestion', state: 'proposed', product: 'p-1', cited: 0, lastBy: null }]);
    expect(s.calls[0][0]).toBe('/api/business/suggest-rivals');
    expect(s.calls[0][1].method).toBe('POST');
    expect(JSON.parse(String(s.calls[0][1].body))).toEqual({ workspace: 'ws-1', product: 'p-1' });
  });

  it('finds no guess, and says nothing, on a refusal, a broken body or no network', async () => {
    for (const reply of [{ ok: false, body: { error: 'no' } }, { ok: true, body: 'nope' }, new Error('offline')]) {
      expect(await databaseBusiness(db([]), 'ws-1', 'p-1', stubFetch(reply).fetch).suggest()).toEqual([]);
    }
  });

  it('keeps only proposed rivals from the answer', async () => {
    const s = stubFetch({ ok: true, body: { claims: [row({ kind: 'rival', value: 'Kept', state: 'confirmed' }), row({ id: 'c-2', kind: 'offering', state: 'proposed' })] } });
    expect(await databaseBusiness(db([]), 'ws-1', 'p-1', s.fetch).suggest()).toEqual([]);
  });

  it('guesses nothing in the demo', async () => {
    expect(await demoBusinessPort([CLAIM]).suggest()).toEqual([]);
  });

  it('asks for the product it is given (PRD 748 s4)', async () => {
    const s = stubFetch({ ok: true, body: { claims: [] } });
    await databaseBusiness(db([]), 'ws-1', 'p-1', s.fetch).suggest('p-2');
    expect(JSON.parse(String(s.calls[0][1].body))).toEqual({ workspace: 'ws-1', product: 'p-2' });
  });
});

describe('products (PRD 748 s4)', () => {
  it('picks on the product it is given, a region still on the business', async () => {
    const d = db([{ data: row({ product_id: 'p-2' }) }, { data: row({ kind: 'region', product_id: null }) }]);
    const port = databaseBusiness(d, 'ws-1', 'p-1');
    await port.pick('offering', 'ERP', 'p-2');
    await port.pick('region', 'Belgium', 'p-2');
    expect(d.calls[0][1]).toMatchObject({ p_product: 'p-2' });
    expect(d.calls[1][1]).toMatchObject({ p_product: null });
  });

  it('makes a plan\'s pick on the product it is given', async () => {
    const d = db([{ data: row({ product_id: 'p-2' }) }]);
    await run(callsOf(databaseBusiness(d, 'ws-1', 'p-1'), 'offering', planPick([], 'offering', 'ERP'), 'p-2'), () => {});
    expect(d.calls[0]).toEqual(['claim_pick', expect.objectContaining({ p_product: 'p-2' })]);
  });

  it('adds a product with product_add(), answering it, or a refusal', async () => {
    const d = db([{ data: { id: 'p-2', name: 'Omni Loop', workspace_id: 'ws-1' } }]);
    expect(await databaseBusiness(d, 'ws-1', 'p-1').addProduct('Omni Loop')).toEqual({ ok: true, product: { id: 'p-2', name: 'Omni Loop' } });
    expect(d.calls).toEqual([['product_add', { p_workspace: 'ws-1', p_name: 'Omni Loop' }]]);
    expect(await databaseBusiness(db([{ error: { code: '22023' } }]), 'ws-1', 'p-1').addProduct('Omni Loop')).toEqual({ ok: false, message: INVALID });
    expect(await databaseBusiness(db([new Error('offline')]), 'ws-1', 'p-1').addProduct('x')).toEqual({ ok: false, message: COULD_NOT_SAVE });
  });

  it('adds a product in the demo, refusing a name already taken, and picks on it', async () => {
    const port = demoBusinessPort([CLAIM], [{ id: 'demo-product-1', name: 'Acme ERP' }]);
    const added = await port.addProduct(' Widgets ');
    expect(added).toMatchObject({ ok: true, product: { name: 'Widgets' } });
    expect(await port.addProduct('widgets')).toEqual({ ok: false, message: INVALID });
    const id = added.ok ? added.product.id : '';
    expect(await port.pick('offering', 'ERP', id)).toMatchObject({ ok: true, claim: { seq: 2, product: id, state: 'confirmed' } });
    expect(await port.pick('region', 'Belgium', id)).toMatchObject({ ok: true, claim: { product: null } });
  });
});
