import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DETAIL_MAX, MAX_PUSH_BYTES, roadmapPush, type RoadmapDeps } from './api';
import { fakeRoadmaps, type FakeAccount } from './store.fake';
import { roadmapReader } from './store';

// What an answer of POST /api/roadmaps carries, checked as it is read.
const Answer = z.looseObject({
  error: z.string().optional(),
  roadmapId: z.string().optional(),
  created: z.boolean().optional(),
  product: z.string().nullable().optional(),
  unknownProduct: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

const ACME = '00000000-0000-4000-8000-000000000ace';
const OTHER = '00000000-0000-4000-8000-00000000beef';
const ADA: FakeAccount = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@acme.test', workspaces: [ACME] };
const BOB: FakeAccount = { id: '00000000-0000-4000-8000-0000000000b1', email: 'bob@acme.test', workspaces: [ACME] };
const CARL: FakeAccount = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@other.test', workspaces: [OTHER] };
const NELL: FakeAccount = { id: '00000000-0000-4000-8000-0000000000f1', email: 'nell@none.test', workspaces: [] };
const NOW = Date.parse('2026-10-07T10:00:00Z');

type Call = { token?: string | null; raw?: string };

function world({ database = true } = {}) {
  const clock = { now: NOW };
  const fake = fakeRoadmaps(
    { 'ada-token': ADA, 'bob-token': BOB, 'carl-token': CARL, 'nell-token': NELL },
    { [ACME]: { org: 'acme', products: ['Anvils', 'Rockets'] }, [OTHER]: { org: 'other', products: ['Widgets'] } },
    () => clock.now,
  );
  // The stub answers only the calls the route makes, so it is not a whole Supabase client.
  const deps: RoadmapDeps = { connect: database ? fake.client as unknown as RoadmapDeps['connect'] : null };
  const send = async (body: unknown, { token = 'ada-token', raw }: Call = {}) => {
    const response = await roadmapPush(new Request('https://omni.example/api/roadmaps', {
      method: 'POST',
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
      body: raw ?? JSON.stringify(body),
    }), deps);
    const text = await response.text();
    return { status: response.status, body: text ? Answer.parse(JSON.parse(text)) : null };
  };
  return { clock, fake, send };
}

const P1 = {
  id: 'P1.1', prd: 1201, title: 'Crew API and worker skeleton', repos: ['crew'], blockers: [], wave: 1, state: 'merged',
  startedAt: '2026-10-01T09:00:00Z', endedAt: '2026-10-03T17:00:00Z',
};
const P2 = {
  id: 'P3.4', prd: 1213, title: 'Stateless think endpoint', repos: ['ai-domain'], blockers: ['P1.1'], wave: 2, state: 'waiting',
  waitsOn: 'waits on crew#88 (P1.1 Crew API and worker skeleton): CI red', waitsOnUrl: 'https://github.com/acme/crew/pull/88',
};
const Q5 = { id: 'Q5', question: 'Who signs a mandate?', recommendation: null, blocks: ['P3.4'], kind: 'person', answer: null };
const PUSH = {
  repo: 'acme/plan', roadmap: 1200, title: 'Crew — from skeleton to earned autonomy', milestone: 'A company grants its first mandate.',
  product: 'anvils', target: '2027-03-31', source: 'https://claude.ai/artifact/crew', questions: [Q5],
  document: '---\nroadmap: 1200\n---\n', prds: [P1, P2],
};

describe('POST /api/roadmaps: a roadmap is pushed', () => {
  it('answers 201 for a new roadmap, filed in the repository\'s workspace under its product, its PRDs in order', async () => {
    const w = world();
    const { status, body } = await w.send(PUSH);
    expect(status).toBe(201);
    expect(body).toEqual({ roadmapId: body?.roadmapId, created: true, product: 'Anvils', unknownProduct: null, note: null });
    expect(body?.roadmapId).toMatch(/^[0-9a-f-]{36}$/);
    expect(w.fake.tables.roadmaps).toEqual([expect.objectContaining({
      id: body?.roadmapId, workspace_id: ACME, repo: 'acme/plan', number: 1200, product_id: w.fake.productId(ACME, 'Anvils'),
      target_date: '2027-03-31', questions: [Q5], document: PUSH.document, pushed_by: ADA.id,
    })]);
    expect(w.fake.tables.roadmap_prds.map((p) => [p.position, p.row_id, p.prd, p.state, p.repos, p.blockers])).toEqual([
      [1, 'P1.1', 1201, 'merged', ['crew'], []],
      [2, 'P3.4', 1213, 'waiting', ['ai-domain'], ['P1.1']],
    ]);
    expect(w.fake.tables.roadmap_prds[1]).toMatchObject({ waits_on: P2.waitsOn, waits_on_url: P2.waitsOnUrl, started_at: null });
  });

  it('sends exactly what the database needs: the roadmap\'s number under `number`, every field defaulted', async () => {
    const w = world();
    const bare = { repo: PUSH.repo, roadmap: PUSH.roadmap, title: PUSH.title, milestone: PUSH.milestone, document: PUSH.document };
    await w.send({ ...bare, prds: [{ id: 'P1.1', prd: 1201, title: 'Crew API', wave: 1, state: 'building' }] });
    expect(w.fake.calls).toEqual([{ fn: 'roadmap_push', args: { p_body: {
      repo: 'acme/plan', number: 1200, title: PUSH.title, milestone: PUSH.milestone, product: null, target: null, source: null,
      questions: [], document: PUSH.document,
      prds: [{ id: 'P1.1', prd: 1201, title: 'Crew API', repos: [], blockers: [], wave: 1, state: 'building', waitsOn: null, waitsOnUrl: null, startedAt: null, endedAt: null }],
    } } }]);
  });

  it('a second push, by another member, answers 200 and replaces the document and the PRD rows', async () => {
    const w = world();
    const first = await w.send(PUSH);
    const second = await w.send({ ...PUSH, document: '---\nroadmap: 1200\ntitle: v2\n---\n', prds: [{ ...P1, state: 'building', endedAt: null }] }, { token: 'bob-token' });
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ roadmapId: first.body?.roadmapId, created: false });
    expect(w.fake.tables.roadmaps).toHaveLength(1);
    expect(w.fake.tables.roadmaps[0]).toMatchObject({ document: '---\nroadmap: 1200\ntitle: v2\n---\n', pushed_by: BOB.id });
    expect(w.fake.tables.roadmap_prds.map((p) => [p.row_id, p.state])).toEqual([['P1.1', 'building']]);
  });

  it('files a product named but unknown under none, and says so', async () => {
    const w = world();
    const { status, body } = await w.send({ ...PUSH, product: 'Widgets' });
    expect(status).toBe(201);
    expect(body).toMatchObject({ product: null, unknownProduct: 'Widgets' });
    expect(body?.note).toBe('No product named "Widgets" in this workspace: the roadmap is filed under none.');
    expect(w.fake.tables.roadmaps[0]?.product_id).toBeNull();
  });

  it('a roadmap of the same number in another repository is another roadmap', async () => {
    const w = world();
    await w.send(PUSH);
    expect((await w.send({ ...PUSH, repo: 'acme/crew' })).status).toBe(201);
    expect(w.fake.tables.roadmaps).toHaveLength(2);
  });
});

