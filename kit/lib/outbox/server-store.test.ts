// The `server` outbox store's own edges (PRD 1548 s7), beside the contract it shares with the `git`
// store (`store.contract.test.ts`): how it names an item, how it reads a reply out of shape or a
// refusal, what it refuses before any call, and what it says when it holds. Its client is a fake of the
// Omni page's three calls, answering what each case needs.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { AskCallError } from '../ask/client.ts';
import { parseOutboxItemId, parsePr, parsePrd, parseProductPrdId } from '../ids.ts';
import { lawsFor } from '../laws.ts';
import { gitOutboxStore } from './git-store.ts';
import { heldLine, OutboxServerError, serverFailure, serverOutboxStore } from './server-store.ts';
import type { OutboxServerClient } from './server-store.ts';
import { adoptItem, settleItem } from './settle.ts';

const PRD = parseProductPrdId('mobile-12');
const ID = parseOutboxItemId('s7-01-default-timeout');
const NOW = Date.parse('2026-10-11T12:00:00Z');

function itemText({ prd = 'mobile-12', id = ID, rank = 'high' }: { prd?: string; id?: string; rank?: string } = {}): string {
  return [
    '---', `id: ${id}`, `prd: ${prd}`, 'slice: s7', `rank: ${rank}`, 'bears-on: none', 'raised: 2026-10-11', 'wave: 4', '---', '',
    '## The question, in plain words', '', 'How long should we wait before giving up on a slow call?', '',
    '## The decision, in plain words', '', 'We wait five seconds, which is generous without being unbounded.', '',
    '## The options, in plain words', '', 'A. Wait five seconds, the option built.', 'B. Wait one second, so a stuck call is caught sooner.', '',
    '## What I had to decide', '', 'How long a slow call gets before it is treated as stuck.', '',
    '## What I did meanwhile', '', 'Five seconds, a constant with no migration to undo it.', '',
    '## What it costs to change later', '', 'One constant.', '',
    '## What I could not know', '', '(author) Whether five seconds is measured against a real incident.', '',
  ].join('\n');
}

type Row = { item: string; rank: string; body: string; settlement: { verdict: string; basis: string; settledAt: string } | null };

/** A client answering `items` to every read, recording every write, and failing each write with `fail`. */
function client({ items = [] as Row[], reply, fail }: { items?: Row[]; reply?: unknown; fail?: Error } = {}) {
  const writes: unknown[] = [];
  const write = (body: unknown): Promise<unknown> => {
    writes.push(body);
    return fail === undefined ? Promise.resolve({}) : Promise.reject(fail);
  };
  const fake: OutboxServerClient = {
    readOutboxItems: () => Promise.resolve(reply ?? { prdId: PRD, items }),
    putOutboxItem: write,
    settleOutboxItem: write,
  };
  return { fake, writes };
}

function store(fake: OutboxServerClient) {
  const { root, ctx } = makeRepo();
  return { root, ctx, store: serverOutboxStore({ ctx, connect: () => fake, now: () => NOW }) };
}

const open = (body = itemText(), rank = 'high'): Row => ({ item: ID, rank, body, settlement: null });

describe('the server store names an item <prd>/<id>', () => {
  it('reads no item from a ref that names no product PRD or no item', async () => {
    const { store: server } = store(client({ items: [open()] }).fake);
    expect(await server.readItem(`mobile-12/${ID}`)).toEqual({ ok: true, text: itemText() });
    for (const ref of [ID, `12/${ID}`, 'mobile-12/not-an-id', `mobile-12/${ID}/x`]) {
      expect(await server.readItem(ref)).toEqual({ ok: false, code: 'ENOENT' });
    }
  });

  it('refuses to settle what a ref does not name, or an item whose body does not parse', async () => {
    const { fake, writes } = client({ items: [open('not an item')] });
    const { store: server } = store(fake);
    const answer = { text: 'Yes, five seconds is right.' };
    expect(await server.settle(ID, answer)).toEqual({ ok: false, errors: [`${ID}: no such open item.`] });
    expect(await server.settle(`mobile-12/${ID}`, answer)).toEqual({ ok: false, errors: [`mobile-12/${ID}: no such open item.`] });
    expect(writes).toEqual([]);
  });
});

