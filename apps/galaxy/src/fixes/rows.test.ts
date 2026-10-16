import { describe, expect, it } from 'vitest';
import { fixRowsPush, type FixRowsClient } from './rows';

// POST /api/fixes (PRD 2011, s6): the body names a product key; the route checks every row's repository
// against the product's own repositories, then fix_bug_push() numbers the bug and keeps its rows. The stub
// answers only the calls the route makes.

type Call = { fn: string; args: Record<string, unknown> };

function world({ fail }: { fail?: { code: string; message: string } } = {}) {
  const calls: Call[] = [];
  let bugSeq = 0;
  const client = {
    auth: { getUser: (token: string) => Promise.resolve(token === 'ada-token' ? { data: { user: { id: 'ada', email: 'ada@acme.test' } }, error: null } : { data: null, error: { message: 'bad' } }) },
    from(table: string) {
      const rows = table === 'products'
        ? [{ id: 'p1', name: 'Mobile' }]
        : [{ repository: 'acme/app', read_only: false, consumes: ['acme/api'] }, { repository: 'acme/api', read_only: false, consumes: [] }, { repository: 'acme/docs', read_only: true, consumes: [] }];
      const query = { select: () => query, eq: () => query, order: () => Promise.resolve({ data: rows, error: null }) };
      return query;
    },
    rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args });
      if (fail) return Promise.resolve({ data: null, error: fail });
      const created = args.p_bug === null;
      if (created) bugSeq += 1;
      const body = args.p_body as { rows: Array<{ repo: string; pull: number | null }> };
      return Promise.resolve({
        data: {
          dossierId: 'd1', bug: `mobile-B${created ? bugSeq : String(args.p_bug)}`, created, product: { id: 'p1', name: 'Mobile' },
          rows: body.rows.map((r, at) => ({ position: at + 1, repository: r.repo, pull: r.pull, state: 'open' })),
          added: [{ kind: 'bug-record', version: 1 }], unchanged: [],
        },
        error: null,
      });
    },
  };
  const connect = () => client as unknown as FixRowsClient;
  const send = async (body: unknown, token = 'ada-token') => {
    const response = await fixRowsPush(new Request('https://omni.example/api/fixes', {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
    }), { connect });
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : null) as Record<string, unknown> | null };
  };
  return { calls, send };
}

const ROW = { repo: 'acme/api', pull: 41, changes: 'the token is read once', reproduction: 'api.test.ts — red', guard: 'api.test.ts' };
const PUSH = { productKey: 'mobile', new: true, title: 'Sign-in loops', record: '# Sign-in loops\n', rows: [ROW, { ...ROW, repo: 'acme/app', pull: 7 }] };

describe('POST /api/fixes', () => {
  it('creates the product\'s next bug, mobile-B1, with its rows', async () => {
    const w = world();
    const sent = await w.send(PUSH);
    expect(sent.status).toBe(201);
    expect(sent.body).toMatchObject({ bug: 'mobile-B1', created: true, rows: [{ position: 1, repository: 'acme/api' }, { position: 2 }] });
    expect(w.calls).toEqual([{ fn: 'fix_bug_push', args: { p_key: 'mobile', p_bug: null, p_body: { title: 'Sign-in loops', record: '# Sign-in loops\n', rows: PUSH.rows }, p_repo: null } }]);
  });

  it('pushes again to a bug of the product', async () => {
    const w = world();
    const sent = await w.send({ ...PUSH, new: undefined, bug: 74 });
    expect(sent.status).toBe(200);
    expect(sent.body).toMatchObject({ bug: 'mobile-B74', created: false });
  });

  it('refuses by name a row outside the product, and writes nothing', async () => {
    const w = world();
    const sent = await w.send({ ...PUSH, rows: [ROW, { ...ROW, repo: 'other/site', pull: 3 }] });
    expect(sent.status).toBe(400);
    expect(sent.body?.error).toContain('Fixes row 2: other/site is not a repository of product Mobile');
    expect(sent.body?.error).toContain('Nothing was written.');
    expect(w.calls).toEqual([]);
  });

  it('with check, answers the product\'s repositories and writes nothing', async () => {
    const w = world();
    const sent = await w.send({ productKey: 'mobile', check: true, title: 'x', record: 'x', rows: [] });
    expect(sent.status).toBe(200);
    expect(sent.body).toMatchObject({
      checked: true, product: { key: 'mobile', name: 'Mobile' },
      repositories: [{ repository: 'acme/app', readOnly: false }, { repository: 'acme/api', readOnly: false }, { repository: 'acme/docs', readOnly: true }],
    });
    expect(w.calls).toEqual([]);
  });

  it('refuses a push that names no place, no row or an unknown field', async () => {
    const w = world();
    expect((await w.send({ ...PUSH, new: undefined })).status).toBe(400);
    expect((await w.send({ ...PUSH, rows: [] })).status).toBe(400);
    expect((await w.send({ ...PUSH, stray: 1 })).status).toBe(400);
  });

  it('refuses a caller with no valid token', async () => {
    expect((await world().send(PUSH, 'nobody')).status).toBe(401);
  });

  it('answers the database\'s refusal in its words, and a failure as a 500', async () => {
    const refused = await world({ fail: { code: '22023', message: 'Row 1 of mobile-B3 merged: it stays where it is.' } }).send(PUSH);
    expect(refused).toMatchObject({ status: 400, body: { error: 'Row 1 of mobile-B3 merged: it stays where it is.' } });
    const failed = await world({ fail: { code: 'XX000', message: 'boom' } }).send(PUSH);
    expect(failed.status).toBe(500);
  });

  it('answers 503 with no database here', async () => {
    const response = await fixRowsPush(new Request('https://omni.example/api/fixes', { method: 'POST', body: '{}' }), { connect: null });
    expect(response.status).toBe(503);
  });
});
