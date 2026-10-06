import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { findDossier, MAX_OPEN_BYTES, MAX_PUSH_BYTES, openDossier, pushDossier, type DossierDeps } from './api';
import { ARTIFACT_MAX_BYTES } from './store';
import { FAKE_WORKSPACE, fakeSupabase } from './store.fake';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

vi.mock('server-only', () => ({}));

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@vertuoza.com' };
const BOB = { id: '00000000-0000-4000-8000-0000000000b1', email: 'bob@vertuoza.com' };
const EVE = { id: '00000000-0000-4000-8000-0000000000e1', email: 'eve@example.com' };
// Ada and Bob belong to one workspace (the fake's default), which owns the GitHub organisation acme.
// Carl belongs to another; Nell to none.
const OTHER = '00000000-0000-4000-8000-00000000aced';
const CARL = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@vertuoza.com', workspaces: [OTHER] };
const NELL = { id: '00000000-0000-4000-8000-0000000000f1', email: 'nell@vertuoza.com', workspaces: [] };
// Dana belongs to both workspaces.
const DANA = { id: '00000000-0000-4000-8000-0000000000d1', email: 'dana@vertuoza.com', workspaces: [OTHER, FAKE_WORKSPACE] };
const START = Date.parse('2026-09-28T09:00:00Z');
const MISSING = '00000000-0000-4000-8000-00000000ffff';
const INSTALL = 'https://github.com/apps/omni-loop-invader/installations/new';

const SPEC = '---\nprd: 7\ntitle: Team inbox\n---\n\n# Team inbox\n';
const PLAN = '# Plan: team inbox\n';
const PAGE = '<!doctype html>\n<title>Before and after</title>\n';

// What an answer of the API carries, checked as it is read; any other field is kept for the whole-body checks.
const Answer = z.looseObject({
  error: z.string().optional(),
  id: z.string().optional(),
  url: z.string().optional(),
  added: z.array(z.unknown()).optional(),
  unchanged: z.array(z.unknown()).optional(),
});
// Any text, as a field of an expected body.
const A_STRING: unknown = expect.any(String);

type Call = { token?: string | null; body?: unknown; raw?: string; headers?: Record<string, string> };

function world({ database = true } = {}) {
  const clock = { now: START };
  const fake = fakeSupabase(
    { 'ada-token': ADA, 'bob-token': BOB, 'eve-token': EVE, 'carl-token': CARL, 'nell-token': NELL, 'dana-token': DANA },
    { [FAKE_WORKSPACE]: 'acme', [OTHER]: 'other-org' },
    () => clock.now,
  );
  // The stub answers only the calls the store makes, so it is not a whole Supabase client.
  const deps: DossierDeps = { connect: database ? fake.client as unknown as DossierDeps['connect'] : null, installLink: INSTALL };
  const request = (path: string, { token = 'ada-token', body, raw, headers = {} }: Call = {}) =>
    new Request(`https://omni.example${path}`, {
      method: 'POST',
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json', ...headers },
      body: raw ?? (body === undefined ? null : JSON.stringify(body)),
    });
  const read = async (response: Response) => ({ status: response.status, body: Answer.parse(await response.json()) });
  const open = async (body: unknown, call: Call = {}) => read(await openDossier(request('/api/dossiers', { body, ...call }), deps));
  const push = async (body: unknown, call: Call = {}) => read(await pushDossier(request('/api/dossiers/push', { body, ...call }), deps));
  const find = async (query: string, { token = 'ada-token', headers = {} }: Call = {}) =>
    read(await findDossier(new Request(`https://omni.example/api/dossiers${query}`, {
      method: 'GET', headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    }), deps));
  const dossier = (id: string | undefined) => fake.tables.dossiers.find((d) => d.id === id);
  const versions = (id: string | undefined) => fake.tables.dossier_versions.filter((v) => v.dossier_id === id);
  return { clock, fake, deps, request, read, open, push, find, dossier, versions };
}

const PUSH = {
  repo: 'acme/widgets', prd: 7, title: 'Team inbox',
  artifacts: [{ kind: 'spec', content: SPEC }, { kind: 'plan', content: PLAN }, { kind: 'before-after', content: PAGE }],
};