describe('the server store finds the item a ref names among the PRD\'s rows', () => {
  const OTHER = 's7-02-other';
  const rows = (): Row[] => [open(), { ...open(itemText({ id: OTHER })), item: OTHER }];

  it('reads and settles that item, not the first', async () => {
    const { fake, writes } = client({ items: rows() });
    const { store: server } = store(fake);
    expect(await server.readItem(`mobile-12/${OTHER}`)).toEqual({ ok: true, text: itemText({ id: OTHER }) });
    expect(await server.settle(`mobile-12/${OTHER}`, { text: 'Yes, five seconds is right.' })).toMatchObject({ ok: true, removedFile: `mobile-12/${OTHER}` });
    expect(writes).toMatchObject([{ item: OTHER }]);
  });

  it('refuses to adopt an item that is not medium in its own words, sending nothing', async () => {
    const { fake, writes } = client();
    expect(await store(fake).store.adopt(itemText())).toEqual({
      ok: false, errors: [`${ID}: only a "medium" item is adopted at raise time — this one is ranked "high" and is written as an open item instead.`],
    });
    expect(writes).toEqual([]);
  });

  it('words an answer of the wrong type as the kit does', async () => {
    const { fake } = client({ items: rows() });
    expect(await store(fake).store.settle(`mobile-12/${ID}`, { text: 5 })).toEqual({ ok: false, errors: ['text: Expected string, received number'] });
  });
});

describe('the server store holds only a product PRD\'s outbox', () => {
  it('refuses a repository\'s PRD, naming where its outbox is', async () => {
    const { store: server, root } = store(client().fake);
    const prd = parsePrd(42);
    const refusal = 'PRD 42 is a repository\'s: its outbox is in the repository, not on the Omni page';
    await expect(server.openItems(prd)).rejects.toThrow(refusal);
    await expect(server.gate(prd, {})).rejects.toThrow(refusal);
    await expect(server.spentIds(prd, null)).rejects.toThrow(refusal);
    await expect(server.writeItem({ prd, id: ID, text: itemText({ prd: '42' }) }, null)).rejects.toThrow(refusal);
    await expect(server.relay(prd, root, lawsFor(makeRepo().ctx))).rejects.toThrow(refusal);
    await expect(server.adoptedEntries(prd)).rejects.toThrow(refusal);
    await expect(server.replies({ prd, pr: parsePr(7) }, { listComments: () => [], createComment: () => null })).rejects.toThrow(refusal);
    await expect(server.prComment(prd, { listComments: () => [], createComment: () => null, updateComment: () => null })).rejects.toThrow(refusal);
    await expect(server.adopt(itemText({ prd: '42', rank: 'medium' }))).rejects.toThrow(refusal);
  });

  it('and the git store refuses a product PRD as a PRD with no folder', async () => {
    const { ctx } = makeRepo();
    const git = gitOutboxStore(ctx);
    await expect(git.openItems(PRD)).rejects.toThrow('PRD mobile-12 has no inbox or shipped folder');
    await expect(git.gate(PRD, {})).rejects.toThrow('PRD mobile-12 has no inbox or shipped folder');
    expect(() => adoptItem({ ctx, itemText: itemText({ rank: 'medium' }) })).toThrow('PRD mobile-12 has no inbox or shipped folder');
    const file = join(ctx.root, 'item.md');
    writeFileSync(file, itemText());
    expect(() => settleItem({ ctx, file, answer: { text: 'Yes.', approvedBy: 'pm', approvedAt: '2026-10-11', channel: { kind: 'prd-issue', number: 1 } } })).toThrow('PRD mobile-12 has no inbox or shipped folder');
  });
});

