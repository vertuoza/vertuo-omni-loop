import { describe, expect, it } from 'vitest';
import { ItemsReplySchema } from './outbox-items.contract';
import { putOutboxItem, readOutboxItems, settleOutboxItem, type OutboxItemsDeps } from './outbox-items.controller';
import type { ItemColumns, OutboxItemsRepository, PrdOnProduct, Stored, StoredItemRow } from './outbox-items.repository';
import { outboxItemsService } from './outbox-items.service';

// GET /api/outbox/items, POST /api/outbox/items and POST /api/outbox/items/settle (PRD 1548 s7), with a
// fake repository behind the real service: a signed-out request is refused before any read, a body that
// is no item of the PRD before any write, each answer is in the kit's own shape, an item's columns are
// read from its body, and each refusal of the database is in plain words.

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@acme.test' };
const DOSSIER = '11111111-1111-4111-8111-111111111111';
const BASE = 'https://omni.example/api/outbox/items';

function itemText({ prd = 'mobile-12', rank = 'high' }: { prd?: string; rank?: string } = {}): string {
  return [
    '---', 'id: s7-01-default-timeout', `prd: ${prd}`, 'slice: s7', `rank: ${rank}`, 'bears-on: none', 'raised: 2026-10-11', 'wave: 4', '---', '',
    '## The question, in plain words', '', 'How long should we wait?', '',
    '## The decision, in plain words', '', 'We wait five seconds.', '',
    '## The options, in plain words', '', 'A. Wait five seconds, the option built.', 'B. Wait one second.', '',
    '## What I had to decide', '', 'How long a call gets.', '',
    '## What I did meanwhile', '', 'Five seconds.', '',
    '## What it costs to change later', '', 'One constant.', '',
    '## What I could not know', '', '(author) Whether it is enough.', '',
  ].join('\n');
}

const SETTLED: StoredItemRow = {
  item: 's7-01-default-timeout', rank: 'high', repository: 'acme/app', body: itemText(), raised_at: '2026-10-11T10:00:00Z',
  outbox_settlements: [{ verdict: 'agreed', basis: 'affirmation', answer: 'Yes.', channel: 'terminal', settler_login: 'ada', settled_at: '2026-10-11T11:00:00Z' }],
};

type World = { dossier?: Stored<string | null>; items?: Stored<StoredItemRow[]>; write?: Stored<unknown>; throws?: boolean };

function world({ dossier = { ok: true, value: DOSSIER }, items = { ok: true, value: [SETTLED] }, write = { ok: true, value: { id: 'r1', item: 's7-01-default-timeout', prdId: 'mobile-12', open: true } }, throws = false }: World = {}, database = true) {
  const calls: string[] = [];
  const logged: string[] = [];
  const repo: OutboxItemsRepository = {
    dossier: (prd: PrdOnProduct) => { calls.push(`dossier ${prd.key}-${prd.seq} ${prd.repo}`); return Promise.resolve(dossier); },
    items: (id: string) => { calls.push(`items ${id}`); return throws ? Promise.reject(new Error('boom')) : Promise.resolve(items); },
    put: (prd: PrdOnProduct, columns: ItemColumns) => { calls.push(`put ${prd.repo} ${JSON.stringify({ ...columns, body: columns.body.length })}`); return Promise.resolve(write); },
    adopt: (_prd: PrdOnProduct, columns: ItemColumns) => { calls.push(`adopt ${columns.rank}`); return Promise.resolve(write); },
    settle: (_prd: PrdOnProduct, answer) => { calls.push(`settle ${JSON.stringify(answer)}`); return Promise.resolve(write); },
  };
  const deps: OutboxItemsDeps = {
    connect: database
      ? (token: string) => ({
          auth: { getUser: (jwt: string) => Promise.resolve(token === 'good' && jwt === 'good' ? { data: { user: ADA }, error: null } : { data: { user: null }, error: { status: 401 } }) },
          service: outboxItemsService(repo),
        })
      : null,
    log: (line) => { logged.push(line); },
  };
  return { deps, calls, logged };
}

const signed = (init: RequestInit = {}, token = 'good') => ({ ...init, headers: { authorization: `Bearer ${token}`, ...(init.body ? { 'content-type': 'application/json' } : {}) } });
const get = (query: string, token?: string) => new Request(`${BASE}?${query}`, signed({}, token));
const post = (path: string, body: unknown) => new Request(`${BASE}${path}`, signed({ method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }));
const read = async (response: Response) => ({ status: response.status, body: await response.json() as unknown });

