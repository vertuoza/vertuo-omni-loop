import { describe, expect, it } from 'vitest';
import type { ConceptFacts, FixSummary } from '../../dossier/github/fix';
import type { ConceptReader, FixReader, FixRef } from '../../dossier/github/reader';
import { UNREAD } from '../../dossier/github/summary';
import { isConceptFinal, mergeFacts, refreshConceptFacts, refreshFixFacts } from './refresh';
import { fakeConceptFactsStore, fakeFixFactsStore } from './store.fake';
import { parseIssue, parsePr } from 'vertuo-omni-plan/kit/lib/ids.ts';

// PRD 691, s1: what GitHub says of each fix, read through the reader and stored in fix_facts, so /bugs and
// /visual render without GitHub. A part GitHub could not read keeps what was stored; a fix whose whole
// read failed keeps its row; a fix whose stored facts hold a release is final and is not read again.

const W = 'w-vertuoza';
const REPO = 'vertuoza/vertuo-omni-loop';
const NOW = '2026-09-29T10:00:00Z';

const ref = (id: string, prd: number): FixRef => ({ id, home_repo: REPO, prd: parseIssue(prd) });
const issue = (n: number) => ({ number: parseIssue(n), url: `https://github.com/${REPO}/issues/${n}`, state: 'open' as const, author: 'ada', createdAt: '2026-09-28T09:00:00Z', risk: 'omni:risk-high', regression: false });
const pull = (n: number) => ({ number: parsePr(n), url: `https://github.com/${REPO}/pull/${n}`, state: 'merged' as const, mergedAt: '2026-09-28T12:00:00Z', mergedBy: 'bob' });
const release = { tag: 'v0.0.99', url: `https://github.com/${REPO}/releases/tag/v0.0.99`, at: '2026-09-28T13:00:00Z' };

const summary = (more: Partial<FixSummary> = {}): FixSummary => ({ issue: issue(601), pull: null, approvals: [], release: null, ...more });

/** A reader answering from `answers` by dossier id, recording every read; a missing id throws. */
function stubReader(answers: Record<string, FixSummary | null>) {
  const reads: string[] = [];
  const reader: FixReader = {
    fix(r) {
      reads.push(r.id);
      if (!(r.id in answers)) return Promise.reject(new Error(`GitHub did not answer for ${r.id}`));
      return Promise.resolve(answers[r.id] ?? null);
    },
  };
  return { reader, reads };
}

const quiet = { log: () => {} };

describe('refreshFixFacts', () => {
  it('reads a fix and stores what GitHub said, in the workspace, at now', async () => {
    const store = fakeFixFactsStore();
    const { reader, reads } = stubReader({ d1: summary() });
    const result = await refreshFixFacts(W, [ref('d1', 601)], { reader, store, now: () => NOW, ...quiet });
    expect(reads).toEqual(['d1']);
    expect(store.rows).toEqual([{ dossier_id: 'd1', workspace_id: W, facts: summary(), synced_at: NOW }]);
    expect(result).toEqual({ read: 1, stored: 1, final: 0, failed: 0 });
  });

  it('keeps the stored value of a part GitHub could not read', async () => {
    const store = fakeFixFactsStore();
    const known = summary({ pull: pull(610), approvals: [{ login: 'cy', at: '2026-09-28T11:00:00Z' }] });
    store.rows.push({ dossier_id: 'd1', workspace_id: W, facts: known, synced_at: '2026-09-29T09:00:00Z' });
    const { reader } = stubReader({ d1: { issue: { ...issue(601), state: 'closed' }, pull: UNREAD, approvals: UNREAD, release: UNREAD } });
    await refreshFixFacts(W, [ref('d1', 601)], { reader, store, now: () => NOW, ...quiet });
    expect(store.rows).toEqual([{
      dossier_id: 'd1', workspace_id: W, synced_at: NOW,
      facts: { issue: { ...issue(601), state: 'closed' }, pull: pull(610), approvals: [{ login: 'cy', at: '2026-09-28T11:00:00Z' }], release: null },
    }]);
  });

  it('stores an unread part as unread when nothing was stored before', async () => {
    const store = fakeFixFactsStore();
    const { reader } = stubReader({ d1: summary({ issue: UNREAD }) });
    await refreshFixFacts(W, [ref('d1', 601)], { reader, store, now: () => NOW, ...quiet });
    expect(store.rows[0]?.facts.issue).toBe(UNREAD);
  });

  it('keeps the row of a fix whose whole read failed, or that GitHub could not be asked about, and logs the failure', async () => {
    const store = fakeFixFactsStore();
    const kept = { dossier_id: 'd1', workspace_id: W, facts: summary(), synced_at: '2026-09-29T09:00:00Z' };
    store.rows.push(kept);
    const logged: unknown[] = [];
    const { reader } = stubReader({ d2: null });
    const result = await refreshFixFacts(W, [ref('d1', 601), ref('d2', 602)], { reader, store, now: () => NOW, log: (e) => logged.push(e) });
    expect(store.rows).toEqual([kept]);
    expect(store.writes).toEqual([]);
    expect(logged).toHaveLength(1);
    expect(result).toEqual({ read: 2, stored: 0, final: 0, failed: 2 });
  });

  it('does not read a fix whose stored facts hold a release', async () => {
    const store = fakeFixFactsStore();
    const final = { dossier_id: 'd1', workspace_id: W, facts: summary({ pull: pull(610), release }), synced_at: '2026-09-29T09:00:00Z' };
    const unread = { dossier_id: 'd2', workspace_id: W, facts: summary({ release: UNREAD }), synced_at: '2026-09-29T09:00:00Z' };
    store.rows.push(final, unread);
    const { reader, reads } = stubReader({ d2: summary() });
    const result = await refreshFixFacts(W, [ref('d1', 601), ref('d2', 602)], { reader, store, now: () => NOW, ...quiet });
    expect(reads).toEqual(['d2']);
    expect(store.rows.find((r) => r.dossier_id === 'd1')).toEqual(final);
    expect(result).toEqual({ read: 1, stored: 1, final: 1, failed: 0 });
  });

  it('reads the store once and writes once, whatever the number of fixes, and nothing for none', async () => {
    const store = fakeFixFactsStore();
    const { reader } = stubReader({ d1: summary(), d2: summary(), d3: summary() });
    await refreshFixFacts(W, [ref('d1', 601), ref('d2', 602), ref('d3', 603)], { reader, store, now: () => NOW, ...quiet });
    expect(store.reads).toEqual([`${W} 3`]);
    expect(store.writes).toHaveLength(1);
    const empty = fakeFixFactsStore();
    expect(await refreshFixFacts(W, [], { reader, store: empty, ...quiet })).toEqual({ read: 0, stored: 0, final: 0, failed: 0 });
    expect(empty.reads).toEqual([]);
    expect(empty.writes).toEqual([]);
  });
});