// Every call of the dossier contract, for the checks both share.
const CALLS = [
  { name: 'POST /api/dossiers', call: (w: ReturnType<typeof world>, c: Call) => w.open({ title: 'An idea', repo: 'acme/widgets' }, c) },
  { name: 'POST /api/dossiers/push', call: (w: ReturnType<typeof world>, c: Call) => w.push(PUSH, c) },
];

describe('every dossier call checks the bearer token, and leaves membership to the database', () => {
  for (const { name, call } of CALLS) {
    it(`${name}: 401 without a token, with another scheme, or with a token the Auth server refuses`, async () => {
      const w = world();
      for (const c of [{ token: null }, { token: null, headers: { authorization: 'Basic YWRhOnB3' } }, { token: 'forged-token' }]) {
        const { status, body } = await call(w, c);
        expect(status).toBe(401);
        expect(body.error).toEqual(A_STRING);
      }
      expect(w.fake.tables.dossiers).toEqual([]);
    });

    it(`${name}: lets a member through whatever their address, and refuses one in no workspace with 403`, async () => {
      const w = world();
      const eve = await call(w, { token: 'eve-token' });
      expect(eve.status).toBeLessThan(300);
      const nell = await call(w, { token: 'nell-token' });
      expect(nell.status).toBe(403);
      expect(nell.body.error).toEqual(A_STRING);
      expect(nell.body.error).not.toMatch(/vertuoza\.com/);
    });

    it(`${name}: 403 with the database's reason, and the App's install link after its install hint (PRD 459)`, async () => {
      const w = world();
      w.fake.state.fail = { code: '42501', message: 'you are not a member of Globex, which owns globex/web' };
      expect(await call(w, {})).toEqual({ status: 403, body: { error: 'you are not a member of Globex, which owns globex/web' } });
      w.fake.state.fail = { code: '42501', message: 'no workspace owns acme/widgets yet — install the Omni App' };
      expect(await call(w, {})).toEqual({ status: 403, body: { error: `no workspace owns acme/widgets yet — install the Omni App: ${INSTALL}` } });
      w.fake.state.fail = null;
      expect(w.fake.tables.dossiers).toEqual([]);
    });

    it(`${name}: 503 when no database is configured`, async () => {
      expect((await call(world({ database: false }), {})).status).toBe(503);
    });

    it(`${name}: 500, not a guess, when the database fails`, async () => {
      const w = world();
      w.fake.state.fail = { message: 'connection reset' };
      const { status, body } = await call(w, {});
      expect(status).toBe(500);
      expect(body.error).toEqual(A_STRING);
    });

    it(`${name}: 400 for a body that is not a JSON object`, async () => {
      const w = world();
      for (const raw of ['not json', '[1, 2]', '"text"', '']) {
        expect((await call(w, { raw })).status, raw).toBe(400);
      }
    });
  }
});

