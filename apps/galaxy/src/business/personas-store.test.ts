import { describe, expect, it } from 'vitest';
import type { PersonaFields } from './personas';
import {
  COULD_NOT_SAVE, databasePersonas, demoPersonasPort, GONE, INVALID_FIELD, NOT_MEMBER, personaRefusalOf,
} from './personas-store';
import { sure } from '../arcade/sure';

// Settings → Business → Personas' calls (PRD 799 s3): the persona functions, called as the signed-in
// person (stubbed: no test calls Supabase), their refusals as the section says them, and the demo's
// same rules in memory.

const AVATAR = { v: 1 as const, skin: 0, hair: 1, hairColor: 2, outfit: 3, accessory: 1 };
const FIELDS: PersonaFields = { name: 'Marc', stance: 'skeptical', trade: 'plumber', avatar: AVATAR, who: 'Runs five plumbers', usage: 'Quotes' };
const ROW = { id: 'pe-1', product_id: 'p-1', ordinal: 4, name: 'Marc', stance: 'skeptical', trade: 'plumber', avatar: AVATAR, who: 'Runs five plumbers', usage: 'Quotes' };

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

describe('the persona functions', () => {
  it('adds with persona_add(), on the workspace and product, and reads the saved row', async () => {
    const d = db([{ data: ROW }]);
    expect(await databasePersonas(d, 'ws-1').add('p-1', FIELDS)).toEqual({
      ok: true, persona: { id: 'pe-1', product: 'p-1', ordinal: 4, name: 'Marc', stance: 'skeptical', trade: 'plumber', avatar: AVATAR, who: 'Runs five plumbers', usage: 'Quotes' },
    });
    expect(d.calls).toEqual([['persona_add', {
      p_workspace: 'ws-1', p_product: 'p-1', p_name: 'Marc', p_stance: 'skeptical', p_trade: 'plumber', p_avatar: AVATAR, p_who: 'Runs five plumbers', p_usage: 'Quotes',
    }]]);
  });

  it('edits with persona_edit(), deletes with persona_delete() and restores with persona_restore()', async () => {
    const d = db([{ data: ROW }, { data: ROW }, { data: ROW }]);
    const port = databasePersonas(d, 'ws-1');
    await port.edit('pe-1', FIELDS);
    await port.remove('pe-1');
    await port.restore('pe-1');
    expect(d.calls.map(([fn]) => fn)).toEqual(['persona_edit', 'persona_delete', 'persona_restore']);
    expect(sure(d.calls[0], 'd.calls[0]')[1]).toMatchObject({ p_workspace: 'ws-1', p_persona: 'pe-1', p_name: 'Marc', p_avatar: AVATAR });
    expect(sure(d.calls[1], 'd.calls[1]')[1]).toEqual({ p_workspace: 'ws-1', p_persona: 'pe-1' });
    expect(sure(d.calls[2], 'd.calls[2]')[1]).toEqual({ p_workspace: 'ws-1', p_persona: 'pe-1' });
  });

  it('says each refusal plainly: not a member, gone, the invalid field, anything else', async () => {
    const answers = [
      { error: { code: '42501' } }, { error: { code: 'P0002' } }, { error: { code: '22023', hint: 'name' } },
      { error: { code: '22023', hint: 'avatar' } }, { error: { code: '08000' } }, new Error('offline'), { data: null },
    ];
    const port = databasePersonas(db(answers), 'ws-1');
    const said = [];
    for (let i = 0; i < 7; i++) said.push(await port.add('p-1', FIELDS));
    expect(said).toEqual([NOT_MEMBER, GONE, INVALID_FIELD.name, INVALID_FIELD.avatar, COULD_NOT_SAVE, COULD_NOT_SAVE, COULD_NOT_SAVE].map((message) => ({ ok: false, message })));
  });

  it('names each field a 22023 can hint at', () => {
    for (const field of ['name', 'stance', 'trade', 'avatar', 'who', 'usage', 'product']) {
      expect(personaRefusalOf({ code: '22023', hint: field }), field).toBe(INVALID_FIELD[field]);
    }
  });
});

describe('the demo', () => {
  it('adds with the next place, trimmed, edits, deletes and restores', async () => {
    const port = demoPersonasPort();
    const added = await port.add('p-1', { ...FIELDS, name: '  Marc ' });
    expect(added).toMatchObject({ ok: true, persona: { name: 'Marc', ordinal: 1, product: 'p-1' } });
    const id = added.ok ? added.persona.id : '';
    expect(await port.edit(id, { ...FIELDS, name: 'Sofia' })).toMatchObject({ ok: true, persona: { id, name: 'Sofia', ordinal: 1 } });
    expect(await port.remove(id)).toMatchObject({ ok: true });
    expect(await port.edit(id, FIELDS)).toEqual({ ok: false, message: GONE });
    expect(await port.restore(id)).toMatchObject({ ok: true, persona: { id, name: 'Sofia' } });
    expect(await port.restore(id)).toEqual({ ok: false, message: GONE });
  });

  it('refuses what the database refuses, naming the field', async () => {
    const port = demoPersonasPort();
    expect(await port.add('p-1', { ...FIELDS, name: ' ' })).toEqual({ ok: false, message: INVALID_FIELD.name });
    expect(await port.add('p-1', { ...FIELDS, name: 'x'.repeat(41) })).toEqual({ ok: false, message: INVALID_FIELD.name });
    expect(await port.add('p-1', { ...FIELDS, who: 'x'.repeat(401) })).toEqual({ ok: false, message: INVALID_FIELD.who });
    expect(await port.add('p-1', { ...FIELDS, usage: 'x'.repeat(401) })).toEqual({ ok: false, message: INVALID_FIELD.usage });
    expect(await port.add('p-1', { ...FIELDS, avatar: { ...AVATAR, skin: 6 } })).toEqual({ ok: false, message: INVALID_FIELD.avatar });
    expect(await port.add('p-1', { ...FIELDS, trade: 'Site Foreman' })).toEqual({ ok: false, message: INVALID_FIELD.trade });
  });
});