describe('the server store grades before it writes', () => {
  it('refuses an item that fails the outbox check, or that belongs to another PRD, sending nothing', async () => {
    const { fake, writes } = client();
    const { store: server } = store(fake);
    await expect(server.writeItem({ prd: PRD, id: ID, text: itemText().replace('wave: 4', 'wave: x') }, null)).rejects.toThrow(`mobile-12/${ID}: `);
    await expect(server.writeItem({ prd: PRD, id: ID, text: itemText({ prd: 'mobile-13' }) }, null)).rejects.toThrow(`mobile-12/${ID}: it belongs to PRD mobile-13, not PRD mobile-12`);
    expect(writes).toEqual([]);
  });

  it('refuses to adopt an item that does not parse', async () => {
    const { fake, writes } = client();
    const result = await store(fake).store.adopt('not an item');
    expect(result.ok).toBe(false);
    expect(writes).toEqual([]);
  });

  it('refuses an undetermined answer, asking for a verdict', async () => {
    const { fake, writes } = client({ items: [open()] });
    const result = await store(fake).store.settle(`mobile-12/${ID}`, { text: 'Hmm, it depends on the network we are on.' });
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.errors.join('')).toMatch(/^mobile-12\/s7-01-default-timeout: the verdict is undetermined — .*Say it outright/);
    expect(writes).toEqual([]);
  });

  it('settles with the verdict stated, who approved it and when, recorded in its entry', async () => {
    const { fake, writes } = client({ items: [open()] });
    const result = await store(fake).store.settle(`mobile-12/${ID}`, { text: 'Hmm.', statedVerdict: 'drifted', approvedBy: 'pm', approvedAt: '2026-10-10' });
    expect(result).toMatchObject({ ok: true, verdict: 'drifted', basis: 'stated', removedFile: `mobile-12/${ID}`, settledFile: 'PRD mobile-12\'s ledger on the Omni page' });
    expect(result.ok ? result.entry : '').toContain('- Approved by: pm');
    expect(result.ok ? result.entry : '').toContain('- Approved at: 2026-10-10');
    expect(writes).toEqual([{ key: 'mobile', seq: 12, repo: 'acme/widgets', item: ID, verdict: 'drifted', basis: 'stated', answer: 'Hmm.' }]);
  });

  it('records an answer given with no name or time as the signed-in person\'s, now', async () => {
    const { fake } = client({ items: [open()] });
    const result = await store(fake).store.settle(`mobile-12/${ID}`, { text: 'Yes, five seconds is right.' });
    expect(result.ok ? result.entry : '').toContain('- Approved by: the signed-in person');
    expect(result.ok ? result.entry : '').toContain('- Approved at: 2026-10-11T12:00:00.000Z');
  });
});