describe('POST /api/dossiers: a draft opens', () => {
  it('opens a draft in the workspace that owns the repository, and answers 201 with its link', async () => {
    const w = world();
    const { status, body } = await w.open({ title: '  A team inbox for every question ', repo: 'Acme/Widgets', claudeSessionId: 'sess-a' });

    expect(status).toBe(201);
    expect(body).toEqual({ id: A_STRING, url: `https://omni.example/prd/${body.id}` });
    expect(w.dossier(body.id)).toMatchObject({
      workspace_id: FAKE_WORKSPACE, home_repo: 'acme/widgets', prd: null, title: 'A team inbox for every question',
      opened_by: ADA.id, claude_session_id: 'sess-a', numbered_at: null,
    });
  });

  it('opens one with no Claude session id when none is sent, or null', async () => {
    const w = world();
    const first = await w.open({ title: 'An idea', repo: 'acme/widgets' });
    const second = await w.open({ title: 'An idea', repo: 'acme/widgets', claudeSessionId: null });
    expect(w.dossier(first.body.id)?.claude_session_id).toBeNull();
    expect(w.dossier(second.body.id)?.claude_session_id).toBeNull();
  });

  it('uses the link the caller reached, behind the proxy too', async () => {
    const w = world();
    const { body } = await w.open({ title: 'An idea', repo: 'acme/widgets' }, { headers: { 'x-forwarded-host': 'omni.vertuoza.dev', 'x-forwarded-proto': 'https' } });
    expect(body.url).toBe(`https://omni.vertuoza.dev/prd/${body.id}`);
  });

  it('refuses 400 a title missing, blank or too long, a repository that is not owner/name, a session id that is not text', async () => {
    const w = world();
    for (const bad of [
      { repo: 'acme/widgets' },
      { title: '   ', repo: 'acme/widgets' },
      { title: 't'.repeat(201), repo: 'acme/widgets' },
      { title: 42, repo: 'acme/widgets' },
      { title: 'An idea' },
      { title: 'An idea', repo: 'widgets' },
      { title: 'An idea', repo: 'acme/widgets/extra' },
      { title: 'An idea', repo: 'acme/widgets', claudeSessionId: 7 },
      { title: 'An idea', repo: 'acme/widgets', claudeSessionId: '' },
      { title: 'An idea', repo: 'acme/widgets', claudeSessionId: 's'.repeat(201) },
    ]) {
      const { status, body } = await w.open(bad);
      expect(status, JSON.stringify(bad)).toBe(400);
      expect(body.error).toEqual(A_STRING);
    }
    expect(w.fake.tables.dossiers).toEqual([]);
  });

  it('refuses 413 a body over its cap', async () => {
    const w = world();
    const raw = JSON.stringify({ title: 'An idea', repo: 'acme/widgets', padding: 'x'.repeat(MAX_OPEN_BYTES) });
    expect((await w.open(undefined, { raw })).status).toBe(413);
    expect((await w.open({ title: 'An idea', repo: 'acme/widgets' }, { headers: { 'content-length': String(MAX_OPEN_BYTES + 1) } })).status).toBe(413);
  });
});