// PRD 1218, slice s5: the prerequisites and this machine's last result, as `omni roadmap push` sends them.
const DOCKER = {
  id: 'p1', category: 'local', need: 'Docker is running, for the database tests', check: 'base:docker', fix: null, blocks: ['P3.4'], who: 'check', repos: [],
  card: { why: 'The tests start a database in Docker.', command: 'open -a Docker', whatItDoes: 'Starts the Docker app on your Mac.', whoCanDoIt: 'Anyone with this laptop.' },
};
const INSTALL = { id: 'p2', category: 'access', need: 'The dependencies install', check: 'base:install', fix: 'base:install', blocks: 'all', who: 'agent', repos: ['Crew'], card: null };
const SECRET = {
  id: 'p3', category: 'permissions', need: 'The Vercel preview has DATABASE_URL', check: null, fix: null, blocks: ['P1.1', 'P3.4'], who: 'person',
  card: { why: 'The preview reads the database.', command: 'vercel env add DATABASE_URL preview', whatItDoes: 'Adds the secret to the previews.', whoCanDoIt: 'An admin of the Vercel project.' },
};
const RESULT = {
  machine: 'pierre-mac', checkedAt: '2026-10-08T09:00:00.000Z',
  rows: [{ id: 'p1', state: 'waits', detail: 'docker info exited 1' }, { id: 'p2', state: 'fixed', detail: null }, { id: 'p9', state: 'ok', detail: null }],
};
const WITH_PREREQUISITES = { ...PUSH, prerequisites: [DOCKER, INSTALL, SECRET], prerequisiteResult: RESULT };

