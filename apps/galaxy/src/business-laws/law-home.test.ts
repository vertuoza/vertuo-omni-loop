import { describe, expect, it } from 'vitest';
import type { KnowledgePacksDb } from '../knowledge-packs/knowledge-packs.repository';
import { businessReader, type BusinessRpc } from '../business-api/read';
import { lawHomeOf, lawsOfPackFiles, readProductLaws } from './law-home';

// A product's laws from its law home's newest pack (PRD 2632, s2): read as the caller, merged laws only, none
// for a stranger or for a product with no home. The database is a fake that answers each query in order.

const ROOT = '.omni-loop/knowledge';
const QUOTES = `## BL-QUOTES-1\nA quote is sent only with a total above zero.\nWhy: An empty quote loses the customer.\nAlso: invoicing\n`;
const PRODUCT = `## BL-PRODUCT-1\nEvery amount shows its currency.\nWhy: Two currencies once looked the same.\n`;
const FILES = [
  { path: `${ROOT}/domains/quotes/business-laws.md`, content: QUOTES },
  { path: `${ROOT}/product/business-laws.md`, content: PRODUCT },
  { path: `${ROOT}/repos/backend/domains/quotes/business-laws.md`, content: '## BL-QUOTES-9\nA copy.\nWhy: x\n' },
  { path: `${ROOT}/domains/quotes/rules.md`, content: '## R-QUOTES-1\nNot a business law.\n' },
  { path: `${ROOT}/domains/a/b/business-laws.md`, content: '## BL-A-1\nToo deep.\nWhy: x\n' },
];
const PACK = { id: 'k-1', repository: 'acme/plan', sha: 'c'.repeat(40), committed_at: '2026-11-01T09:00:00Z', made_at: '2026-11-01T09:01:00Z' };

type Answer = { data: unknown; error: { code?: string; message?: string } | null };

function fakeDb(answers: Answer[]): { db: KnowledgePacksDb; lines: string[] } {
  const lines: string[] = [];
  const chain = (line: string[]): unknown => new Proxy({}, {
    get(_, key: string) {
      if (key === 'then') {
        lines.push(line.join('.'));
        const answer = answers.shift() ?? { data: null, error: { message: 'no answer left' } };
        return (resolve: (value: Answer) => unknown) => resolve(answer);
      }
      return (...args: unknown[]) => chain([...line, `${key}(${args.map((a) => JSON.stringify(a)).join(',')})`]);
    },
  });
  return { db: { from: (table: string) => chain([`from(${JSON.stringify(table)})`]) } as unknown as KnowledgePacksDb, lines };
}

describe('the law home of a business read', () => {
  it('is the repository the read names, in lower case, and none without one', () => {
    expect(lawHomeOf({ lawHome: 'Acme/Plan' })).toBe('acme/plan');
    expect(lawHomeOf({ lawHome: null })).toBeNull();
    expect(lawHomeOf({})).toBeNull();
    expect(lawHomeOf({ lawHome: '' })).toBeNull();
  });

  it('is accepted by the business read, which refuses a key it does not know', async () => {
    const body = { state: 'none', business: null, product: null, claims: [], personas: [], legal: [], glossary: [] };
    const rpc = (data: unknown): BusinessRpc => ({ rpc: () => Promise.resolve({ data, error: null }) });
    expect((await businessReader(rpc({ ...body, lawHome: 'acme/plan' })).forRepo('acme/api')).lawHome).toBe('acme/plan');
    expect((await businessReader(rpc({ ...body, lawHome: null })).forRepo('acme/api')).lawHome).toBeNull();
    expect((await businessReader(rpc(body)).forRepo('acme/api')).lawHome).toBeUndefined();
  });
});

describe('the laws of a pack', () => {
  it('are product/ first, then each domain folder, never an imported copy, another file or a deeper folder', () => {
    const laws = lawsOfPackFiles(FILES);
    expect(laws.map(({ id, scope, domain, also }) => [id, scope, domain, also])).toEqual([
      ['BL-PRODUCT-1', 'product', 'product', []],
      ['BL-QUOTES-1', 'domain', 'quotes', ['invoicing']],
    ]);
  });

  it('read where the knowledge root says', () => {
    const files = [{ path: 'docs/knowledge/product/business-laws.md', content: PRODUCT }];
    expect(lawsOfPackFiles(files)).toEqual([]);
    expect(lawsOfPackFiles(files, 'docs/knowledge').map(({ id }) => id)).toEqual(['BL-PRODUCT-1']);
  });
});

describe('a product\'s laws', () => {
  it('are the newest pack of its law home, read as the caller', async () => {
    const { db, lines } = fakeDb([{ data: [PACK], error: null }, { data: FILES.map((f) => ({ ...f, sha256: 'x' })), error: null }]);
    const read = await readProductLaws({ db, home: 'acme/plan' });
    expect(read).toMatchObject({ state: 'read', home: 'acme/plan', sha: PACK.sha, committedAt: PACK.committed_at });
    expect(read.state === 'read' && read.laws.map(({ id }) => id)).toEqual(['BL-PRODUCT-1', 'BL-QUOTES-1']);
    expect(lines[0]).toContain('.eq("repository","acme/plan").eq("newest",true)');
  });

  it('are none, and nothing is asked, for a product with no law home', async () => {
    const { db, lines } = fakeDb([]);
    expect(await readProductLaws({ db, home: null })).toEqual({ state: 'none', why: 'no-law-home', home: null });
    expect(lines).toEqual([]);
  });

  it('are none for a caller who reads no pack of the home: a member of another workspace, or no pack yet', async () => {
    const { db } = fakeDb([{ data: [], error: null }]);
    expect(await readProductLaws({ db, home: 'acme/plan' })).toEqual({ state: 'none', why: 'no-pack', home: 'acme/plan' });
  });

  it('are none, never a failure, when the database refuses or answers out of shape', async () => {
    expect(await readProductLaws({ db: fakeDb([{ data: null, error: { code: '42501', message: 'no' } }]).db, home: 'acme/plan' })).toEqual({ state: 'none', why: 'unreadable', home: 'acme/plan' });
    expect(await readProductLaws({ db: fakeDb([{ data: [PACK], error: null }, { data: null, error: { message: 'down' } }]).db, home: 'acme/plan' })).toEqual({ state: 'none', why: 'unreadable', home: 'acme/plan' });
  });
});
