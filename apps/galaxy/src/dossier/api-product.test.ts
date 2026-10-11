// A product PRD's dossier calls (PRD 1548 s2): created by a push naming its product's key, pushed to by
// its key and its number, found by them, and its latest version of one kind read whole. Against the
// stubbed Supabase client of ./store.fake.ts, which writes dossier_push() and dossier_approval() of
// supabase/migrations/20261203100000_product_prd_ids.sql as the migration writes them.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { findDossier, getDossier, pushDossier, type DossierDeps } from './api';
import { FAKE_WORKSPACE, fakeSupabase } from './store.fake';

vi.mock('server-only', () => ({}));

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@vertuoza.com' };
const OTHER = '00000000-0000-4000-8000-00000000aced';
const CARL = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@vertuoza.com', workspaces: [OTHER] };
const START = Date.parse('2026-10-11T09:00:00Z');

const SPEC = '---\ntitle: Offline photo upload\n---\n\n# Offline photo upload\n';
const PLAN = '# Plan: offline photo upload\n';

function world() {
  const clock = { now: START };
  const fake = fakeSupabase({ 'ada-token': ADA, 'carl-token': CARL }, { [FAKE_WORKSPACE]: 'acme', [OTHER]: 'other-org' }, () => clock.now);
  const tells: string[] = [];
  const deps: DossierDeps = {
    connect: fake.client as unknown as DossierDeps['connect'],
    tellVoids: (_db, dossier) => { tells.push(dossier); return Promise.resolve(); },
  };
  const send = (path: string, method: string, token: string, body?: unknown) => new Request(`https://omni.example${path}`, {
    method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? null : JSON.stringify(body),
  });
  const read = async (response: Response) => ({ status: response.status, body: (await response.json()) as Record<string, unknown> });
  const push = async (body: unknown, token = 'ada-token') => read(await pushDossier(send('/api/dossiers/push', 'POST', token, body), deps));
  const find = async (query: string, token = 'ada-token') => read(await findDossier(send(`/api/dossiers${query}`, 'GET', token), deps));
  const get = async (query: string, token = 'ada-token') => read(await getDossier(send(`/api/dossiers/get${query}`, 'GET', token), deps));
  const mobile = fake.seedProduct('Mobile', ['acme/vertuo-mobile'], { key: 'mobile' });
  return { clock, fake, push, find, get, mobile, tells };
}

const A_STRING: unknown = expect.any(String);
const NEW = { productKey: 'mobile', new: true, title: 'Offline photo upload', artifacts: [{ kind: 'spec', content: SPEC }] };

describe('POST /api/dossiers/push with a product key: a product PRD', () => {
  it('creates the product\'s next PRD with no home repository, and answers its id', async () => {
    const w = world();
    const first = await w.push(NEW);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({
      id: A_STRING, prdId: 'mobile-1', url: `https://omni.example/prd/${String(first.body.id)}`,
      added: [{ kind: 'spec', version: 1 }], unchanged: [], product: 'Mobile',
    });
    expect((await w.push(NEW)).body.prdId).toBe('mobile-2');
    const row = w.fake.tables.dossiers.find((d) => d.id === first.body.id);
    expect(row).toMatchObject({ home_repo: null, prd: null, product_id: w.mobile, product_seq: 1, birthplace: 'server', title: 'Offline photo upload' });
  });

  it('pushes a new version to PRD <key>-<n> by its number, and hands it to the void teller', async () => {
    const w = world();
    const made = await w.push(NEW);
    const again = await w.push({ productKey: 'mobile', prd: 1, title: 'Offline photo upload', artifacts: [{ kind: 'spec', content: SPEC }, { kind: 'plan', content: PLAN }] });
    expect(again).toEqual({
      status: 200,
      body: { id: made.body.id, prdId: 'mobile-1', url: made.body.url, added: [{ kind: 'plan', version: 1 }], unchanged: ['spec'], product: 'Mobile' },
    });
    expect(w.tells).toEqual([made.body.id, made.body.id]);
  });

  it('sends the repository it runs from, to choose between two workspaces holding the key', async () => {
    const w = world();
    expect((await w.push({ ...NEW, repo: 'acme/vertuo-mobile' })).body.prdId).toBe('mobile-1');
  });

  it('refuses 404 a key no product of the caller\'s workspaces has, and a number it has not reached', async () => {
    const w = world();
    expect(await w.push({ ...NEW, productKey: 'field-app' })).toEqual({ status: 404, body: { error: 'No product keyed field-app in your workspaces.' } });
    expect((await w.push(NEW, 'carl-token')).status).toBe(404);
    expect(await w.push({ productKey: 'mobile', prd: 3, title: 'x', artifacts: [] })).toEqual({ status: 404, body: { error: 'No PRD mobile-3 on Mobile.' } });
  });

  it('refuses 400 a key out of shape, new and a number together or neither, a draft, a kind, a product name, and writes nothing', async () => {
    const w = world();
    const refusals = [
      { ...NEW, productKey: 'Mobile' }, { ...NEW, productKey: 'mobile-1' }, { ...NEW, productKey: 7 }, { ...NEW, productKey: '' },
      { ...NEW, prd: 1 }, { productKey: 'mobile', title: 'x', artifacts: [] }, { ...NEW, new: 'yes' },
      { ...NEW, draftId: '00000000-0000-4000-8000-000000000001' }, { ...NEW, kind: 'bug' }, { ...NEW, product: 'Mobile' },
      { ...NEW, repo: 'not a repo' }, { ...NEW, title: '' }, { ...NEW, artifacts: [{ kind: 'bug-record', content: 'x' }] },
    ];
    for (const body of refusals) {
      const { status, body: answer } = await w.push(body);
      expect([status, typeof answer.error]).toEqual([400, 'string']);
    }
    expect(w.fake.tables.dossiers).toEqual([]);
  });
});