describe('the server store reads the Omni page\'s answers', () => {
  it('holds with the held line, since the time it could not reach it', async () => {
    const { fake } = client({ fail: new AskCallError('POST /api/outbox/items: unreachable') });
    const failed = store(fake).store.writeItem({ prd: PRD, id: ID, text: itemText() }, null);
    await expect(failed).rejects.toThrow(heldLine('2026-10-11T12:00:00.000Z'));
    await expect(failed).rejects.toMatchObject({ name: 'OutboxServerError', status: null });
    expect(heldLine('t')).toBe('held · server unreachable since t · held, not failed');
  });

  it('turns a refusal of a write into the verb\'s errors, and fails on any other', async () => {
    const settled = new AskCallError('POST: 409', { status: 409, reason: 'Item s7-01 is already settled.' });
    expect(await store(client({ fail: settled }).fake).store.adopt(itemText({ rank: 'medium' }))).toEqual({ ok: false, errors: ['Item s7-01 is already settled.'] });
    for (const status of [400, 422]) {
      const refused = new AskCallError('POST', { status, reason: 'no' });
      expect(await store(client({ fail: refused }).fake).store.adopt(itemText({ rank: 'medium' }))).toEqual({ ok: false, errors: ['no'] });
    }
    const failed = new AskCallError('POST: 500', { status: 500 });
    await expect(store(client({ fail: failed }).fake).store.adopt(itemText({ rank: 'medium' }))).rejects.toMatchObject({ message: 'the Omni page refused the call (500)', status: 500 });
    await expect(store(client({ fail: new Error('boom') }).fake).store.adopt(itemText({ rank: 'medium' }))).rejects.toThrow('boom');
  });

  it('refuses a reply out of shape', async () => {
    await expect(store(client({ reply: { items: 'none' } }).fake).store.openItems(PRD)).rejects.toMatchObject({ message: 'the Omni page answered the outbox items out of shape' });
  });

  it('grades an open row whose body does not parse as an unreadable item, and opens the gate with the override label', async () => {
    const { ctx, store: server } = store(client({ items: [open('not an item')] }).fake);
    expect(await server.gate(PRD, {})).toEqual({ ok: false, items: [{ file: `mobile-12/${ID}`, id: null, rank: null }], overridden: false, unreworked: [], overrideLabel: ctx.config.labels.outboxGo });
    expect((await server.gate(PRD, { labels: [ctx.config.labels.outboxGo] })).ok).toBe(true);
    expect(await server.openItems(PRD)).toEqual([]);
  });

  it('reads an adopted row as an adopted ledger entry, and an answered one as no adoption', async () => {
    const adopted: Row = { ...open(itemText({ rank: 'medium' }), 'medium'), settlement: { verdict: 'adopted', basis: 'adopted-when-raised', settledAt: 't' } };
    const answered: Row = { ...open(), item: 's7-02-other', settlement: { verdict: 'agreed', basis: 'affirmation', settledAt: 't' } };
    const entries = await store(client({ items: [adopted, answered] }).fake).store.adoptedEntries(PRD);
    expect(entries).toEqual([{ id: ID, verdict: 'adopted', closed: true, fields: { Verdict: 'adopted', Basis: 'adopted-when-raised' }, answerText: '', itemText: itemText({ rank: 'medium' }), became: [] }]);
  });

  it('counts the open rows on the comments it skips', async () => {
    const { store: server } = store(client({ items: [open()] }).fake);
    const none = { listComments: () => [], createComment: () => null, updateComment: () => null };
    expect(await server.issueComment({ prd: PRD, owner: 'acme', repo: 'widgets', branch: 'feat/a' }, none)).toEqual({
      action: 'skipped', id: null, htmlUrl: null, itemCount: 1, unaccountedCount: 0, newCount: 0, counts: {}, adoptedCount: 0, body: '',
    });
    expect(await server.prComment(PRD, none)).toEqual({ action: 'skipped', id: null, htmlUrl: null, openCount: 1, answeredCount: 0, adoptedCount: 0, newAdoptedCount: 0, body: null });
  });
});

describe('the server store\'s relay', () => {
  it('refuses an item already on the PRD, or of another PRD, leaving it in place', async () => {
    const { fake, writes } = client({ items: [open()] });
    const { ctx, store: server } = store(fake);
    const dir = mkdtempSync(join(tmpdir(), 'relay-'));
    writeFileSync(join(dir, `${ID}.md`), itemText());
    writeFileSync(join(dir, 's7-02-other.md'), itemText({ prd: 'mobile-13', id: 's7-02-other' }));
    const relayed = await server.relay(PRD, dir, lawsFor(ctx));
    expect(relayed).toEqual({
      moved: [],
      refused: [
        { file: join(dir, `${ID}.md`), reason: `${ID} is already in the outbox of PRD mobile-12` },
        { file: join(dir, 's7-02-other.md'), reason: 'it belongs to PRD mobile-13, not PRD mobile-12' },
      ],
    });
    expect(writes).toEqual([]);
  });

  it('spends the ids a scratch folder holds, beside the PRD\'s rows', async () => {
    const { store: server } = store(client({ items: [open()] }).fake);
    const dir = mkdtempSync(join(tmpdir(), 'out-'));
    mkdirSync(join(dir, 'accounts'));
    writeFileSync(join(dir, 's7-02-other.md'), 'x');
    expect([...(await server.spentIds(PRD, { abs: dir, shown: 'out' }))]).toEqual([ID, 's7-02-other']);
  });
});

describe('serverFailure', () => {
  it('prints the store\'s reason as the command\'s, exit 1, and throws anything else', () => {
    const err: string[] = [];
    const stderr = { write: (text: string) => err.push(text) };
    expect(serverFailure('status', new OutboxServerError(heldLine('t'), null), stderr)).toBe(1);
    expect(err).toEqual(['omni status: held · server unreachable since t · held, not failed\n']);
    expect(() => serverFailure('status', new Error('boom'), stderr)).toThrow('boom');
  });
});