describe('POST /api/roadmaps: a roadmap\'s prerequisites', () => {
  it('stores each prerequisite in order with its card, the state its result row gives, and the machine and time', async () => {
    const w = world();
    const { status, body } = await w.send(WITH_PREREQUISITES);
    expect(status).toBe(201);
    expect(w.fake.tables.roadmap_prerequisites).toEqual([
      {
        roadmap_id: body?.roadmapId, position: 1, row_id: 'p1', category: 'local', need: DOCKER.need, check_with: 'base:docker', fix_with: null,
        blocks_all: false, blocks: ['P3.4'], who: 'check', repos: [], card: DOCKER.card, state: 'waits', detail: 'docker info exited 1',
      },
      {
        roadmap_id: body?.roadmapId, position: 2, row_id: 'p2', category: 'access', need: INSTALL.need, check_with: 'base:install', fix_with: 'base:install',
        blocks_all: true, blocks: [], who: 'agent', repos: ['crew'], card: null, state: 'fixed', detail: null,
      },
      {
        roadmap_id: body?.roadmapId, position: 3, row_id: 'p3', category: 'permissions', need: SECRET.need, check_with: null, fix_with: null,
        blocks_all: false, blocks: ['P1.1', 'P3.4'], who: 'person', repos: [], card: SECRET.card, state: null, detail: null,
      },
    ]);
    expect(w.fake.tables.roadmaps[0]).toMatchObject({ prerequisites_machine: 'pierre-mac', prerequisites_checked_at: '2026-10-08T09:00:00.000Z' });
  });

  it('sends the prerequisites after the roadmap, apart from it, every field defaulted', async () => {
    const w = world();
    const bare = { id: 'p1', category: 'github', need: 'The loop\'s labels exist', blocks: 'all', who: 'agent', fix: 'base:labels' };
    await w.send({ ...PUSH, prerequisites: [bare] });
    expect(w.fake.calls.map((c) => c.fn)).toEqual(['roadmap_push', 'roadmap_prerequisites_push']);
    expect(w.fake.calls[0]?.args.p_body).not.toHaveProperty('prerequisites');
    expect(w.fake.calls[0]?.args.p_body).not.toHaveProperty('prerequisiteResult');
    expect(w.fake.calls[1]?.args).toEqual({ p_body: {
      repo: 'acme/plan', number: 1200,
      prerequisites: [{ id: 'p1', category: 'github', need: 'The loop\'s labels exist', check: null, fix: 'base:labels', blocks: 'all', who: 'agent', repos: [], card: null }],
      result: null,
    } });
    expect(w.fake.tables.roadmaps[0]).toMatchObject({ prerequisites_machine: null, prerequisites_checked_at: null });
  });

  it('a push without the field stores as before and leaves the stored prerequisites as they are', async () => {
    const w = world();
    await w.send(WITH_PREREQUISITES);
    const again = await w.send(PUSH);
    expect(again.status).toBe(200);
    expect(w.fake.calls.map((c) => c.fn)).toEqual(['roadmap_push', 'roadmap_prerequisites_push', 'roadmap_push']);
    expect(w.fake.tables.roadmap_prerequisites.map((p) => p.row_id)).toEqual(['p1', 'p2', 'p3']);
    expect(w.fake.tables.roadmaps[0]).toMatchObject({ prerequisites_machine: 'pierre-mac' });
  });

  it('a later push replaces them, and a push with none and no result clears them', async () => {
    const w = world();
    await w.send(WITH_PREREQUISITES);
    await w.send({ ...PUSH, prerequisites: [SECRET], prerequisiteResult: { ...RESULT, machine: 'ci', rows: [{ id: 'p3', state: 'ticked' }] } }, { token: 'bob-token' });
    expect(w.fake.tables.roadmap_prerequisites.map((p) => [p.position, p.row_id, p.state])).toEqual([[1, 'p3', 'ticked']]);
    expect(w.fake.tables.roadmaps[0]).toMatchObject({ prerequisites_machine: 'ci' });
    await w.send({ ...PUSH, prerequisites: [], prerequisiteResult: null });
    expect(w.fake.tables.roadmap_prerequisites).toEqual([]);
    expect(w.fake.tables.roadmaps[0]).toMatchObject({ prerequisites_machine: null, prerequisites_checked_at: null });
  });

  it(`cuts a reason it waits past ${DETAIL_MAX} characters, and keeps none for a row that does not wait`, async () => {
    const w = world();
    const rows = [{ id: 'p1', state: 'waits', detail: `  ${'x'.repeat(2000)}` }, { id: 'p2', state: 'ok', detail: 'fine' }];
    await w.send({ ...WITH_PREREQUISITES, prerequisiteResult: { ...RESULT, rows } });
    const [docker, install] = w.fake.tables.roadmap_prerequisites;
    expect(docker?.detail).toHaveLength(DETAIL_MAX);
    expect(docker?.detail?.endsWith('…')).toBe(true);
    expect(install).toMatchObject({ state: 'ok', detail: null });
  });

  it('a member of the workspace reads the prerequisites in order, with the machine and time; another workspace reads none', async () => {
    const w = world();
    const { body } = await w.send(WITH_PREREQUISITES);
    const id = body?.roadmapId ?? '';
    const asBob = roadmapReader(w.fake.client('bob-token') as never);
    expect((await asBob.prerequisites(id)).map((p) => [p.row_id, p.state])).toEqual([['p1', 'waits'], ['p2', 'fixed'], ['p3', null]]);
    expect(await asBob.roadmap(id)).toMatchObject({ prerequisites_machine: 'pierre-mac', prerequisites_checked_at: RESULT.checkedAt });
    expect(await roadmapReader(w.fake.client('carl-token') as never).prerequisites(id)).toEqual([]);
  });

  const malformed: Array<[string, unknown]> = [
    ['a prerequisites field that is not a list', { prerequisites: DOCKER }],
    ['an unknown category', { prerequisites: [{ ...DOCKER, category: 'hardware' }] }],
    ['an unknown who', { prerequisites: [{ ...DOCKER, who: 'robot' }] }],
    ['an id that is not an id', { prerequisites: [{ ...DOCKER, id: 'p 1' }] }],
    ['an id used twice', { prerequisites: [DOCKER, { ...SECRET, id: 'p1' }] }],
    ['a prerequisite without its need', { prerequisites: [{ ...DOCKER, need: '' }] }],
    ['blocks neither all nor row ids', { prerequisites: [{ ...DOCKER, blocks: 'everything' }] }],
    ['a fix that is not a base fix', { prerequisites: [{ ...INSTALL, fix: 'rm -rf node_modules' }] }],
    ['a fix on a row that is not an agent\'s', { prerequisites: [{ ...DOCKER, fix: 'base:install' }] }],
    ['a card with an unknown line', { prerequisites: [{ ...DOCKER, card: { ...DOCKER.card, secret: 'x' } }] }],
    ['a card with an empty line', { prerequisites: [{ ...DOCKER, card: { ...DOCKER.card, command: '' } }] }],
    ['a prerequisite with an unknown field', { prerequisites: [{ ...DOCKER, path: 'kit/lib' }] }],
    ['a result without its machine', { prerequisites: [DOCKER], prerequisiteResult: { ...RESULT, machine: undefined } }],
    ['a result whose time is not a time', { prerequisites: [DOCKER], prerequisiteResult: { ...RESULT, checkedAt: 'this morning' } }],
    ['a result row of an unknown state', { prerequisites: [DOCKER], prerequisiteResult: { ...RESULT, rows: [{ id: 'p1', state: 'passed' }] } }],
  ];
  for (const [name, extra] of malformed) {
    it(`400 on ${name}, and nothing is written`, async () => {
      const w = world();
      const { status, body } = await w.send({ ...PUSH, ...(extra as object) });
      expect(status).toBe(400);
      expect(body?.error).toEqual(expect.any(String));
      expect(w.fake.calls).toEqual([]);
    });
  }

  it('400 when the database refuses the prerequisites, after the roadmap was recorded', async () => {
    const w = world();
    const deps: RoadmapDeps = {
      connect: (token) => {
        const client = w.fake.client(token);
        return { ...client, rpc: (name: string, args: Record<string, unknown>) => (name === 'roadmap_prerequisites_push' ? Promise.resolve({ data: null, error: { code: '22023', message: 'malformed' } }) : client.rpc(name, args)) } as unknown as ReturnType<NonNullable<RoadmapDeps['connect']>>;
      },
    };
    const response = await roadmapPush(new Request('https://omni.example/api/roadmaps', {
      method: 'POST', headers: { authorization: 'Bearer ada-token' }, body: JSON.stringify(WITH_PREREQUISITES),
    }), deps);
    expect(response.status).toBe(400);
    expect(w.fake.tables.roadmaps).toHaveLength(1);
  });
});

