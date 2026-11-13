import { validPersonaAvatar } from '@omni/design';
import { describe, expect, it } from 'vitest';
import type { StoredPersona } from '../business/personas';
import { postKnowledgeChange, type KnowledgeChangesDeps } from './knowledge-api.controller';
import type { FoundProduct, KnowledgeApiRepository, PersonaArgs, Stored } from './knowledge-api.repository';
import { knowledgeApiService } from './knowledge-api.service';

// A terminal's persona change (PRD 2779 s4): POST /api/knowledge/changes of kind `persona`, through the
// controller and the service over a fake repository that keeps the personas as persona_add(),
// persona_edit() and persona_find() do (supabase/migrations/*_open_personas.sql). No test calls Supabase.
// Every name is fictional.

const ORIGIN = 'https://omni.example';
const WS = '00000000-0000-4000-8000-000000000001';
const MOBILE = '00000000-0000-4000-8000-0000000000e1';
const ESTIMATES = '00000000-0000-4000-8000-0000000000e2';
const AVATAR = { v: 1 as const, skin: 1, hair: 2, hairColor: 3, outfit: 1, accessory: 0 };

const stored = (id: string, product: string, name: string, over: Partial<StoredPersona> = {}): StoredPersona => ({
  id, product_id: product, ordinal: 1, name, stance: 'skeptical', trade: 'builder', avatar: AVATAR, who: 'Runs a crew.', usage: 'Every morning.', ...over,
});

function world() {
  const products: Record<string, FoundProduct> = {
    [MOBILE]: { id: MOBILE, workspace: WS, name: 'Mobile' },
    [ESTIMATES]: { id: ESTIMATES, workspace: WS, name: 'Estimates' },
  };
  const repositories: Record<string, string[]> = { 'kp-org/solo': [MOBILE], 'kp-org/api': [MOBILE, ESTIMATES] };
  const personas: StoredPersona[] = [
    stored('p-sam', MOBILE, 'Sam'),
    stored('p-twin-1', MOBILE, 'Twin'),
    stored('p-twin-2', MOBILE, 'Twin'),
  ];
  const calls: string[] = [];
  const NOT_MEMBER = { ok: false, code: '42501', message: 'Only a member of the workspace can change its personas.' } as const;
  const check = (f: PersonaArgs): Stored<never> | null =>
    ['enthusiastic', 'excited', 'neutral', 'skeptical'].includes(f.stance)
      ? null
      : { ok: false, code: '22023', message: 'Stance: enthusiastic, neutral or skeptical.' };

  const api = (member: boolean): KnowledgeApiRepository => ({
    productFor: (repo, named) => {
      const listed = (repositories[repo] ?? []).map((id) => products[id]).filter((p) => p !== undefined);
      if (named) {
        const picked = listed.find((p) => p.name === named);
        return Promise.resolve(picked ? { ok: true, value: picked } : { ok: false, code: 'P0002', message: `Product: ${named} is not one of ${repo}'s products.` });
      }
      if (listed.length > 1) return Promise.resolve({ ok: false, code: '21000', message: `${repo} is in 2 products: Mobile, Estimates; pass --product to name one.` });
      return Promise.resolve(listed[0] ? { ok: true, value: listed[0] } : { ok: false, code: 'P0002', message: 'no product' });
    },
    constituent: () => Promise.resolve({ ok: true, value: null }),
    addConstituent: () => Promise.resolve(NOT_MEMBER),
    editConstituent: () => Promise.resolve(NOT_MEMBER),
    findPersona: (_w, product, name) => {
      calls.push(`find ${name}`);
      if (!member) return Promise.resolve(NOT_MEMBER);
      const found = personas.filter((p) => p.product_id === product && p.name === name);
      const [first] = found;
      if (!first) return Promise.resolve({ ok: false, code: 'P0002', message: `no persona named "${name}" in Mobile` });
      if (found.length > 1) return Promise.resolve({ ok: false, code: 'P0003', message: `several personas are named "${name}": edit it on the Knowledge tab` });
      return Promise.resolve({ ok: true, value: first });
    },
    addPersona: (_w, product, f) => {
      calls.push(`add ${JSON.stringify(f)}`);
      if (!member) return Promise.resolve(NOT_MEMBER);
      const bad = check(f);
      if (bad) return Promise.resolve(bad);
      const row = stored(`p-new-${String(personas.length)}`, product, f.name, { stance: f.stance, trade: f.trade, avatar: f.avatar as StoredPersona['avatar'], who: f.who, usage: f.usage });
      personas.push(row);
      return Promise.resolve({ ok: true, value: row });
    },
    editPersona: (_w, id, f) => {
      calls.push(`edit ${id} ${JSON.stringify(f)}`);
      const bad = check(f);
      if (bad) return Promise.resolve(bad);
      const row = stored(id, MOBILE, f.name, { stance: f.stance, trade: f.trade, avatar: f.avatar as StoredPersona['avatar'], who: f.who, usage: f.usage });
      personas[personas.findIndex((p) => p.id === id)] = row;
      return Promise.resolve({ ok: true, value: row });
    },
  });

  let seeds = 0;
  const deps = ({ member = true, database = true }: { member?: boolean; database?: boolean } = {}): KnowledgeChangesDeps => ({
    connect: database
      ? () => ({
        auth: { getUser: (jwt: string) => Promise.resolve(jwt === 'token-mo' ? { data: { user: { id: 'u-mo', email: null } }, error: null } : { data: { user: null }, error: { status: 401 } }) },
        service: knowledgeApiService(
          api(member),
          { tab: () => Promise.resolve(null), change: () => Promise.resolve({ ok: false, kind: 'database', error: 'unused' }) },
          () => `seed-${String(seeds++)}`,
        ),
      })
      : null,
    log: () => undefined,
  });
  return { deps, personas, calls };
}

