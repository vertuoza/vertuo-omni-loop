import { describe, expect, it } from 'vitest';
import { defaultPitchSettings } from 'vertuo-omni-plan/kit/lib/pitch/settings.ts';
import { COULD_NOT_SAVE, databaseProducts, demoProductsPort, GONE, NOT_EDITOR, OUT_OF_SHAPE, refusalOf } from './store';

// Settings › Products's calls: set_pitch_look() (PRD 859 s1) and set_pitch_settings() (PRD 1108 s1), as
// the signed-in person, answering what they saved or a refusal the page shows; and the demo, which keeps
// the same rules in memory.

const KEYNOTE = { ...defaultPitchSettings('keynote'), voice: { preset: 'formal' as const, instructions: 'Say worksite.' } };

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

describe('saving the Pitch settings', () => {
  it('saves them filled with set_pitch_settings(), answering the settings it stored', async () => {
    const d = db({ data: { id: 'p-1', name: 'Vertuoza', pitch_look: 'keynote', pitch: KEYNOTE } });
    const submitted = { look: { preset: 'keynote' }, voice: { preset: 'formal', instructions: 'Say worksite.' } };
    expect(await databaseProducts(d, 'ws-1').setPitch('p-1', submitted)).toEqual({ ok: true, pitch: KEYNOTE });
    expect(d.calls).toEqual([['set_pitch_settings', { p_workspace: 'ws-1', p_product: 'p-1', p_pitch: KEYNOTE }]]);
  });

  it('refuses settings out of shape before any call, naming each field', async () => {
    const d = db({ data: null });
    const saved = await databaseProducts(d, 'ws-1').setPitch('p-1', { length: { min: 5 }, voice: { preset: 'grumpy' } });
    expect(saved).toEqual({ ok: false, message: `${OUT_OF_SHAPE} voice.preset: one of confident-warm, playful, formal, hype; length.min: the length is 15 to 60 seconds` });
    expect(d.calls).toEqual([]);
  });

  it('says why the database refused them, and keeps going when the call throws', async () => {
    const port = (answer: Parameters<typeof db>[0]) => databaseProducts(db(answer), 'ws-1');
    expect(await port({ error: { code: '42501' } }).setPitch('p-1', {})).toEqual({ ok: false, message: NOT_EDITOR });
    expect(await port({ error: { code: 'P0002' } }).setPitch('p-1', {})).toEqual({ ok: false, message: GONE });
    expect(await port({ error: { code: '22023', message: 'Pitch settings: at most 16 KB.' } }).setPitch('p-1', {})).toEqual({ ok: false, message: `${OUT_OF_SHAPE} Pitch settings: at most 16 KB.` });
    expect(await port(new Error('offline')).setPitch('p-1', {})).toEqual({ ok: false, message: COULD_NOT_SAVE });
    expect(await port({}).setPitch('p-1', {})).toEqual({ ok: false, message: COULD_NOT_SAVE });
    expect(await port({ data: { id: 'p-1', name: 'Vertuoza', pitch: { length: { min: 3 } } } }).setPitch('p-1', {})).toEqual({ ok: false, message: COULD_NOT_SAVE });
  });
});

describe('the demo', () => {
  it("saves one product's Pitch settings, its look following the preset, and leaves the others", async () => {
    const port = demoProductsPort([{ id: 'p-1', name: 'Widgets', look: 'arcade' }, { id: 'p-2', name: 'Legacy', look: 'arcade' }]);
    expect(await port.setPitch('p-2', { look: { preset: 'keynote' } })).toEqual({ ok: true, pitch: defaultPitchSettings('keynote') });
    // Its look follows the preset: choosing it again changes nothing else.
    expect(await port.setLook('p-2', 'keynote')).toEqual({ ok: true, product: { id: 'p-2', name: 'Legacy', look: 'keynote' } });
    expect(await port.setLook('p-1', 'arcade')).toEqual({ ok: true, product: { id: 'p-1', name: 'Widgets', look: 'arcade' } });
    expect((await port.setPitch('p-9', {})).ok).toBe(false);
    expect((await port.setPitch('p-1', { length: { max: 99 } })).ok).toBe(false);
  });

  it('changes one product\'s look and leaves the others', async () => {
    const port = demoProductsPort([{ id: 'p-1', name: 'Widgets', look: 'arcade' }, { id: 'p-2', name: 'Legacy', look: 'arcade' }]);
    expect(await port.setLook('p-2', 'keynote')).toEqual({ ok: true, product: { id: 'p-2', name: 'Legacy', look: 'keynote' } });
    expect(await port.setLook('p-1', 'arcade')).toEqual({ ok: true, product: { id: 'p-1', name: 'Widgets', look: 'arcade' } });
    expect(await port.setLook('p-9', 'keynote')).toEqual({ ok: false, message: GONE });
  });
});
