import { describe, expect, it } from 'vitest';
import { parseWorkSliceId } from 'omni-loop/kit/lib/ids.ts';
import { outboxItemsRepository, type OutboxItemsDb } from './outbox-items.repository';

// A product PRD's outbox storage (PRD 1548 s7): the reads and RPCs it sends, as the signed-in person, each
// answer parsed where it comes in. A fake client records each query's chain and answers what the test
// gives it.

const DOSSIER = '11111111-1111-4111-8111-111111111111';
const MOBILE = { key: 'mobile', seq: 12, repo: 'acme/app' };
const COLUMNS = { item: 's7-01-default-timeout', slice: parseWorkSliceId('s7'), rank: 'medium', bearsOn: 'none', wave: 4, raised: '2026-10-11', body: '---\n…' };

type Answer = { data: unknown; error: { code?: string; message?: string; hint?: string } | null };

/** A client whose every query chain is recorded as one line, answered by `answers` in order. */
function fakeDb(answers: Answer[]) {
  const lines: string[] = [];
  const next = () => answers.shift() ?? { data: null, error: { message: 'no answer left' } };
  const chain = (line: string[]): unknown => new Proxy({}, {
    get(_, key: string) {
      if (key === 'then') {
        const answer = next();
        lines.push(line.join('.'));
        return (resolve: (value: Answer) => unknown) => resolve(answer);
      }
      return (...args: unknown[]) => chain([...line, `${key}(${args.map((a) => JSON.stringify(a)).join(',')})`]);
    },
  });
  const db = {
    from: (table: string) => chain([`from(${JSON.stringify(table)})`]),
    rpc: (fn: string, args: Record<string, unknown>) => chain([`rpc(${JSON.stringify(fn)},${JSON.stringify(args)})`]),
  } as unknown as OutboxItemsDb;
  return { db, lines };
}

describe('the product PRD\'s dossier', () => {
  it('is found through dossier_approval(), by its key, its number and the repository', async () => {
    const { db, lines } = fakeDb([{ data: { dossier: DOSSIER, approval: null }, error: null }]);
    expect(await outboxItemsRepository(db).dossier(MOBILE)).toEqual({ ok: true, value: DOSSIER });
    expect(lines).toEqual(['rpc("dossier_approval",{"p_repo":"acme/app","p_prd":12,"p_product":"mobile"})']);
  });

  it('is none when the answer names none, and the database\'s refusal otherwise', async () => {
    expect(await outboxItemsRepository(fakeDb([{ data: { dossier: null }, error: null }]).db).dossier(MOBILE)).toEqual({ ok: true, value: null });
    expect(await outboxItemsRepository(fakeDb([{ data: null, error: { code: 'XX000', message: 'down' } }]).db).dossier(MOBILE))
      .toEqual({ ok: false, code: 'XX000', message: 'down', hint: null });
  });
});

describe('the items', () => {
  it('are read with their settlements, oldest first', async () => {
    const row = {
      item: COLUMNS.item, rank: 'medium', repository: null, body: 'x', raised_at: 't',
      outbox_settlements: [{ verdict: 'adopted', basis: 'adopted-when-raised', answer: null, channel: null, settler_login: 'ada', settled_at: 't' }],
    };
    const { db, lines } = fakeDb([{ data: [row], error: null }]);
    expect(await outboxItemsRepository(db).items(DOSSIER)).toEqual({ ok: true, value: [row] });
    expect(lines).toEqual([
      `from("outbox_items").select("item, rank, repository, body, raised_at, outbox_settlements(verdict, basis, answer, channel, settler_login, settled_at)").eq("dossier_id","${DOSSIER}").order("raised_at").order("item")`,
    ]);
  });

  it('answered out of shape are refused by the code `shape`', async () => {
    expect(await outboxItemsRepository(fakeDb([{ data: [{ item: 1 }], error: null }]).db).items(DOSSIER))
      .toEqual({ ok: false, code: 'shape', message: 'outbox_items answered out of shape', hint: null });
  });
});

describe('the writes', () => {
  it('put, adopt and settle through their RPCs, naming the repository only when there is one', async () => {
    const { db, lines } = fakeDb([{ data: {}, error: null }, { data: {}, error: null }, { data: {}, error: null }, { data: {}, error: null }]);
    const repo = outboxItemsRepository(db);
    await repo.put(MOBILE, COLUMNS);
    await repo.adopt({ ...MOBILE, repo: null }, COLUMNS);
    await repo.settle(MOBILE, { item: COLUMNS.item, verdict: 'agreed', basis: 'affirmation', answer: 'Yes.', channel: 'terminal' });
    await repo.settle({ ...MOBILE, repo: null }, { item: COLUMNS.item, verdict: 'agreed', basis: 'affirmation', answer: 'Yes.', channel: 'terminal' });
    const args = '"p_product":"mobile","p_prd":12,"p_item":"s7-01-default-timeout","p_slice":"s7","p_rank":"medium","p_bears_on":"none","p_wave":4,"p_raised":"2026-10-11","p_body":"---\\n…"';
    expect(lines).toEqual([
      `rpc("outbox_item_put",{${args},"p_repository":"acme/app"})`,
      `rpc("outbox_item_adopt",{${args}})`,
      'rpc("outbox_settle",{"p_product":"mobile","p_prd":12,"p_item":"s7-01-default-timeout","p_verdict":"agreed","p_basis":"affirmation","p_answer":"Yes.","p_channel":"terminal","p_repo":"acme/app"})',
      'rpc("outbox_settle",{"p_product":"mobile","p_prd":12,"p_item":"s7-01-default-timeout","p_verdict":"agreed","p_basis":"affirmation","p_answer":"Yes.","p_channel":"terminal"})',
    ]);
  });

  it('answer the database\'s refusal by its code, words and hint', async () => {
    const refusal = { code: '22023', message: 'Item s7-01 is already settled.', hint: 'settled' };
    expect(await outboxItemsRepository(fakeDb([{ data: null, error: refusal }]).db).put(MOBILE, COLUMNS)).toEqual({ ok: false, ...refusal });
  });
});