describe('GET /api/dossiers?product=<key>&prd=<n>: a product PRD by its id', () => {
  it('answers its dossier, link, id, title and product', async () => {
    const w = world();
    const made = await w.push(NEW);
    expect(await w.find('?product=mobile&prd=1')).toEqual({
      status: 200,
      body: { id: made.body.id, url: made.body.url, prdId: 'mobile-1', title: 'Offline photo upload', product: 'Mobile' },
    });
  });

  it('answers 404 for a PRD there is none of, or the caller cannot read, and 400 a key or number out of shape', async () => {
    const w = world();
    await w.push(NEW);
    expect(await w.find('?product=mobile&prd=2')).toEqual({ status: 404, body: { error: 'No PRD mobile-2.' } });
    expect((await w.find('?product=mobile&prd=1', 'carl-token')).status).toBe(404);
    for (const query of ['?product=Mobile&prd=1', '?product=mobile&prd=0', '?product=mobile&prd=x', '?product=mobile', '?product=&prd=1']) {
      expect((await w.find(query)).status).toBe(400);
    }
  });

  it('a lookup by repository and number answers exactly as before, with no product PRD field', async () => {
    const w = world();
    const pushed = await w.push({ repo: 'acme/vertuo-mobile', prd: 7, title: 'Seven', artifacts: [] });
    expect(await w.find('?repo=acme/vertuo-mobile&prd=7')).toEqual({ status: 200, body: { id: pushed.body.id, url: pushed.body.url, product: 'Mobile' } });
  });
});

describe('GET /api/dossiers/get?product=<key>&prd=<n>&kind=<kind>: a product PRD\'s latest version, whole', () => {
  it('answers the latest version of the kind, its number, its hash and when it was pushed', async () => {
    const w = world();
    const made = await w.push(NEW);
    w.clock.now += 60_000;
    await w.push({ productKey: 'mobile', prd: 1, title: 'Offline photo upload', artifacts: [{ kind: 'spec', content: `${SPEC}\nMore.\n` }] });
    const { status, body } = await w.get('?product=mobile&prd=1&kind=spec');
    const latest = w.fake.tables.dossier_versions.filter((v) => v.dossier_id === made.body.id).at(-1);
    expect(status).toBe(200);
    expect(body).toEqual({
      id: made.body.id, prdId: 'mobile-1', url: made.body.url, kind: 'spec', version: 2,
      sha256: w.fake.sha256(`${SPEC}\nMore.\n`), content: `${SPEC}\nMore.\n`, createdAt: latest?.created_at,
    });
  });

  it('answers 404 for a kind the PRD has no version of, or a PRD there is none of', async () => {
    const w = world();
    await w.push(NEW);
    expect(await w.get('?product=mobile&prd=1&kind=plan')).toEqual({ status: 404, body: { error: 'PRD mobile-1 has no plan yet.' } });
    expect((await w.get('?product=mobile&prd=9&kind=spec')).status).toBe(404);
  });

  it('refuses 400 a kind a PRD does not take, or none', async () => {
    const w = world();
    for (const query of ['?product=mobile&prd=1&kind=bug-record', '?product=mobile&prd=1&kind=variations', '?product=mobile&prd=1']) {
      expect((await w.get(query)).status).toBe(400);
    }
  });

  it('/api/dossiers/get serves GET through getDossier, within maxDuration 60', () => {
    const source = readFileSync(fileURLToPath(new URL('../../app/api/dossiers/get/route.ts', import.meta.url)), 'utf8');
    expect(source).toMatch(/^export const maxDuration = 60;$/m);
    expect(source).toMatch(/export function GET\b/);
    expect(source).toContain('getDossier(');
    expect(source).toContain('dossierDeps()');
  });
});
