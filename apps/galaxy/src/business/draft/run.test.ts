import { describe, expect, it } from 'vitest';
import type { ClaimKind, StoredClaim } from '../model';
import type { Candidate } from './verify';
import { DraftStoreError, runDraft, type DraftCounts, type DraftDeps, type DraftStore, type Receipt, type Scanned } from './run';
import type { RepoListing } from './sources';
import { sure } from '../../arcade/sure';

// One run of the draft with fakes for the store, GitHub, the page fetch and the model: never Supabase,
// GitHub or OpenRouter. It reads each source, keeps only quoted candidates, merges them as decision 9
// says, tells the draft row what it read or skipped, and ends `done` (or `failed` when the store fails).

type Proposed = { product: string | null; kind: ClaimKind; value: string; receipts: Receipt[] };

const README = 'Vertuo is the ERP for construction firms in Belgium. Teams of 10 to 40 people use it.';
const PRICING = 'Pricing for contractors in France.';

function fakeStore(held: StoredClaim[] = [], { failPropose }: { failPropose?: string } = {}) {
  const proposed: Proposed[] = [];
  const progress: Array<{ counts: DraftCounts; scanned: Scanned[] }> = [];
  const finished: Array<{ state: string; counts: DraftCounts; scanned: Scanned[]; reason?: string | undefined }> = [];
  const store: DraftStore = {
    running: () => Promise.resolve(null),
    start: () => Promise.reject(new Error('not here')),
    progress(_ws, _d, counts, scanned) { progress.push({ counts: { ...counts }, scanned: [...scanned] }); return Promise.resolve(); },
    finish(_ws, _d, state, counts, scanned, reason) { finished.push({ state, counts: { ...counts }, scanned: [...scanned], reason }); return Promise.resolve(); },
    repositories: () => Promise.resolve([{ full_name: 'acme/app', product_id: 'p-1' }]),
    webPages: () => Promise.resolve(['https://acme.com/pricing']),
    firstProduct: () => Promise.resolve('p-1'),
    claims: () => Promise.resolve(held),
    propose(_ws, product, kind, value, receipts) {
      if (failPropose) return Promise.reject(new DraftStoreError('propose', failPropose, 'no'));
      proposed.push({ product, kind, value, receipts });
      const there = held.find((c) => c.kind === kind && c.value.toLowerCase() === value.toLowerCase());
      if (there) return Promise.resolve(there.state === 'rejected' ? 'rejected' : 'seen');
      return Promise.resolve('added');
    },
  };
  return { store, proposed, progress, finished };
}

const LISTING: RepoListing = { root: ['README.md'], docs: ['gone.md'], delivery: null, shipped: [] };

function deps(store: DraftStore, answers: Record<string, Candidate[]>, over: Partial<DraftDeps> = {}): DraftDeps {
  return {
    store,
    installation: () => Promise.resolve(11),
    github: {
      listing: () => Promise.resolve(LISTING),
      file: (_i, _r, path) => Promise.resolve(path === 'README.md' ? README : null),
    },
    page: () => Promise.resolve(PRICING),
    extract: (_text, where) => Promise.resolve(answers[where] ?? []),
    log: () => undefined,
    ...over,
  };
}

const ANSWERS: Record<string, Candidate[]> = {
  'acme/app/README.md': [
    { kind: 'offering', value: 'ERP', quote: 'Vertuo is the ERP for construction firms' },
    { kind: 'region', value: 'Belgium', quote: 'construction firms in   belgium' },
    { kind: 'size', value: '10-40', quote: 'Teams of 10 to 40 people' },
    { kind: 'rival', value: 'Acme Build', quote: 'Unlike Acme Build, we ship weekly' },
  ],
  'https://acme.com/pricing': [
    { kind: 'region', value: 'France', quote: 'contractors in France' },
    { kind: 'trade', value: 'construction', quote: 'Pricing for contractors' },
  ],
};