describe('refusals', () => {
  it('401 without a token, or with one the Auth server refuses', async () => {
    const w = world();
    for (const token of [null, 'forged-token']) {
      const { status, body } = await w.send(PUSH, { token });
      expect(status).toBe(401);
      expect(body?.error).toEqual(expect.any(String));
    }
    expect(w.fake.tables.roadmaps).toEqual([]);
  });

  const malformed: Array<[string, unknown]> = [
    ['a list', [PUSH]],
    ['a push without its repository', { ...PUSH, repo: undefined }],
    ['a repository not owner/name', { ...PUSH, repo: 'plan' }],
    ['a push without its roadmap number', { ...PUSH, roadmap: undefined }],
    ['a roadmap numbered 0', { ...PUSH, roadmap: 0 }],
    ['a push without its title', { ...PUSH, title: undefined }],
    ['a push without its milestone', { ...PUSH, milestone: '' }],
    ['a push without its document', { ...PUSH, document: undefined }],
    ['a target that is not a date', { ...PUSH, target: 'next spring' }],
    ['a source over 500 characters', { ...PUSH, source: 'x'.repeat(501) }],
    ['a push without its PRDs', { ...PUSH, prds: undefined }],
    ['an unknown field', { ...PUSH, transcript: '…' }],
    ['a PRD with an unknown state', { ...PUSH, prds: [{ ...P1, state: 'shipped' }] }],
    ['a PRD without its number', { ...PUSH, prds: [{ ...P1, prd: undefined }] }],
    ['a PRD without its wave', { ...PUSH, prds: [{ ...P1, wave: undefined }] }],
    ['a PRD in wave 0', { ...PUSH, prds: [{ ...P1, wave: 0 }] }],
    ['a row id that is not an id', { ...PUSH, prds: [{ ...P1, id: 'P 1' }] }],
    ['a row id used twice', { ...PUSH, prds: [P1, { ...P2, id: 'P1.1' }] }],
    ['a repository of a PRD that is not a name', { ...PUSH, prds: [{ ...P1, repos: ['crew api'] }] }],
    ['a waiting PR link that is not a web address', { ...PUSH, prds: [{ ...P2, waitsOnUrl: 'file:///etc/passwd' }] }],
    ['a start that is not a time', { ...PUSH, prds: [{ ...P1, startedAt: 'monday' }] }],
    ['an end before its start', { ...PUSH, prds: [{ ...P1, startedAt: '2026-10-03T17:00:00Z', endedAt: '2026-10-01T09:00:00Z' }] }],
    ['a PRD with an unknown field', { ...PUSH, prds: [{ ...P1, path: 'kit/lib' }] }],
    ['a question of an unknown kind', { ...PUSH, questions: [{ ...Q5, kind: 'maybe' }] }],
    ['a question without its text', { ...PUSH, questions: [{ ...Q5, question: '' }] }],
  ];
  for (const [name, body] of malformed) {
    it(`400 on ${name}`, async () => {
      const w = world();
      const { status, body: answer } = await w.send(body);
      expect(status).toBe(400);
      expect(answer?.error).toEqual(expect.any(String));
      expect(w.fake.calls).toEqual([]);
    });
  }

  it('400 on a body that is not JSON', async () => {
    const w = world();
    expect((await w.send(undefined, { raw: '{not json' })).status).toBe(400);
  });

  it(`413 past ${MAX_PUSH_BYTES} bytes`, async () => {
    const w = world();
    expect((await w.send({ ...PUSH, document: 'x'.repeat(MAX_PUSH_BYTES) })).status).toBe(413);
  });

  it('403 for a repository a workspace the caller is not in owns, and nothing is written', async () => {
    const w = world();
    const { status, body } = await w.send(PUSH, { token: 'carl-token' });
    expect(status).toBe(403);
    expect(body?.error).toContain('not a member');
    expect(w.fake.tables.roadmaps).toEqual([]);
  });

  it('403 for an account in no workspace, with the database\'s reason and the App\'s link', async () => {
    const w = world();
    const deps: RoadmapDeps = { connect: w.fake.client as unknown as RoadmapDeps['connect'], installLink: 'https://github.com/apps/omni/installations/new' };
    const response = await roadmapPush(new Request('https://omni.example/api/roadmaps', {
      method: 'POST', headers: { authorization: 'Bearer nell-token' }, body: JSON.stringify({ ...PUSH, repo: 'nowhere/plan' }),
    }), deps);
    expect(response.status).toBe(403);
    expect(Answer.parse(await response.json()).error).toBe('no workspace owns nowhere/plan yet — install the Omni App: https://github.com/apps/omni/installations/new');
  });

  it('503 when this deployment has no database', async () => {
    const w = world({ database: false });
    expect((await w.send(PUSH)).status).toBe(503);
  });

  it('400 for a field the database refuses, 500 for a failure, never a guess', async () => {
    for (const [code, status] of [['22023', 400], ['XX000', 500]] as const) {
      const deps: RoadmapDeps = {
        connect: () => ({
          auth: { getUser: () => Promise.resolve({ data: { user: { id: ADA.id, email: ADA.email } }, error: null }) },
          rpc: () => Promise.resolve({ data: null, error: { code, message: 'nope' } }),
        }) as unknown as ReturnType<NonNullable<RoadmapDeps['connect']>>,
      };
      const response = await roadmapPush(new Request('https://omni.example/api/roadmaps', {
        method: 'POST', headers: { authorization: 'Bearer ada-token' }, body: JSON.stringify(PUSH),
      }), deps);
      expect(response.status).toBe(status);
    }
  });
});