describe('GET /api/outbox/items', () => {
  it('answers every item of the product PRD in the kit\'s shape, with its settlement', async () => {
    const { deps, calls } = world();
    const answer = await read(await readOutboxItems(get('product=mobile&prd=12&repo=Acme/App'), deps));
    expect(answer.status).toBe(200);
    expect(ItemsReplySchema.parse(answer.body)).toEqual({
      prdId: 'mobile-12',
      items: [{
        item: 's7-01-default-timeout', rank: 'high', repository: 'acme/app', body: itemText(), raisedAt: '2026-10-11T10:00:00Z',
        settlement: { verdict: 'agreed', basis: 'affirmation', answer: 'Yes.', channel: 'terminal', settledBy: 'ada', settledAt: '2026-10-11T11:00:00Z' },
      }],
    });
    expect(calls).toEqual(['dossier mobile-12 acme/app', `items ${DOSSIER}`]);
  });

  it('answers an open item with no settlement, and a PRD found without a repository', async () => {
    const { deps, calls } = world({ items: { ok: true, value: [{ ...SETTLED, outbox_settlements: [] }] } });
    const answer = await read(await readOutboxItems(get('product=mobile&prd=12'), deps));
    expect(answer.body).toMatchObject({ items: [{ settlement: null }] });
    expect(calls[0]).toBe('dossier mobile-12 null');
  });

  it('refuses a signed-out caller before any read, a malformed query, and no database', async () => {
    const { deps, calls } = world();
    expect((await readOutboxItems(get('product=mobile&prd=12', 'bad'), deps)).status).toBe(401);
    expect(await read(await readOutboxItems(get('product=Mobile&prd=12'), deps))).toMatchObject({ status: 400 });
    expect(await read(await readOutboxItems(get('product=mobile&prd=x'), deps))).toMatchObject({ status: 400 });
    expect(calls).toEqual([]);
    expect(await read(await readOutboxItems(get('product=mobile&prd=12'), world({}, false).deps)))
      .toEqual({ status: 503, body: { error: 'Outboxes are not available here: this deployment has no database.' } });
  });

  it('answers 404 for a PRD the caller does not read, and 500 when the database fails, logged', async () => {
    expect(await read(await readOutboxItems(get('product=mobile&prd=12'), world({ dossier: { ok: true, value: null } }).deps)))
      .toEqual({ status: 404, body: { error: 'No PRD mobile-12 in your workspaces.' } });
    const down = { ok: false as const, code: 'XX000', message: 'down', hint: null };
    expect((await readOutboxItems(get('product=mobile&prd=12'), world({ dossier: down }).deps)).status).toBe(500);
    const failing = world({ items: down });
    expect(await read(await readOutboxItems(get('product=mobile&prd=12'), failing.deps))).toEqual({ status: 500, body: { error: 'The PRD\'s outbox could not be read. Try again.' } });
    expect(failing.logged).toEqual(['outbox-items: The PRD\'s outbox could not be read. Try again.']);
    const throwing = world({ throws: true });
    expect((await readOutboxItems(get('product=mobile&prd=12'), throwing.deps)).status).toBe(500);
    expect(throwing.logged).toEqual(['outbox-items: boom']);
  });
});

