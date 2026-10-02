import { describe, expect, it } from 'vitest';
import { liveOf } from './model';
import {
  constituentRefusalOf, COULD_NOT_SAVE, databaseConstituents, demoConstituentsPort, GONE, INVALID_FIELD, NOT_OWNER,
} from './store';

// The constituents' writes (PRD 871 s1): the functions, called as the signed-in person (stubbed: no test
// calls Supabase), their refusals as the panel says them, and the demo's same rules in memory.

const ROW = {
  id: 'c-1', product_id: 'p-1', kind: 'never', seq: 1, body: 'Calls real Vertuoza APIs', created_by: 'u-1',
  created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-01T09:00:00Z', removed_at: null, removed_by: null,
};

function db(answers: Array<{ data?: unknown; error?: unknown } | Error>) {
  const calls: Array<[string, Record<string, unknown>]> = [];
  return {
    calls,
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push([fn, args]);
      const next = answers.shift() ?? { data: null };
      if (next instanceof Error) return Promise.reject(next);
      return Promise.resolve({ data: next.data ?? null, error: next.error ?? null });
    },
  };
}

describe('the constituent functions', () => {
  it('adds with constituent_add(), on the workspace and product, and reads the saved row', async () => {
    const d = db([{ data: ROW }]);
    expect(await databaseConstituents(d, 'ws-1').add('p-1', 'never', 'Calls real Vertuoza APIs')).toEqual({
      ok: true,
      constituent: { id: 'c-1', product: 'p-1', kind: 'never', displayId: 'never#1', text: 'Calls real Vertuoza APIs', removed: false, updatedAt: '2026-10-01T09:00:00Z' },
    });
    expect(d.calls).toEqual([['constituent_add', { p_workspace: 'ws-1', p_product: 'p-1', p_kind: 'never', p_text: 'Calls real Vertuoza APIs' }]]);
  });

  it('edits with constituent_edit() and removes with constituent_remove()', async () => {
    const d = db([{ data: ROW }, { data: { ...ROW, removed_at: '2026-10-01T10:00:00Z' } }]);
    const port = databaseConstituents(d, 'ws-1');
    await port.edit('c-1', 'Calls real APIs');
    expect(await port.remove('c-1')).toMatchObject({ ok: true, constituent: { removed: true } });
    expect(d.calls).toEqual([
      ['constituent_edit', { p_workspace: 'ws-1', p_constituent: 'c-1', p_text: 'Calls real APIs' }],
      ['constituent_remove', { p_workspace: 'ws-1', p_constituent: 'c-1' }],
    ]);
  });

  it('says each refusal plainly: not an owner, gone, the invalid field, anything else', async () => {
    const answers = [
      { error: { code: '42501' } }, { error: { code: 'P0002' } }, { error: { code: '22023', hint: 'text' } },
      { error: { code: '22023', hint: 'kind' } }, { error: { code: '08000' } }, new Error('offline'), { data: null },
    ];
    const port = databaseConstituents(db(answers), 'ws-1');
    const said = [];
    for (let i = 0; i < 7; i++) said.push(await port.add('p-1', 'never', 'x'));
    expect(said).toEqual([NOT_OWNER, GONE, INVALID_FIELD.text, INVALID_FIELD.kind, COULD_NOT_SAVE, COULD_NOT_SAVE, COULD_NOT_SAVE]
      .map((message) => ({ ok: false, message })));
    expect(constituentRefusalOf({ code: '22023', hint: 'product' })).toBe(INVALID_FIELD.product);
  });
});

describe('the demo', () => {
  const clock = () => {
    let t = 0;
    return () => `2026-10-01T09:00:0${t++}Z`;
  };

  it('adds a Statement and Never lines, edits, removes, and never reuses a removed id', async () => {
    const port = demoConstituentsPort({ products: ['p-1'], by: 'u-1', now: clock() });
    const statement = await port.add('p-1', 'statement', '  The component workshop ');
    expect(statement).toMatchObject({ ok: true, constituent: { displayId: 'statement', text: 'The component workshop' } });
    expect(await port.add('p-1', 'statement', 'Another')).toEqual({ ok: false, message: INVALID_FIELD.kind });
    const one = await port.add('p-1', 'never', 'Calls real APIs');
    const two = await port.add('p-1', 'never', 'Holds business logic');
    expect([one, two].map((s) => s.ok && s.constituent.displayId)).toEqual(['never#1', 'never#2']);

    const id = (s: typeof one) => (s.ok ? s.constituent.id : '');
    await port.edit(id(statement), 'The component workshop for Vertuoza');
    await port.edit(id(statement), 'The component workshop for Vertuoza');
    expect(await port.remove(id(two))).toMatchObject({ ok: true, constituent: { removed: true } });
    expect(await port.remove(id(two))).toEqual({ ok: false, message: GONE });
    expect(await port.edit(id(two), 'Back')).toEqual({ ok: false, message: GONE });
    expect(await port.add('p-1', 'never', 'Next')).toMatchObject({ ok: true, constituent: { displayId: 'never#3' } });

    const live = liveOf(port.constituents(), 'p-1');
    expect(live.statement?.text).toBe('The component workshop for Vertuoza');
    expect(live.never.map((c) => c.displayId)).toEqual(['never#1', 'never#3']);
    expect(port.history().map((e) => [e.action, e.before, e.after])).toEqual([
      ['added', null, 'Next'],
      ['removed', 'Holds business logic', null],
      ['edited', 'The component workshop', 'The component workshop for Vertuoza'],
      ['added', null, 'Holds business logic'],
      ['added', null, 'Calls real APIs'],
      ['added', null, 'The component workshop'],
    ]);
    expect(port.history()[0]).toMatchObject({ by: 'u-1', product: 'p-1' });
  });

  it('refuses a blank, multi-line or too long line, and an unknown product', async () => {
    const port = demoConstituentsPort({ products: ['p-1'], by: 'u-1' });
    for (const text of ['  ', 'two\nlines', 'x'.repeat(201)]) {
      expect(await port.add('p-1', 'never', text)).toEqual({ ok: false, message: INVALID_FIELD.text });
    }
    expect(await port.add('p-1', 'statement', 'x'.repeat(400))).toMatchObject({ ok: true });
    expect(await port.add('p-9', 'never', 'Elsewhere')).toEqual({ ok: false, message: GONE });
    expect(port.history()).toHaveLength(1);
  });
});