const post = (body: unknown, token: string | null = 'token-mo') =>
  new Request(`${ORIGIN}/api/knowledge/changes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token === null ? {} : { authorization: `Bearer ${token}` }) },
    body: JSON.stringify(body),
  });

async function answer(response: Response) {
  return { status: response.status, body: (await response.json()) as unknown };
}

const FIELDS = { name: 'Ada', stance: 'skeptical', trade: 'data analyst', who: 'Reads the numbers.', usage: 'Weekly.' };
const add = { repo: 'kp-org/solo', kind: 'persona', action: 'add', fields: FIELDS };
const page = (id: string) => `${ORIGIN}/app/products/${MOBILE}/knowledge/personas/${id}`;

describe('POST /api/knowledge/changes: personas (PRD 2779)', () => {
  it('adds a persona with a random portrait for the trade: applied, its name and its page', async () => {
    const { deps, personas, calls } = world();
    expect(await answer(await postKnowledgeChange(post(add), deps()))).toEqual({
      status: 200, body: { done: 'applied', id: 'Ada', url: page('p-new-3'), waitsFor: null },
    });
    const added = personas.at(-1);
    expect(added).toMatchObject({ name: 'Ada', trade: 'data analyst' });
    expect(validPersonaAvatar(added?.avatar)).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('gives each new persona its own seed, and every portrait is one the presets draw', async () => {
    const { deps, calls } = world();
    await postKnowledgeChange(post(add), deps());
    await postKnowledgeChange(post(add), deps());
    const avatars = calls.map((c) => (JSON.parse(c.slice('add '.length)) as PersonaArgs).avatar);
    expect(avatars).toHaveLength(2);
    expect(avatars.every((a) => validPersonaAvatar(a))).toBe(true);
  });

  it('edits only the fields sent and keeps the portrait, finding the persona by its name', async () => {
    const { deps, calls } = world();
    const edit = { repo: 'kp-org/solo', kind: 'persona', action: 'edit', entry: 'Sam', fields: { trade: 'journalist', stance: 'excited' } };
    expect(await answer(await postKnowledgeChange(post(edit), deps()))).toEqual({
      status: 200, body: { done: 'applied', id: 'Sam', url: page('p-sam'), waitsFor: null },
    });
    expect(calls[1]).toBe(`edit p-sam ${JSON.stringify({ name: 'Sam', stance: 'excited', trade: 'journalist', avatar: AVATAR, who: 'Runs a crew.', usage: 'Every morning.' })}`);
  });

  it('a rename answers the new name', async () => {
    const { deps } = world();
    const edit = { repo: 'kp-org/solo', kind: 'persona', action: 'edit', entry: 'Sam', fields: { name: 'Samira' } };
    expect((await answer(await postKnowledgeChange(post(edit), deps()))).body).toMatchObject({ id: 'Samira' });
  });

  it('404 names the persona and the product when none has the name', async () => {
    const { deps } = world();
    const edit = { repo: 'kp-org/solo', kind: 'persona', action: 'edit', entry: 'Zed', fields: { who: 'x' } };
    expect(await answer(await postKnowledgeChange(post(edit), deps()))).toEqual({ status: 404, body: { error: 'no persona named "Zed" in Mobile' } });
  });

  it('409 when two personas share the name, and when several products are in the repository and none is named', async () => {
    const { deps } = world();
    const twin = { repo: 'kp-org/solo', kind: 'persona', action: 'edit', entry: 'Twin', fields: { who: 'x' } };
    expect(await answer(await postKnowledgeChange(post(twin), deps()))).toEqual({
      status: 409, body: { error: 'several personas are named "Twin": edit it on the Knowledge tab' },
    });
    expect((await answer(await postKnowledgeChange(post({ ...add, repo: 'kp-org/api' }), deps()))).status).toBe(409);
    expect((await answer(await postKnowledgeChange(post({ ...add, repo: 'kp-org/api', product: 'Mobile' }), deps()))).status).toBe(200);
  });

  it('422 with the database\'s words for a value it refuses', async () => {
    const { deps } = world();
    const bad = { ...add, fields: { ...FIELDS, stance: 'angry' } };
    expect(await answer(await postKnowledgeChange(post(bad), deps()))).toEqual({ status: 422, body: { error: 'Stance: enthusiastic, neutral or skeptical.' } });
  });

  it('403 for a caller who is not a member of the workspace', async () => {
    const { deps } = world();
    expect((await answer(await postKnowledgeChange(post(add), deps({ member: false })))).status).toBe(403);
  });

  it('401 signed out, and nothing is written', async () => {
    const { deps, calls } = world();
    expect((await answer(await postKnowledgeChange(post(add, null), deps()))).status).toBe(401);
    expect((await answer(await postKnowledgeChange(post(add, 'token-bad'), deps()))).status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('400 for an edit that names no field, an add missing one, and a field it does not know', async () => {
    const { deps, calls } = world();
    const none = { repo: 'kp-org/solo', kind: 'persona', action: 'edit', entry: 'Sam', fields: {} };
    const short = { ...add, fields: { name: 'Ada' } };
    const extra = { ...add, fields: { ...FIELDS, avatar: AVATAR } };
    for (const body of [none, short, extra]) expect((await answer(await postKnowledgeChange(post(body), deps()))).status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('503 without a database', async () => {
    const { deps } = world();
    expect((await answer(await postKnowledgeChange(post(add), deps({ database: false })))).status).toBe(503);
  });
});
