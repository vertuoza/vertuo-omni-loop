import { describe, expect, it } from 'vitest';
import { outboxQuestionsRepository, type OutboxQuestionsDb } from './outbox-questions.repository';

// The workspace Outbox's reads (PRD 2011 s14): each select it sends as the signed-in person, each answer
// parsed where it comes in; a failed read throws.

type Answer = { data: unknown; error: { message: string } | null };

/** A client whose every query chain is recorded as one line, answered by `answers` in order. */
function fakeDb(answers: Answer[]) {
  const lines: string[] = [];
  const chain = (line: string[]): unknown => new Proxy({}, {
    get(_, key: string) {
      if (key === 'then') {
        const answer = answers.shift() ?? { data: null, error: { message: 'no answer left' } };
        lines.push(line.join('.'));
        return (resolve: (value: Answer) => unknown) => resolve(answer);
      }
      return (...args: unknown[]) => chain([...line, `${key}(${args.map((a) => JSON.stringify(a)).join(',')})`]);
    },
  });
  return { db: { from: (table: string) => chain([`from(${JSON.stringify(table)})`]) } as unknown as OutboxQuestionsDb, lines };
}

const ITEM = { dossier_id: 'd1', item: 's1-01-x', rank: 'high', repository: null, body: '---', outbox_settlements: [] };

describe('the workspace Outbox\'s reads', () => {
  it('read every item with whether it is settled, oldest first', async () => {
    const { db, lines } = fakeDb([{ data: [ITEM], error: null }]);
    expect(await outboxQuestionsRepository(db).items()).toEqual([ITEM]);
    expect(lines[0]).toContain('from("outbox_items").select("dossier_id, item, rank, repository, body, outbox_settlements(id)").order("raised_at")');
  });

  it('read the PRDs of the items, among those that carry a product number, and none when there are no items', async () => {
    const prd = { id: 'd1', title: 'T', workspace_id: 'w', product_id: 'p', product_seq: 12, opened_by: null };
    const { db, lines } = fakeDb([{ data: [prd], error: null }]);
    const repo = outboxQuestionsRepository(db);
    expect(await repo.prds([])).toEqual([]);
    expect(await repo.prds(['d1'])).toEqual([prd]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('.not("product_seq","is",null).in("id",["d1"])');
  });

  it('read the products and the authors', async () => {
    const product = { id: 'p', name: 'Mobile', key: 'mobile' };
    const author = { user_id: 'u', github_login: 'ada' };
    const { db } = fakeDb([{ data: [product], error: null }, { data: [author], error: null }]);
    const repo = outboxQuestionsRepository(db);
    expect(await repo.products()).toEqual([product]);
    expect(await repo.authors()).toEqual([author]);
  });

  it('throw on a failed read, naming what could not be read', async () => {
    const failed = { data: null, error: { message: 'boom' } };
    const repo = outboxQuestionsRepository(fakeDb([failed, failed, failed, failed]).db);
    await expect(repo.items()).rejects.toThrow('could not read the outbox items (boom)');
    await expect(repo.prds(['d1'])).rejects.toThrow('could not read the items\' PRDs (boom)');
    await expect(repo.products()).rejects.toThrow('could not read the products (boom)');
    await expect(repo.authors()).rejects.toThrow('could not read the PRDs\' authors (boom)');
  });
});