describe('runDraft', () => {
  it('writes the quoted candidates as proposals with their receipts, and ends done', async () => {
    const { store, proposed, finished, progress } = fakeStore([
      { id: 'c-1', seq: 1, kind: 'trade', value: 'construction', source: 'pick', state: 'rejected', product_id: 'p-1' },
    ]);
    await runDraft(deps(store, ANSWERS), 'ws-1', 'd-1');

    expect(proposed).toEqual([
      { product: 'p-1', kind: 'offering', value: 'ERP', receipts: [{ kind: 'file', where: 'acme/app/README.md', quote: 'Vertuo is the ERP for construction firms' }] },
      { product: null, kind: 'region', value: 'Belgium', receipts: [{ kind: 'file', where: 'acme/app/README.md', quote: 'construction firms in   belgium' }] },
      { product: 'p-1', kind: 'size', value: '10-50', receipts: [{ kind: 'file', where: 'acme/app/README.md', quote: 'Teams of 10 to 40 people' }] },
      { product: null, kind: 'region', value: 'France', receipts: [{ kind: 'link', where: 'https://acme.com/pricing', quote: 'contractors in France' }] },
    ]);
    expect(finished).toHaveLength(1);
    expect(sure(finished[0], 'finished[0]').state).toBe('done');
    expect(sure(finished[0], 'finished[0]').counts).toMatchObject({ readmes: 1, docs: 0, prds: 0, pages: 1, skipped: 1, found: 6, kept: 5, added: 4, rejected: 1 });
    expect(sure(finished[0], 'finished[0]').scanned).toEqual([
      { source: 'app · README.md', state: 'read' },
      { source: 'app · docs/gone.md', state: 'skipped', why: 'nothing there' },
      { source: 'acme.com/pricing', state: 'read' },
    ]);
    expect(progress.map((p) => p.scanned.length)).toEqual([1, 2, 3]);
  });

  it('skips a page it may not read and carries on', async () => {
    const { store, finished } = fakeStore();
    await runDraft(deps(store, ANSWERS, { page: () => Promise.reject(new Error('That address is not on the public internet.')) }), 'ws-1', 'd-1');
    expect(sure(finished[0], 'finished[0]').state).toBe('done');
    expect(sure(finished[0], 'finished[0]').scanned.at(-1)).toEqual({ source: 'acme.com/pricing', state: 'skipped', why: 'That address is not on the public internet.' });
  });

  it('skips every repository when the App is not installed', async () => {
    const { store, finished } = fakeStore();
    await runDraft(deps(store, ANSWERS, { installation: () => Promise.resolve(null) }), 'ws-1', 'd-1');
    expect(sure(finished[0], 'finished[0]').scanned[0]).toEqual({ source: 'app', state: 'skipped', why: 'The Omni Loop App is not installed here.' });
    expect(sure(finished[0], 'finished[0]').counts.pages).toBe(1);
  });

  it('reads nothing and finds nothing with the model key unset', async () => {
    const { store, proposed, finished } = fakeStore();
    let listed = 0;
    await runDraft(deps(store, ANSWERS, { extract: null, github: { listing: () => { listed += 1; return Promise.resolve(LISTING); }, file: () => Promise.resolve(null) } }), 'ws-1', 'd-1');
    expect(listed).toBe(0);
    expect(proposed).toEqual([]);
    expect(finished[0]).toMatchObject({ state: 'done', scanned: [], counts: { kept: 0, added: 0 } });
  });

  it('drops a candidate the database finds invalid, and ends failed when the store refuses', async () => {
    const invalid = fakeStore([], { failPropose: '22023' });
    await runDraft(deps(invalid.store, ANSWERS), 'ws-1', 'd-1');
    expect(sure(invalid.finished[0], 'invalid.finished[0]').state).toBe('done');

    const refused = fakeStore([], { failPropose: '42501' });
    await runDraft(deps(refused.store, ANSWERS), 'ws-1', 'd-1');
    expect(refused.finished).toHaveLength(1);
    expect(refused.finished[0]).toMatchObject({ state: 'failed', reason: 'The business database could not answer. Try again.' });
  });

  it('never proposes a Never line, even one an extractor answers (PRD 871)', async () => {
    const { store, proposed, finished } = fakeStore();
    const page = 'Pricing for contractors in France. We don\'t answer public tenders.';
    const answers = { 'https://acme.com/pricing': [{ kind: 'never' as const, value: 'Answer public tenders', quote: 'we don\'t answer public tenders' }] };
    await runDraft(deps(store, answers, { page: () => Promise.resolve(page) }), 'ws-1', 'd-1');
    expect(proposed.filter((p) => p.kind === 'never')).toEqual([]);
    expect(sure(finished[0], 'finished[0]').counts).toMatchObject({ kept: 0, added: 0 });
  });

  it('proposes a value found twice once as new, then as seen', async () => {
    const { store, proposed, finished } = fakeStore();
    const both = { ...ANSWERS, 'https://acme.com/pricing': [{ kind: 'offering' as const, value: 'erp', quote: 'Pricing for contractors' }] };
    await runDraft(deps(store, both), 'ws-1', 'd-1');
    expect(proposed.filter((p) => p.kind === 'offering')).toHaveLength(2);
    expect(sure(finished[0], 'finished[0]').counts.added).toBe(3);
  });
});
