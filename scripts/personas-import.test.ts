// @ts-nocheck
// The personas import (PRD 799, s4): a dry run prints the workspace's name and the rows it would add,
// and writes nothing; one invalid row refuses the whole file, naming the row and the field; `--write`
// adds every row once, and never changes or deletes a persona already there. No test calls Supabase:
// the store is a fake, and the REST store runs against a stubbed fetch.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PERSONA_AVATAR_RANGES, validPersonaAvatar } from '../packages/design/src/index.ts';
import { checkRows, importPersonas, restStore } from './personas-import.ts';

const WS = '11111111-1111-4111-8111-111111111111';
const AVATAR = { v: 1, skin: 2, hair: 1, hairColor: 0, outfit: 3, accessory: 1 };
const PRODUCTS = [
  { id: 'p-app', name: 'Site App' },
  { id: 'p-books', name: 'Ledger' },
];

const row = (over = {}) => ({
  product: 'Site App', name: 'Sam', stance: 'neutral', trade: 'plumber',
  who: 'Runs a company of five plumbers', usage: 'Mostly the quotes', avatar: AVATAR, ...over,
});

const dirs = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true });
});

function fileOf(content) {
  const dir = mkdtempSync(join(tmpdir(), 'personas-import-'));
  dirs.push(dir);
  const file = join(dir, 'personas.json');
  writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
}

function fakeStore({ workspace = { id: WS, name: 'Acme Builders' }, products = PRODUCTS, personas = [], failOn } = {}) {
  const added = [];
  return {
    added,
    async workspace(id) { return id === WS ? workspace : null; },
    async products() { return products; },
    async personas() { return personas; },
    async add(workspaceId, p) {
      if (failOn === p.name) throw new Error('Supabase refused');
      added.push({ workspaceId, ...p });
    },
  };
}

async function run(args, store = fakeStore(), env = { SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: 'k' }) {
  const out = [];
  const err = [];
  const code = await importPersonas({
    argv: args, env, connect: () => store, out: (l) => out.push(l), err: (l) => err.push(l),
  });
  return { code, out: out.join('\n'), err: err.join('\n'), store };
}

describe('checkRows', () => {
  it('accepts a good row and resolves its product by name', () => {
    const { rows, errors } = checkRows([row({ product: ' site app ' })], PRODUCTS);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ row: 1, productId: 'p-app', productName: 'Site App', name: 'Sam', trade: 'plumber' });
  });

  it.each([
    ['name', { name: '' }],
    ['name', { name: 'x'.repeat(41) }],
    ['name', { name: 'two\nlines' }],
    ['stance', { stance: 'angry' }],
    ['trade', { trade: 'Plumber' }],
    ['trade', { trade: 'astronaut' }],
    ['who', { who: 'x'.repeat(401) }],
    ['usage', { usage: 'x'.repeat(401) }],
    ['avatar', { avatar: { ...AVATAR, skin: PERSONA_AVATAR_RANGES.skin.max + 1 } }],
    ['avatar', { avatar: { ...AVATAR, v: 2 } }],
    ['product', { product: 'Nope' }],
    ['colour', { colour: 'red' }],
  ])('refuses a bad %s', (field, over) => {
    const { errors } = checkRows([row(), row({ name: 'Lee', ...over })], PRODUCTS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(new RegExp(`^row 2\\b.*${field}`));
  });

  it('refuses a row that is not an object, and a file that is not an array', () => {
    expect(checkRows(['Sam'], PRODUCTS).errors[0]).toMatch(/^row 1/);
    expect(checkRows({ name: 'Sam' }, PRODUCTS).errors[0]).toMatch(/array/);
  });

  it('refuses the same persona twice on one product', () => {
    const { errors } = checkRows([row(), row({ avatar: undefined })], PRODUCTS);
    expect(errors[0]).toMatch(/^row 2 .*name.*row 1/);
  });

  it('picks an avatar in range when a row leaves it out, the same one every time', () => {
    const a = checkRows([row({ avatar: undefined })], PRODUCTS).rows[0].avatar;
    const b = checkRows([row({ avatar: undefined })], PRODUCTS).rows[0].avatar;
    expect(validPersonaAvatar(a)).toBe(true);
    expect(a).toEqual(b);
  });

  it('takes the only product when a row leaves it out, and asks for it with two', () => {
    expect(checkRows([row({ product: undefined })], PRODUCTS.slice(0, 1)).rows[0].productId).toBe('p-app');
    expect(checkRows([row({ product: undefined })], PRODUCTS).errors[0]).toMatch(/^row 1\b.*product/);
  });

  it('defaults who and usage to empty, and trims them', () => {
    const { rows } = checkRows([row({ who: undefined, usage: '  quotes  ' })], PRODUCTS);
    expect(rows[0]).toMatchObject({ who: '', usage: 'quotes' });
  });
});

