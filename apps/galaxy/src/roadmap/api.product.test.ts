import { describe, expect, it } from 'vitest';
import { roadmapPush, type RoadmapDeps } from './api';
import { fakeRoadmaps, type FakeAccount } from './store.fake';

// POST /api/roadmaps for a roadmap born on the server (PRD 2011, s2): the body names a product key in place
// of a repository and an issue number; the route checks the rows against the product's own repositories,
// then roadmap_product_push() numbers the roadmap from the product's counter and adds a version only of
// what changed. The stub answers only the calls the route makes.

const ACME = '00000000-0000-4000-8000-000000000ace';
const OTHER = '00000000-0000-4000-8000-00000000beef';
const ADA: FakeAccount = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@acme.test', workspaces: [ACME] };
const CARL: FakeAccount = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@other.test', workspaces: [OTHER] };

function world() {
  const fake = fakeRoadmaps(
    { 'ada-token': ADA, 'carl-token': CARL },
    { [ACME]: { org: 'acme', products: ['Mobile'] }, [OTHER]: { org: 'other', products: [] } },
    () => Date.parse('2026-10-15T10:00:00Z'),
    {
      mobile: {
        workspace: ACME, name: 'Mobile',
        repositories: [{ repository: 'acme/app', consumes: ['acme/api'] }, { repository: 'acme/api' }, { repository: 'acme/docs', readOnly: true }],
      },
    },
  );
  const deps: RoadmapDeps = { connect: fake.client as unknown as RoadmapDeps['connect'] };
  const send = async (body: unknown, token = 'ada-token') => {
    const response = await roadmapPush(new Request('https://omni.example/api/roadmaps', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }), deps);
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : null) as Record<string, unknown> | null };
  };
  return { fake, send };
}

const ROW = {
  id: 'P1', prd: 'mobile-12', title: 'Sign-in', repos: ['app'], blockers: [], wave: 1, state: 'waiting',
  waitsOn: null, waitsOnUrl: null, startedAt: null, endedAt: null,
};
const PUSH = {
  productKey: 'mobile', new: true, title: 'Mobile launch', milestone: 'The app ships.', target: null, source: null, questions: [],
  document: '---\ntitle: Mobile launch\n---\n', prds: [ROW, { ...ROW, id: 'P2', prd: 912, repos: ['api'], blockers: ['P1'], wave: 2 }],
};

describe('POST /api/roadmaps for a roadmap born on the server', () => {
  it('creates the product\'s next roadmap, mobile-R1, then mobile-R2, numbers with no gap', async () => {
    const w = world();
    const first = await w.send(PUSH);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ roadmap: 'mobile-R1', created: true, product: { name: 'Mobile' } });
    const second = await w.send(PUSH);
    expect(second.status).toBe(201);
    expect(second.body).toMatchObject({ roadmap: 'mobile-R2', created: true });
    expect(w.fake.calls.filter((c) => c.fn === 'roadmap_product_push').map((c) => c.args.p_roadmap)).toEqual([null, null]);
  });

  it('sends the database the key, the number and the body without them', async () => {
    const w = world();
    await w.send({ ...PUSH, repo: 'acme/app' });
    expect(w.fake.calls[0]).toMatchObject({ fn: 'roadmap_product_push', args: { p_key: 'mobile', p_roadmap: null, p_repo: 'acme/app' } });
    const body = w.fake.calls[0]?.args.p_body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['document', 'milestone', 'prds', 'questions', 'source', 'target', 'title']);
  });

  it('a later push adds a version only of the file that changed', async () => {
    const w = world();
    await w.send(PUSH);
    const same = await w.send({ ...PUSH, new: undefined, roadmap: 1 });
    expect(same.status).toBe(200);
    expect(same.body).toMatchObject({ roadmap: 'mobile-R1', created: false, added: [], unchanged: ['roadmap', 'roadmap-prds'] });
    const edited = await w.send({ ...PUSH, new: undefined, roadmap: 1, document: `${PUSH.document}more\n` });
    expect(edited.body).toMatchObject({ added: [{ kind: 'roadmap', version: 2 }], unchanged: ['roadmap-prds'] });
    const rows = await w.send({ ...PUSH, new: undefined, roadmap: 1, document: `${PUSH.document}more\n`, prds: [ROW] });
    expect(rows.body).toMatchObject({ added: [{ kind: 'roadmap-prds', version: 2 }], unchanged: ['roadmap'] });
  });

  it('refuses a row naming a repository outside the product, by name, and writes nothing', async () => {
    const w = world();
    const { status, body } = await w.send({ ...PUSH, prds: [{ ...ROW, repos: ['app', 'shop'] }] });
    expect(status).toBe(400);
    expect(body?.error).toBe('P1: shop is not a repository of product mobile (api, app, docs). Nothing was written.');
    expect(w.fake.calls).toEqual([]);
    expect(w.fake.productRoadmaps).toEqual([]);
  });

  it('a check writes nothing and answers the product\'s repositories in short names', async () => {
    const w = world();
    const { status, body } = await w.send({ ...PUSH, new: undefined, check: true });
    expect(status).toBe(200);
    expect(body).toEqual({
      checked: true, product: { key: 'mobile', name: 'Mobile' },
      repositories: [
        { repo: 'api', readOnly: false, consumes: [] }, { repo: 'app', readOnly: false, consumes: ['api'] }, { repo: 'docs', readOnly: true, consumes: [] },
      ],
    });
    expect(w.fake.calls).toEqual([]);
  });

  it('a product the caller reads none of is 404, a roadmap number it has not is 404, and a body naming neither is 400', async () => {
    const w = world();
    expect((await w.send(PUSH, 'carl-token')).status).toBe(404);
    expect((await w.send({ ...PUSH, productKey: 'web' })).status).toBe(404);
    expect((await w.send({ ...PUSH, new: undefined, roadmap: 9 })).status).toBe(404);
    const neither = await w.send({ ...PUSH, new: undefined });
    expect(neither.status).toBe(400);
    expect(neither.body?.error).toContain('name where it goes');
    expect((await w.send({ ...PUSH, repo: 'nope' })).status).toBe(400);
    expect((await w.send({ ...PUSH, prds: [{ ...ROW, prd: '12' }, { ...ROW, id: 'P2', prd: 'mobile-r3' }] })).status).toBe(400);
  });

  it('a git-born push, naming a repository and an issue, is answered as before', async () => {
    const w = world();
    const { status, body } = await w.send({
      repo: 'acme/plan', roadmap: 1200, title: 'T', milestone: 'M', document: '---\n---\n',
      prds: [{ id: 'P1', prd: 1201, title: 'A', repos: [], blockers: [], wave: 1, state: 'merged' }],
    });
    expect(status).toBe(201);
    expect(body).toMatchObject({ created: true });
    expect(w.fake.calls[0]?.fn).toBe('roadmap_push');
  });
});