describe('mergeFacts', () => {
  it('takes each read part, and the stored one for each part left unread', () => {
    const stored = summary({ pull: pull(610), release });
    expect(mergeFacts(null, summary({ issue: UNREAD }))).toEqual(summary({ issue: UNREAD }));
    expect(mergeFacts(stored, { issue: UNREAD, pull: UNREAD, approvals: [], release: UNREAD })).toEqual({ ...stored, approvals: [] });
  });
});

describe('refreshConceptFacts (PRD 1272, s4)', () => {
  const open = { ...pull(1270), state: 'open' as const, mergedAt: null, mergedBy: null };
  const merged = { ...pull(1270), mergedBy: null };

  function conceptReader(answers: Record<string, ConceptFacts | null>) {
    const reads: string[] = [];
    const reader: ConceptReader = {
      concept(r) {
        reads.push(r.id);
        if (!(r.id in answers)) return Promise.reject(new Error(`GitHub did not answer for ${r.id}`));
        return Promise.resolve(answers[r.id] ?? null);
      },
    };
    return { reader, reads };
  }

  it('reads a concept until its pull request has merged, and not after', async () => {
    const store = fakeConceptFactsStore();
    const { reader, reads } = conceptReader({ c1: { issue: issue(1269), pull: open }, c2: { issue: issue(746), pull: merged } });
    expect(await refreshConceptFacts(W, [ref('c1', 1269), ref('c2', 746)], { reader, store, now: () => NOW, ...quiet }))
      .toEqual({ read: 2, stored: 2, final: 0, failed: 0 });
    expect(await refreshConceptFacts(W, [ref('c1', 1269), ref('c2', 746)], { reader, store, now: () => NOW, ...quiet }))
      .toEqual({ read: 1, stored: 1, final: 1, failed: 0 });
    expect(reads).toEqual(['c1', 'c2', 'c1']);
  });

  it('keeps a stored part GitHub could not read, and a concept whose whole read failed', async () => {
    const store = fakeConceptFactsStore();
    await store.writeFacts([{ dossier_id: 'c1', workspace_id: W, facts: { issue: issue(1269), pull: open } }]);
    const { reader } = conceptReader({ c1: { issue: UNREAD, pull: UNREAD } });
    expect(await refreshConceptFacts(W, [ref('c1', 1269), ref('c3', 1300)], { reader, store, now: () => NOW, ...quiet }))
      .toEqual({ read: 2, stored: 1, final: 0, failed: 1 });
    expect(store.rows.map((r) => [r.dossier_id, r.facts])).toEqual([['c1', { issue: issue(1269), pull: open }]]);
  });

  it('is final once the stored pull request has merged, whatever else could not be read', () => {
    expect(isConceptFinal({ issue: UNREAD, pull: merged })).toBe(true);
    expect(isConceptFinal({ issue: issue(1269), pull: open })).toBe(false);
    expect(isConceptFinal({ issue: issue(1269), pull: UNREAD })).toBe(false);
    expect(isConceptFinal(null)).toBe(false);
  });
});
