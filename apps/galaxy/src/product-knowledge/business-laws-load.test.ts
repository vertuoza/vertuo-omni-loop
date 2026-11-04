import { describe, expect, it, vi } from 'vitest';
import type { KnowledgePacksDb } from '../knowledge-packs/knowledge-packs.repository';
import { readLawsOf } from './business-laws-load';

vi.mock('server-only', () => ({}));
vi.mock('./constituents/knowledge-reader', () => ({ knowledgeReader: () => Promise.resolve({ kind: 'unreadable' }) }));

// The laws the section reads from a law home's newest pack (PRD 2632 s6): the knowledge folder and the owners
// come from the pack's own config, a stranger reads no pack, and a failed read says so. The database is a fake.

type Answer = { data: unknown; error: { code?: string; message?: string } | null };

function fakeDb(answers: Answer[]): KnowledgePacksDb {
  const chain = (): unknown => new Proxy({}, {
    get(_, key: string) {
      if (key === 'then') {
        const answer = answers.shift() ?? { data: null, error: { message: 'no answer left' } };
        return (resolve: (value: Answer) => unknown) => resolve(answer);
      }
      return () => chain();
    },
  });
  return { from: () => chain() } as unknown as KnowledgePacksDb;
}

const PACK = { id: 'k-1', repository: 'acme/plan', sha: 'c'.repeat(40), committed_at: '2026-11-01T09:00:00Z', made_at: '2026-11-01T09:01:00Z' };
const LAW = '## BL-QUOTES-1\nA quote is sent only with a total above zero.\nWhy: An empty quote loses the customer.\n';

describe('the laws of a law home', () => {
  it('reads the laws of the pack, in the folder its config names, owned by its laws.owners', async () => {
    const config = 'kit: 1\npaths:\n  knowledge: docs/knowledge/\nlaws:\n  owners:\n    - pm\n    - login: lead\n      delegate: pm\n';
    const files = [
      { path: 'docs/knowledge/domains/quotes/business-laws.md', sha256: 'a', content: LAW },
      { path: '.omni-loop/knowledge/domains/quotes/business-laws.md', sha256: 'b', content: LAW.replace('QUOTES-1', 'QUOTES-2') },
      { path: '.omni-loop/config.yml', sha256: 'c', content: config },
    ];
    const read = await readLawsOf(fakeDb([{ data: [PACK], error: null }, { data: files, error: null }]), 'acme/plan');
    expect(read.state).toBe('read');
    if (read.state !== 'read') return;
    expect(read.laws.map((l) => l.id)).toEqual(['BL-QUOTES-1']);
    expect(read.owners).toEqual(['pm', 'lead']);
    expect(read.sha).toBe(PACK.sha);
  });

  it('uses the default folder and no owner when the pack holds no config, or one it cannot read', async () => {
    const file = { path: '.omni-loop/knowledge/domains/quotes/business-laws.md', sha256: 'a', content: LAW };
    for (const extra of [[], [{ path: '.omni-loop/config.yml', sha256: 'c', content: ': : not yaml [' }]]) {
      const read = await readLawsOf(fakeDb([{ data: [PACK], error: null }, { data: [file, ...extra], error: null }]), 'acme/plan');
      expect(read).toMatchObject({ state: 'read', owners: [] });
      expect(read.state === 'read' && read.laws).toHaveLength(1);
    }
  });

  it('says there is no pack yet for a home with none, and that it cannot be read when the database refuses', async () => {
    expect(await readLawsOf(fakeDb([{ data: [], error: null }]), 'acme/plan')).toEqual({ state: 'none', why: 'no-pack' });
    expect(await readLawsOf(fakeDb([{ data: null, error: { code: '42501', message: 'denied' } }]), 'acme/plan')).toEqual({ state: 'none', why: 'unreadable' });
    expect(await readLawsOf(fakeDb([{ data: [PACK], error: null }, { data: null, error: { message: 'boom' } }]), 'acme/plan')).toEqual({ state: 'none', why: 'unreadable' });
  });
});