describe('POST /api/outbox/items', () => {
  it('raises an item, its columns read from its body', async () => {
    const { deps, calls } = world();
    const answer = await read(await putOutboxItem(post('', { product: 'mobile', prd: 12, repo: 'acme/app', body: itemText() }), deps));
    expect(answer).toEqual({ status: 200, body: { id: 'r1', item: 's7-01-default-timeout', prdId: 'mobile-12', open: true } });
    expect(calls).toEqual([`put acme/app {"item":"s7-01-default-timeout","slice":"s7","rank":"high","bearsOn":"none","wave":4,"raised":"2026-10-11","body":${itemText().length}}`]);
  });

  it('adopts a medium item at once when asked', async () => {
    const adopted = { ok: true as const, value: { id: 'r1', item: 's7-01-default-timeout', prdId: 'mobile-12', verdict: 'adopted', settledAt: 't' } };
    const { deps, calls } = world({ write: adopted });
    const answer = await read(await putOutboxItem(post('', { product: 'mobile', prd: 12, body: itemText({ rank: 'medium' }), adopt: true }), deps));
    expect(answer).toEqual({ status: 200, body: adopted.value });
    expect(calls).toEqual(['adopt medium']);
  });

  it('refuses a body that is no item, or an item of another PRD, before any write', async () => {
    const { deps, calls } = world();
    const notItem = await read(await putOutboxItem(post('', { product: 'mobile', prd: 12, body: 'hello' }), deps));
    expect(notItem.status).toBe(400);
    expect(notItem.body).toMatchObject({ error: expect.stringMatching(/^The body is not an outbox item: /) as unknown });
    expect(await read(await putOutboxItem(post('', { product: 'mobile', prd: 12, body: itemText({ prd: 'mobile-13' }) }), deps)))
      .toEqual({ status: 400, body: { error: 'The item belongs to PRD mobile-13, not PRD mobile-12.' } });
    for (const body of ['nope', { product: 'mobile', prd: 12 }, { product: 'mobile', prd: 12, body: 'x', extra: 1 }, 'x'.repeat(200 * 1024)]) {
      expect((await putOutboxItem(post('', body), deps)).status).toBe(400);
    }
    expect(calls).toEqual([]);
  });

  it('answers the database\'s refusals in plain words', async () => {
    const cases: [Stored<unknown>, number, string][] = [
      [{ ok: false, code: 'P0002', message: 'No PRD mobile-12 in your workspaces.', hint: null }, 404, 'No PRD mobile-12 in your workspaces.'],
      [{ ok: false, code: 'P0002', message: null, hint: null }, 404, 'No PRD mobile-12 in your workspaces.'],
      [{ ok: false, code: '22023', message: 'Item s7-01 is already settled: it never changes.', hint: 'settled' }, 409, 'Item s7-01 is already settled: it never changes.'],
      [{ ok: false, code: '22023', message: 'Only a medium item is adopted when it is raised.', hint: 'rank' }, 422, 'Only a medium item is adopted when it is raised.'],
      [{ ok: false, code: '42501', message: 'Sign in first.', hint: null }, 401, 'Sign in first to read or write a PRD\'s outbox.'],
      [{ ok: false, code: 'XX000', message: 'down', hint: null }, 500, 'The PRD\'s outbox was not written. Try again.'],
    ];
    for (const [write, status, error] of cases) {
      expect(await read(await putOutboxItem(post('', { product: 'mobile', prd: 12, body: itemText() }), world({ write }).deps))).toEqual({ status, body: { error } });
    }
  });

  it('fails an answer out of the kit\'s shape, logged', async () => {
    const { deps, logged } = world({ write: { ok: true, value: { id: 'r1' } } });
    expect((await putOutboxItem(post('', { product: 'mobile', prd: 12, body: itemText() }), deps)).status).toBe(500);
    expect(logged).toHaveLength(1);
  });
});

describe('POST /api/outbox/items/settle', () => {
  const answer = { product: 'mobile', prd: 12, item: 's7-01-default-timeout', verdict: 'agreed', basis: 'affirmation', answer: 'Yes.' };

  it('settles an open item as answered in the terminal', async () => {
    const settled = { ok: true as const, value: { id: 's1', item: 's7-01-default-timeout', prdId: 'mobile-12', verdict: 'agreed', settledAt: 't' } };
    const { deps, calls } = world({ write: settled });
    expect(await read(await settleOutboxItem(post('/settle', answer), deps))).toEqual({ status: 200, body: settled.value });
    expect(calls).toEqual(['settle {"item":"s7-01-default-timeout","verdict":"agreed","basis":"affirmation","answer":"Yes.","channel":"terminal"}']);
  });

  it('refuses a malformed settlement before any write, and an item already settled in the database\'s words', async () => {
    const { deps, calls } = world();
    expect((await settleOutboxItem(post('/settle', { ...answer, verdict: 'adopted' }), deps)).status).toBe(400);
    expect((await settleOutboxItem(post('/settle', { ...answer, basis: ' ' }), deps)).status).toBe(400);
    expect(calls).toEqual([]);
    const twice = world({ write: { ok: false, code: '22023', message: 'Item s7-01 is already settled (agreed).', hint: 'settled' } });
    expect(await read(await settleOutboxItem(post('/settle', answer), twice.deps))).toEqual({ status: 409, body: { error: 'Item s7-01 is already settled (agreed).' } });
  });
});