describe('POST /api/dossiers/push: a push lands versions', () => {
  it('with no draft, creates the dossier keyed by repository and PRD, numbered, and adds v1 of each kind', async () => {
    const w = world();
    const { status, body } = await w.push(PUSH);

    expect(status).toBe(200);
    expect(body).toEqual({
      id: A_STRING, url: `https://omni.example/prd/${body.id}`,
      added: [{ kind: 'spec', version: 1 }, { kind: 'plan', version: 1 }, { kind: 'before-after', version: 1 }],
      unchanged: [],
    });
    expect(w.dossier(body.id)).toMatchObject({ home_repo: 'acme/widgets', prd: 7, title: 'Team inbox', opened_by: ADA.id, numbered_at: A_STRING });
    expect(w.versions(body.id).map(({ kind, source, uploaded_by }) => ({ kind, source, uploaded_by }))).toEqual([
      { kind: 'spec', source: 'kit', uploaded_by: ADA.id },
      { kind: 'plan', source: 'kit', uploaded_by: ADA.id },
      { kind: 'before-after', source: 'kit', uploaded_by: ADA.id },
    ]);
  });

  it('with a draft, numbers it, takes the spec\'s title, and keeps its Claude session id and opener', async () => {
    const w = world();
    const draft = (await w.open({ title: 'A team inbox for every question', repo: 'acme/widgets', claudeSessionId: 'sess-a' })).body;

    const { status, body } = await w.push({ ...PUSH, draftId: draft.id });

    expect(status).toBe(200);
    expect(body).toMatchObject({ id: draft.id, url: draft.url });
    expect(w.dossier(draft.id)).toMatchObject({ prd: 7, title: 'Team inbox', claude_session_id: 'sess-a', opened_by: ADA.id, numbered_at: A_STRING });
    expect(w.fake.tables.dossiers).toHaveLength(1);
  });

  it('a member of the workspace pushes the next version of a dossier another member numbered', async () => {
    const w = world();
    const first = (await w.push(PUSH)).body;
    const { body } = await w.push({ ...PUSH, artifacts: [{ kind: 'spec', content: `${SPEC}\nMore.\n` }] }, { token: 'bob-token' });
    expect(body).toMatchObject({ id: first.id, added: [{ kind: 'spec', version: 2 }], unchanged: [] });
    expect(w.versions(first.id).at(-1)).toMatchObject({ uploaded_by: BOB.id });
  });

  it('adds a version only when the content differs from the latest of its kind, and answers every kind it received', async () => {
    const w = world();
    const { id } = (await w.push(PUSH)).body;

    const same = (await w.push(PUSH)).body;
    expect(same).toMatchObject({ id, added: [], unchanged: ['spec', 'plan', 'before-after'] });

    const changed = (await w.push({ ...PUSH, artifacts: [{ kind: 'plan', content: `${PLAN}| s1 |\n` }, { kind: 'spec', content: SPEC }] })).body;
    expect(changed).toMatchObject({ added: [{ kind: 'plan', version: 2 }], unchanged: ['spec'] });

    // Back to an earlier state: still a new version.
    const back = (await w.push({ ...PUSH, artifacts: [{ kind: 'plan', content: PLAN }] })).body;
    expect(back).toMatchObject({ added: [{ kind: 'plan', version: 3 }], unchanged: [] });
    expect(w.versions(id)).toHaveLength(5);
  });

  it('computes the hash from the content, never taking one from the request', async () => {
    const w = world();
    const forged = 'f'.repeat(64);
    const { id } = (await w.push({ ...PUSH, artifacts: [{ kind: 'spec', content: SPEC, sha256: forged }] })).body;
    expect(w.versions(id)[0]).toMatchObject({ sha256: w.fake.sha256(SPEC), bytes: Buffer.byteLength(SPEC) });
    expect(w.versions(id)[0]).not.toHaveProperty('sha256', forged);
    // The same content under another claimed hash is unchanged; other content under the old hash is not.
    expect((await w.push({ ...PUSH, artifacts: [{ kind: 'spec', content: SPEC, sha256: 'e'.repeat(64) }] })).body.unchanged).toEqual(['spec']);
    expect((await w.push({ ...PUSH, artifacts: [{ kind: 'spec', content: 'other', sha256: w.fake.sha256(SPEC) }] })).body.added).toEqual([{ kind: 'spec', version: 2 }]);
  });

  it('merges a draft numbered to a dossier the fallback already created: versions, Claude session and opener move over, the draft goes', async () => {
    const w = world();
    const created = w.fake.seedFromGithub({ repo: 'acme/widgets', prd: parsePrd(7), title: 'team-inbox', versions: [{ kind: 'spec', content: SPEC }] });
    w.clock.now += 60_000;
    const draft = (await w.open({ title: 'A team inbox', repo: 'acme/widgets', claudeSessionId: 'sess-a' })).body;

    const { status, body } = await w.push({ ...PUSH, draftId: draft.id });

    expect(status).toBe(200);
    expect(body).toMatchObject({
      id: created.id, url: `https://omni.example/prd/${created.id}`,
      added: [{ kind: 'plan', version: 1 }, { kind: 'before-after', version: 1 }], unchanged: ['spec'],
    });
    expect(w.dossier(draft.id)).toBeUndefined();
    expect(w.dossier(created.id)).toMatchObject({ prd: 7, title: 'Team inbox', claude_session_id: 'sess-a', opened_by: ADA.id });
    expect(w.versions(created.id).map((v) => v.source)).toEqual(['github', 'kit', 'kit']);
    expect(w.fake.tables.dossiers).toHaveLength(1);
  });

  it('pushing a draft already numbered for this PRD reaches the same dossier', async () => {
    const w = world();
    const draft = (await w.open({ title: 'A team inbox', repo: 'acme/widgets' })).body;
    await w.push({ ...PUSH, draftId: draft.id });
    const again = await w.push({ ...PUSH, draftId: draft.id });
    expect(again).toMatchObject({ status: 200, body: { id: draft.id, unchanged: ['spec', 'plan', 'before-after'] } });
  });

  it('keeps each workspace\'s dossiers apart: the same repository and PRD in another workspace is another dossier', async () => {
    const w = world();
    const ours = (await w.push(PUSH)).body;
    const theirs = (await w.push(PUSH, { token: 'carl-token' })).body;
    expect(theirs.id).not.toBe(ours.id);
    expect(w.dossier(theirs.id)).toMatchObject({ workspace_id: OTHER, prd: 7 });
  });

  it('refuses 404 a draft that does not exist, or that the caller cannot read', async () => {
    const w = world();
    const carls = (await w.open({ title: 'Carl\'s idea', repo: 'acme/widgets' }, { token: 'carl-token' })).body;
    for (const draftId of [MISSING, carls.id]) {
      const { status, body } = await w.push({ ...PUSH, draftId });
      expect(status, draftId).toBe(404);
      expect(body.error).toEqual(A_STRING);
    }
    expect(w.dossier(carls.id)).toMatchObject({ prd: null });
    expect(w.fake.tables.dossiers).toHaveLength(1);
  });

  it('refuses 400 a draft of another repository, or one already another PRD', async () => {
    const w = world();
    const elsewhere = (await w.open({ title: 'An idea', repo: 'acme/gadgets' })).body;
    expect((await w.push({ ...PUSH, draftId: elsewhere.id })).status).toBe(400);
    const numbered = (await w.open({ title: 'Another', repo: 'acme/widgets' })).body;
    await w.push({ ...PUSH, prd: 5, draftId: numbered.id });
    const { status, body } = await w.push({ ...PUSH, draftId: numbered.id });
    expect(status).toBe(400);
    expect(body.error).toMatch(/#5/);
    expect(w.dossier(numbered.id)).toMatchObject({ prd: 5 });
  });

  it('refuses 400 a malformed push, and writes nothing', async () => {
    const w = world();
    for (const bad of [
      { ...PUSH, repo: 'widgets' },
      { ...PUSH, repo: undefined },
      { ...PUSH, prd: 0 },
      { ...PUSH, prd: 7.5 },
      { ...PUSH, prd: '7' },
      { ...PUSH, prd: 2 ** 31 },
      { ...PUSH, title: '' },
      { ...PUSH, title: 't'.repeat(201) },
      { ...PUSH, draftId: 'not-a-uuid' },
      { ...PUSH, draftId: 42 },
      { ...PUSH, artifacts: undefined },
      { ...PUSH, artifacts: 'spec' },
      { ...PUSH, artifacts: [{ kind: 'retro', content: 'x' }] },
      { ...PUSH, artifacts: [{ kind: 'spec' }] },
      { ...PUSH, artifacts: [{ kind: 'spec', content: 42 }] },
      { ...PUSH, artifacts: ['spec'] },
      { ...PUSH, artifacts: [{ kind: 'spec', content: 'a' }, { kind: 'spec', content: 'b' }] },
    ]) {
      const { status, body } = await w.push(bad);
      expect(status, JSON.stringify(bad).slice(0, 120)).toBe(400);
      expect(body.error).toEqual(A_STRING);
    }
    expect(w.fake.tables.dossiers).toEqual([]);
  });

  it('takes a push with no artifacts: it numbers the draft and adds nothing', async () => {
    const w = world();
    const draft = (await w.open({ title: 'An idea', repo: 'acme/widgets' })).body;
    const { status, body } = await w.push({ ...PUSH, draftId: draft.id, artifacts: [] });
    expect(status).toBe(200);
    expect(body).toMatchObject({ id: draft.id, added: [], unchanged: [] });
    expect(w.dossier(draft.id)?.prd).toBe(7);
  });

  it('refuses 413 a body over 2 MiB, and an artifact over 512 KiB, and takes one of exactly 512 KiB', async () => {
    const w = world();
    expect(MAX_PUSH_BYTES).toBe(2 * 1024 * 1024);
    expect(ARTIFACT_MAX_BYTES).toBe(512 * 1024);
    const raw = JSON.stringify({ ...PUSH, padding: 'x'.repeat(MAX_PUSH_BYTES) });
    expect((await w.push(undefined, { raw })).status).toBe(413);
    expect((await w.push(PUSH, { headers: { 'content-length': String(MAX_PUSH_BYTES + 1) } })).status).toBe(413);

    // 512 KiB and one byte, counted in bytes: "é" is two.
    const over = `${'x'.repeat(ARTIFACT_MAX_BYTES - 1)}é`;
    const { status, body } = await w.push({ ...PUSH, artifacts: [{ kind: 'plan', content: PLAN }, { kind: 'before-after', content: over }] });
    expect(status).toBe(413);
    expect(body.error).toMatch(/before-after/);
    expect(w.fake.tables.dossiers).toEqual([]);

    const exact = 'x'.repeat(ARTIFACT_MAX_BYTES);
    expect((await w.push({ ...PUSH, artifacts: [{ kind: 'before-after', content: exact }] })).status).toBe(200);
  });
});

describe('GET /api/dossiers: a PRD\'s link by its number', () => {
  it('answers 200 {id, url} for a dossier the caller can read, with the link the caller reached', async () => {
    const w = world();
    const made = w.fake.seedFromGithub({ repo: 'acme/widgets', prd: parsePrd(7), title: 'Team inbox' });
    const { status, body } = await w.find('?repo=acme/widgets&prd=7', { headers: { 'x-forwarded-host': 'omni.vertuoza.dev', 'x-forwarded-proto': 'https' } });
    expect(status).toBe(200);
    expect(body).toEqual({ id: made.id, url: `https://omni.vertuoza.dev/prd/${made.id}` });
  });

  it('compares the repository lower-cased', async () => {
    const w = world();
    const made = w.fake.seedFromGithub({ repo: 'acme/widgets', prd: parsePrd(7), title: 'Team inbox' });
    const { status, body } = await w.find('?repo=Acme/Widgets&prd=7');
    expect(status).toBe(200);
    expect(body.id).toBe(made.id);
  });

  it('answers 404 when there is none: no such number, a draft, another repository, or another workspace\'s', async () => {
    const w = world();
    w.fake.seedFromGithub({ repo: 'acme/widgets', prd: parsePrd(7), title: 'Team inbox' });
    await w.open({ title: 'A draft', repo: 'acme/widgets' });
    const cases: Array<[string, string]> = [['?repo=acme/widgets&prd=8', 'ada-token'], ['?repo=acme/gadgets&prd=7', 'ada-token'], ['?repo=acme/widgets&prd=7', 'carl-token'], ['?repo=acme/widgets&prd=7', 'nell-token']];
    for (const [query, token] of cases) {
      const { status, body } = await w.find(query, { token });
      expect(status, `${query} ${token}`).toBe(404);
      expect(body.error).toEqual(A_STRING);
    }
  });

  it('answers the most recently numbered one when two of the caller\'s workspaces hold one', async () => {
    const w = world();
    w.fake.seedFromGithub({ workspace: OTHER, repo: 'acme/widgets', prd: parsePrd(7), title: 'Older' });
    w.clock.now += 60_000;
    const newer = w.fake.seedFromGithub({ repo: 'acme/widgets', prd: parsePrd(7), title: 'Newer' });
    expect((await w.find('?repo=acme/widgets&prd=7', { token: 'dana-token' })).body.id).toBe(newer.id);
  });

  it('refuses 400 a repository missing or not owner/name, and a number that is not a PRD\'s', async () => {
    const w = world();
    for (const query of [
      '?prd=7', '?repo=&prd=7', '?repo=widgets&prd=7', '?repo=acme/widgets/extra&prd=7', `?repo=${'a'.repeat(200)}/b&prd=7`,
      '?repo=acme/widgets', '?repo=acme/widgets&prd=', '?repo=acme/widgets&prd=0', '?repo=acme/widgets&prd=-3',
      '?repo=acme/widgets&prd=x', '?repo=acme/widgets&prd=7.5', '?repo=acme/widgets&prd=1e3', `?repo=acme/widgets&prd=${2 ** 31}`,
    ]) {
      const { status, body } = await w.find(query);
      expect(status, query).toBe(400);
      expect(body.error).toEqual(A_STRING);
    }
    expect((await w.find(`?repo=acme/widgets&prd=${2 ** 31 - 1}`)).status).toBe(404);
  });

  it('refuses 401 without a valid token, and 503 without a database', async () => {
    const w = world();
    expect((await w.find('?repo=acme/widgets&prd=7', { token: null })).status).toBe(401);
    expect((await w.find('?repo=acme/widgets&prd=7', { token: 'forged-token' })).status).toBe(401);
    expect((await world({ database: false }).find('?repo=acme/widgets&prd=7')).status).toBe(503);
  });

  it('answers 500, not a guess, when the database fails', async () => {
    const w = world();
    w.fake.state.fail = { message: 'connection reset' };
    expect((await w.find('?repo=acme/widgets&prd=7')).status).toBe(500);
  });

  it('writes nothing', async () => {
    const w = world();
    w.fake.seedFromGithub({ repo: 'acme/widgets', prd: parsePrd(7), title: 'Team inbox' });
    const before = JSON.stringify(w.fake.tables);
    await w.find('?repo=acme/widgets&prd=7');
    await w.find('?repo=acme/widgets&prd=8');
    expect(JSON.stringify(w.fake.tables)).toBe(before);
  });
});

describe('a fix is a dossier with a kind (PRD 627)', () => {
  const VISUAL = {
    repo: 'acme/widgets', prd: 7, kind: 'visual', title: 'Sidebar darker',
    artifacts: [{ kind: 'before-after', content: PAGE }, { kind: 'variations', content: 'round 1' }, { kind: 'variations', content: 'round 2' }],
  };

  it('a push with no kind reaches the PRD, and sends the database no kind at all', async () => {
    const w = world();
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const connect = (token: string) => {
      const client = w.fake.client(token);
      return { ...client, rpc: (name: string, args: Record<string, unknown>) => { calls.push({ name, args }); return client.rpc(name, args); } };
    };
    const response = await pushDossier(w.request('/api/dossiers/push', { body: PUSH }), { connect: connect as unknown as DossierDeps['connect'] });
    const { body } = await w.read(response);
    expect(w.dossier(body.id)).toMatchObject({ kind: 'prd', prd: 7 });
    expect(body.url).toBe(`https://omni.example/prd/${body.id}`);
    expect(calls.find((c) => c.name === 'dossier_push')?.args).not.toHaveProperty('p_kind');
  });

  it('a visual fix numbered as a PRD is a dossier of its own, linked under /visual, its rounds each a version', async () => {
    const w = world();
    const prd = await w.push(PUSH);
    const { status, body } = await w.push(VISUAL);
    expect(status).toBe(200);
    expect(body.id).not.toBe(prd.body.id);
    expect(body).toEqual({
      id: A_STRING, url: `https://omni.example/visual/${body.id}`,
      added: [{ kind: 'before-after', version: 1 }, { kind: 'variations', version: 1 }, { kind: 'variations', version: 2 }],
      unchanged: [],
    });
    expect(w.dossier(body.id)).toMatchObject({ kind: 'visual', prd: 7, title: 'Sidebar darker' });

    // The same rounds again, and a third: only the third is added.
    const again = await w.push({ ...VISUAL, artifacts: [...VISUAL.artifacts, { kind: 'variations', content: 'round 3' }] });
    expect(again.body.added).toEqual([{ kind: 'variations', version: 3 }]);
    expect(again.body.unchanged).toEqual(['before-after', 'variations', 'variations']);
  });

  it('a bug fix takes its record, linked under /bugs', async () => {
    const w = world();
    const { status, body } = await w.push({ repo: 'acme/widgets', prd: 571, kind: 'bug', title: 'Numbers', artifacts: [{ kind: 'bug-record', content: '# Bug 571' }] });
    expect(status).toBe(200);
    expect(body.url).toBe(`https://omni.example/bugs/${body.id}`);
    expect(w.dossier(body.id)).toMatchObject({ kind: 'bug', prd: 571 });
  });

  it('takes voice on a PRD\'s dossier, a version only when it changed, and refuses it on a fix\'s (PRD 822)', async () => {
    const w = world();
    const VOICE = '{"rounds": []}\n';
    const first = await w.push({ ...PUSH, artifacts: [{ kind: 'spec', content: SPEC }, { kind: 'voice', content: VOICE }] });
    expect(first).toMatchObject({ status: 200, body: { added: [{ kind: 'spec', version: 1 }, { kind: 'voice', version: 1 }], unchanged: [] } });
    const same = await w.push({ ...PUSH, artifacts: [{ kind: 'voice', content: VOICE }] });
    expect(same.body).toMatchObject({ added: [], unchanged: ['voice'] });
    const changed = await w.push({ ...PUSH, artifacts: [{ kind: 'voice', content: '{"rounds": [1]}\n' }] });
    expect(changed.body).toMatchObject({ added: [{ kind: 'voice', version: 2 }], unchanged: [] });

    for (const push of [
      { ...VISUAL, artifacts: [{ kind: 'voice', content: VOICE }] },
      { repo: 'acme/widgets', prd: 571, kind: 'bug', title: 'Numbers', artifacts: [{ kind: 'voice', content: VOICE }] },
      { ...PUSH, artifacts: [{ kind: 'voice', content: VOICE }, { kind: 'voice', content: VOICE }] },
    ]) {
      const { status, body } = await w.push(push);
      expect(status, JSON.stringify(push).slice(0, 120)).toBe(400);
      expect(body.error).toEqual(A_STRING);
    }
  });

  it('refuses 400 an unknown kind, a version the kind does not take, a kind twice but variations, and a fix naming a draft', async () => {
    const w = world();
    const draft = (await w.open({ title: 'A draft', repo: 'acme/widgets' })).body.id;
    for (const push of [
      { ...VISUAL, kind: 'epic' },
      { ...VISUAL, kind: 7 },
      { ...VISUAL, kind: 'bug' },
      { ...PUSH, artifacts: [{ kind: 'variations', content: 'a round' }] },
      { ...PUSH, kind: 'prd', artifacts: [{ kind: 'bug-record', content: 'a record' }] },
      { ...VISUAL, artifacts: [{ kind: 'before-after', content: 'a' }, { kind: 'before-after', content: 'b' }] },
      { ...VISUAL, artifacts: [{ kind: 'plan', content: 'a plan' }] },
      { ...VISUAL, draftId: draft },
    ]) {
      const { status, body } = await w.push(push);
      expect(status, JSON.stringify(push).slice(0, 120)).toBe(400);
      expect(body.error).toEqual(A_STRING);
    }
    expect(w.fake.tables.dossier_versions).toEqual([]);
  });

  it('a lookup takes the kind: a PRD\'s when none is sent, each linked under its own route', async () => {
    const w = world();
    const prd = w.fake.seedFromGithub({ repo: 'acme/widgets', prd: parsePrd(7), title: 'Team inbox' });
    const visual = w.fake.seedFromGithub({ repo: 'acme/widgets', prd: parsePrd(7), kind: 'visual', title: 'Sidebar' });
    const bug = w.fake.seedFromGithub({ repo: 'acme/widgets', prd: parsePrd(571), kind: 'bug', title: 'Numbers' });
    expect((await w.find('?repo=acme/widgets&prd=7')).body).toEqual({ id: prd.id, url: `https://omni.example/prd/${prd.id}` });
    expect((await w.find('?repo=acme/widgets&prd=7&kind=prd')).body.id).toBe(prd.id);
    expect((await w.find('?repo=acme/widgets&prd=7&kind=visual')).body).toEqual({ id: visual.id, url: `https://omni.example/visual/${visual.id}` });
    expect((await w.find('?repo=acme/widgets&prd=571&kind=bug')).body).toEqual({ id: bug.id, url: `https://omni.example/bugs/${bug.id}` });
    expect((await w.find('?repo=acme/widgets&prd=571')).status).toBe(404);
    for (const query of ['?repo=acme/widgets&prd=7&kind=epic', '?repo=acme/widgets&prd=7&kind=']) {
      expect((await w.find(query)).status, query).toBe(400);
    }
  });
});

describe('the dossier routes', () => {
  const app = (path: string) => fileURLToPath(new URL(`../../app/api/${path}/route.ts`, import.meta.url));
  const ROUTES: Array<[string, string, string]> = [
    ['dossiers', 'POST', 'openDossier'],
    ['dossiers/push', 'POST', 'pushDossier'],
    ['dossiers', 'GET', 'findDossier'],
  ];

  for (const [path, method, handler] of ROUTES) {
    it(`/api/${path} serves ${method} through ${handler}, within maxDuration 60`, () => {
      const source = readFileSync(app(path), 'utf8');
      expect(source).toMatch(/^export const maxDuration = 60;$/m);
      expect(source).toMatch(new RegExp(`export (async )?function ${method}\\b`));
      expect(source).toContain(`${handler}(`);
      expect(source).toContain('dossierDeps()');
    });
  }
});