describe('reading the roadmaps', () => {
  it('a member of the workspace reads the roadmap and its PRDs in order; another workspace reads nothing', async () => {
    const w = world();
    const { body } = await w.send(PUSH);
    const id = body?.roadmapId ?? '';
    const asBob = roadmapReader(w.fake.client('bob-token') as never);
    const asCarl = roadmapReader(w.fake.client('carl-token') as never);
    expect(await asBob.list()).toEqual([expect.objectContaining({ id, repo: 'acme/plan', number: 1200, questions: [Q5] })]);
    expect(await asBob.roadmap(id)).toMatchObject({ id, milestone: PUSH.milestone });
    expect((await asBob.prds(id)).map((p) => p.row_id)).toEqual(['P1.1', 'P3.4']);
    expect(await asCarl.list()).toEqual([]);
    expect(await asCarl.roadmap(id)).toBeNull();
    expect(await asCarl.prds(id)).toEqual([]);
  });

  it('the most recently pushed roadmap first', async () => {
    const w = world();
    const first = await w.send(PUSH);
    w.clock.now += 1000;
    const later = await w.send({ ...PUSH, roadmap: 1300 });
    const reader = roadmapReader(w.fake.client('ada-token') as never);
    expect((await reader.list()).map((r) => r.id)).toEqual([later.body?.roadmapId, first.body?.roadmapId]);
  });
});
