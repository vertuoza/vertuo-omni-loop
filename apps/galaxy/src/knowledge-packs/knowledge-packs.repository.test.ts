import { describe, expect, it } from 'vitest';
import { knowledgePacksRepository, type KnowledgePacksDb } from './knowledge-packs.repository';

// The knowledge packs' storage (PRD 2011): the reads it sends as the signed-in person, each answer parsed
// where it comes in. A fake client records each query's chain and answers what the test gives it.

const SHA = 'c'.repeat(40);

type Answer = { data: unknown; error: { code?: string; message?: string } | null };

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
  const db = { from: (table: string) => chain([`from(${JSON.stringify(table)})`]) } as unknown as KnowledgePacksDb;
  return { db, lines };
}

const ROW = { id: 'k-1', repository: 'acme/api', sha: SHA, committed_at: '2026-10-16T09:00:00Z', made_at: '2026-10-16T09:01:00Z' };
const SELECT = 'from("knowledge_packs").select("id, repository, sha, committed_at, made_at").eq("repository","acme/api")';
const LATEST = 'order("committed_at",{"ascending":false}).order("made_at",{"ascending":false}).limit(1)';

describe('the pack', () => {
  it('is the newest one, the latest commit first when the caller reads several', async () => {
    const { db, lines } = fakeDb([{ data: [ROW], error: null }]);
    expect(await knowledgePacksRepository(db).pack('acme/api', null)).toEqual({ ok: true, value: ROW });
    expect(lines).toEqual([`${SELECT}.eq("newest",true).${LATEST}`]);
  });

  it('is the one of a commit when one is named', async () => {
    const { db, lines } = fakeDb([{ data: [ROW], error: null }]);
    await knowledgePacksRepository(db).pack('acme/api', SHA);
    expect(lines).toEqual([`${SELECT}.eq("sha","${SHA}").${LATEST}`]);
  });

  it('is none when nothing comes back, the database\'s refusal when it refuses, `shape` when out of shape', async () => {
    expect(await knowledgePacksRepository(fakeDb([{ data: [], error: null }]).db).pack('acme/api', null)).toEqual({ ok: true, value: null });
    expect(await knowledgePacksRepository(fakeDb([{ data: null, error: { code: 'XX000', message: 'down' } }]).db).pack('acme/api', null))
      .toEqual({ ok: false, code: 'XX000', message: 'down' });
    expect(await knowledgePacksRepository(fakeDb([{ data: [{ id: 1 }], error: null }]).db).pack('acme/api', null))
      .toEqual({ ok: false, code: 'shape', message: 'knowledge_packs answered out of shape' });
  });
});

describe('the files', () => {
  const files = (count: number, from = 0) => Array.from({ length: count }, (_, at) => ({ path: `k/${String(from + at)}.md`, sha256: 'f'.repeat(64), content: 'x' }));

  it('are read in path order, a thousand at a time, until a page comes back short', async () => {
    const { db, lines } = fakeDb([{ data: files(1000), error: null }, { data: files(2, 1000), error: null }]);
    const read = await knowledgePacksRepository(db).files('k-1');
    expect(read.ok && read.value.length).toBe(1002);
    expect(lines).toEqual([
      'from("knowledge_pack_files").select("path, sha256, content").eq("pack_id","k-1").order("path").range(0,999)',
      'from("knowledge_pack_files").select("path, sha256, content").eq("pack_id","k-1").order("path").range(1000,1999)',
    ]);
  });

  it('answer the database\'s refusal of any page', async () => {
    const { db } = fakeDb([{ data: files(1000), error: null }, { data: null, error: { code: '42501', message: 'no' } }]);
    expect(await knowledgePacksRepository(db).files('k-1')).toEqual({ ok: false, code: '42501', message: 'no' });
  });
});