describe('importPersonas', () => {
  it('a dry run prints the workspace name and the rows, and writes nothing', async () => {
    const file = fileOf([row(), row({ name: 'Ada', product: 'Ledger', trade: 'accountant', stance: 'skeptical' })]);
    const { code, out, store } = await run([WS, file]);
    expect(code).toBe(0);
    expect(out).toContain('Acme Builders');
    expect(out).toMatch(/Sam .*plumber.*neutral.*Site App/);
    expect(out).toMatch(/Ada .*accountant.*skeptical.*Ledger/);
    expect(out).toMatch(/would add 2/);
    expect(out).toMatch(/--write/);
    expect(store.added).toEqual([]);
  });

  it('one invalid row refuses the whole file, naming the row and the field, even with --write', async () => {
    const file = fileOf([row(), row({ name: 'Ada', stance: 'grumpy' })]);
    const { code, err, store } = await run([WS, file, '--write']);
    expect(code).toBe(1);
    expect(err).toMatch(/row 2 \(Ada\).*stance/);
    expect(err).toMatch(/nothing written/);
    expect(store.added).toEqual([]);
  });

  it('--write adds every row once, as given', async () => {
    const file = fileOf([row(), row({ name: 'Ada', product: 'Ledger', trade: 'accountant' })]);
    const { code, out, store } = await run(['--write', WS, file]);
    expect(code).toBe(0);
    expect(store.added.map((p) => [p.workspaceId, p.productId, p.name])).toEqual([[WS, 'p-app', 'Sam'], [WS, 'p-books', 'Ada']]);
    expect(store.added[0]).toMatchObject({ stance: 'neutral', trade: 'plumber', avatar: AVATAR, who: 'Runs a company of five plumbers', usage: 'Mostly the quotes' });
    expect(out).toMatch(/added 2/);
  });

  it('leaves a persona already on the product unchanged, and does not add it again', async () => {
    const file = fileOf([row(), row({ name: 'Ada' })]);
    const store = fakeStore({ personas: [{ productId: 'p-app', name: 'Sam' }] });
    const { code, out } = await run([WS, file, '--write'], store);
    expect(code).toBe(0);
    expect(store.added.map((p) => p.name)).toEqual(['Ada']);
    expect(out).toMatch(/Sam .*already there/);
    expect(out).toMatch(/added 1/);
  });

  it('refuses an unknown workspace before reading anything else', async () => {
    const { code, err } = await run(['22222222-2222-4222-8222-222222222222', fileOf([row()])]);
    expect(code).toBe(1);
    expect(err).toMatch(/no workspace/);
  });

  it('refuses a workspace without a product', async () => {
    const { code, err } = await run([WS, fileOf([row()])], fakeStore({ products: [] }));
    expect(code).toBe(1);
    expect(err).toMatch(/no product/);
  });

  it('refuses a file that is not JSON, and wrong arguments, before connecting', async () => {
    expect((await run([WS, fileOf('{nope')])).err).toMatch(/JSON/);
    const usage = await run([WS]);
    expect(usage.code).toBe(1);
    expect(usage.err).toMatch(/usage/i);
    expect((await run(['not-a-uuid', fileOf([row()])])).err).toMatch(/workspace id/);
  });

  it('names a missing variable and connects to nothing', async () => {
    const { code, err } = await run([WS, fileOf([row()])], fakeStore(), { SUPABASE_URL: 'http://x' });
    expect(code).toBe(1);
    expect(err).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('stops at a refused write, saying what was added and that a rerun adds the rest', async () => {
    const file = fileOf([row(), row({ name: 'Ada' }), row({ name: 'Bo' })]);
    const store = fakeStore({ failOn: 'Ada' });
    const { code, err } = await run([WS, file, '--write'], store);
    expect(code).toBe(1);
    expect(store.added.map((p) => p.name)).toEqual(['Sam']);
    expect(err).toMatch(/row 2 \(Ada\).*Supabase refused/);
    expect(err).toMatch(/rerun/);
  });
});

describe('restStore', () => {
  function stub(responses) {
    const calls = [];
    const fetch = async (url, init = {}) => {
      calls.push({ url: String(url), init });
      const [status, body] = responses.shift();
      return { ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
    };
    return { calls, fetch };
  }

  it('reads as the service role and adds through persona_add', async () => {
    const { calls, fetch } = stub([
      [200, [{ id: WS, name: 'Acme Builders' }]],
      [200, [{ id: 'p-app', name: 'Site App' }]],
      [200, [{ product_id: 'p-app', name: 'Sam' }]],
      [200, {}],
    ]);
    const store = restStore({ url: 'http://db/', key: 'secret', fetch });
    expect(await store.workspace(WS)).toEqual({ id: WS, name: 'Acme Builders' });
    expect(await store.products(WS)).toEqual([{ id: 'p-app', name: 'Site App' }]);
    expect(await store.personas(WS)).toEqual([{ productId: 'p-app', name: 'Sam' }]);
    await store.add(WS, { productId: 'p-app', name: 'Ada', stance: 'neutral', trade: 'nurse', avatar: AVATAR, who: '', usage: '' });

    expect(calls[0].url).toBe(`http://db/rest/v1/workspaces?select=id,name&id=eq.${WS}`);
    expect(calls[0].init.headers).toMatchObject({ apikey: 'secret', Authorization: 'Bearer secret' });
    expect(calls[3].url).toBe('http://db/rest/v1/rpc/persona_add');
    expect(calls[3].init.method).toBe('POST');
    expect(JSON.parse(calls[3].init.body)).toEqual({
      p_workspace: WS, p_product: 'p-app', p_name: 'Ada', p_stance: 'neutral', p_trade: 'nurse',
      p_avatar: AVATAR, p_who: '', p_usage: '',
    });
  });

  it('turns a refusal into an error carrying its message and hint', async () => {
    const { fetch } = stub([[400, { code: '22023', message: 'Stance: excited, neutral or skeptical.', hint: 'stance' }]]);
    await expect(restStore({ url: 'http://db', key: 'k', fetch }).add(WS, { productId: 'p' })).rejects.toThrow(/22023.*Stance.*stance/);
  });
});
