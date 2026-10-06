import { describe, expect, it } from 'vitest';
import { COULD_NOT_SAVE, databaseProducts, demoProductsPort, GONE, NOT_EDITOR, refusalOf } from './store';

// Settings › Products's one call (PRD 859 s1): set_pitch_look(), as the signed-in person, answering
// the product it saved or a refusal the page shows; and the demo, which keeps the same rule in memory.

function db(answer: { data?: unknown; error?: unknown } | Error) {
  const calls: [string, unknown][] = [];
  return {
    calls,
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push([fn, args]);
      if (answer instanceof Error) return Promise.reject(answer);
      return Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null });
    },
  };
}

describe('the database call', () => {
  it('changes a product\'s look with set_pitch_look(), answering the product it saved', async () => {
    const d = db({ data: { id: 'p-1', name: 'Vertuoza', pitch_look: 'keynote' } });
    expect(await databaseProducts(d, 'ws-1').setLook('p-1', 'keynote')).toEqual({ ok: true, product: { id: 'p-1', name: 'Vertuoza', look: 'keynote' } });
    expect(d.calls).toEqual([['set_pitch_look', { p_workspace: 'ws-1', p_product: 'p-1', p_look: 'keynote' }]]);
  });

  it('says why a change was refused, and keeps going when the call throws', async () => {
    expect(await databaseProducts(db({ error: { code: '42501' } }), 'ws-1').setLook('p-1', 'keynote')).toEqual({ ok: false, message: NOT_EDITOR });
    expect(await databaseProducts(db({ error: { code: 'P0002' } }), 'ws-1').setLook('p-1', 'keynote')).toEqual({ ok: false, message: GONE });
    expect(await databaseProducts(db(new Error('offline')), 'ws-1').setLook('p-1', 'keynote')).toEqual({ ok: false, message: COULD_NOT_SAVE });
    expect(await databaseProducts(db({}), 'ws-1').setLook('p-1', 'keynote')).toEqual({ ok: false, message: COULD_NOT_SAVE });
    expect(refusalOf({ code: '22023' })).toBe(COULD_NOT_SAVE);
  });
});

describe('the demo', () => {
  it('changes one product\'s look and leaves the others', async () => {
    const port = demoProductsPort([{ id: 'p-1', name: 'Widgets', look: 'arcade' }, { id: 'p-2', name: 'Legacy', look: 'arcade' }]);
    expect(await port.setLook('p-2', 'keynote')).toEqual({ ok: true, product: { id: 'p-2', name: 'Legacy', look: 'keynote' } });
    expect(await port.setLook('p-1', 'arcade')).toEqual({ ok: true, product: { id: 'p-1', name: 'Widgets', look: 'arcade' } });
    expect(await port.setLook('p-9', 'keynote')).toEqual({ ok: false, message: GONE });
  });
});
