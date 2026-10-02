import { describe, expect, it } from 'vitest';
import type { DossierRef } from '../../dossier/github/reader';
import { UNREAD, type GithubSummary, type OutboxItem, type PullRef } from '../../dossier/github/summary';
import { settled } from '../settled';
import { fakeStageStore } from '../store.fake';
import { countsOf, recountOutboxes } from './recount';
import { fakePrdOutboxStore } from './store.fake';

// PRD 657, s5: a PRD's open outbox questions, taken from its GitHub summary and stored in prd_outbox, so
// /prd and the waiting outbox read them without GitHub. A PRD at building or outbox stores its counts; a
// PRD at any other stage stores 0, and costs no GitHub read.

const W = 'w-vertuoza';
const REPO = 'vertuoza/vertuo-omni-loop';

const item = (id: string, rank: OutboxItem['rank']): OutboxItem => ({ id, rank, question: `Question of ${id}?`, decision: null, options: [], personSteps: null });
const pull = (state: PullRef['state']): PullRef => ({ number: 9, url: 'https://github.com/x/y/pull/9', state, draft: true });
const summary = (prd: number, more: Partial<GithubSummary> = {}): GithubSummary => ({
  repo: REPO, prd, folder: null, topic: null, issue: null, phase0: null, feature: pull('open'), retro: null, mergedSlices: 0,
  outbox: { open: [item('s1-01-a', 'high'), item('s1-02-b', 'medium'), item('s2-01-c', 'human-action')], settled: [] }, ...more,
});

describe('countsOf', () => {
  it('counts every open item, and keeps the human-action and high ones of an open feature PR as waiting', () => {
    expect(countsOf(summary(7))).toEqual({
      open_questions: 3,
      waiting: [
        { id: 's1-01-a', rank: 'high', question: 'Question of s1-01-a?' },
        { id: 's2-01-c', rank: 'human-action', question: 'Question of s2-01-c?' },
      ],
    });
  });

  it('waits on nobody once the feature PR merged, or when there is none', () => {
    expect(countsOf(summary(7, { feature: pull('merged') }))?.waiting).toEqual([]);
    expect(countsOf(summary(7, { feature: null }))).toEqual({ open_questions: 3, waiting: [] });
  });

  it('counts none for a PRD with no outbox yet', () => {
    expect(countsOf(summary(7, { outbox: null }))).toEqual({ open_questions: 0, waiting: [] });
    expect(countsOf(summary(7, { outbox: undefined }))).toEqual({ open_questions: 0, waiting: [] });
  });

  it('is null when the summary, its outbox or its feature PR could not be read', () => {
    expect(countsOf(null)).toBeNull();
    expect(countsOf(summary(7, { outbox: UNREAD }))).toBeNull();
    expect(countsOf(summary(7, { feature: UNREAD }))).toBeNull();
  });
});

function setUp(summaries: Record<number, GithubSummary | null | Error>) {
  const stages = fakeStageStore(() => '2026-09-29T10:00:00Z');
  const store = fakePrdOutboxStore(() => '2026-09-29T10:00:00Z');
  const asked: DossierRef[] = [];
  const logs: string[] = [];
  const deps = {
    stages,
    store,
    summary: (ref: DossierRef) => settled(() => {
      asked.push(ref);
      const answer = summaries[ref.prd];
      if (answer instanceof Error) throw answer;
      return answer ?? null;
    }),
    log: (line: string) => logs.push(line),
  };
  const at = (prd: number, stage: 'prd' | 'inbox' | 'building' | 'outbox' | 'shipped') =>
    stages.recordStages([{ workspace_id: W, repository: REPO, prd, stage, reached_at: '2026-09-01T00:00:00Z' }]);
  return { stages, store, asked, logs, deps, at };
}

describe('recountOutboxes', () => {
  it('stores the counts of a PRD at building or outbox, and 0 for any other, reading GitHub only for the first', async () => {
    const { store, asked, deps, at } = setUp({ 7: summary(7), 8: summary(8, { outbox: { open: [item('a', 'high')], settled: [] } }) });
    await at(7, 'building');
    await at(8, 'outbox');
    await at(9, 'shipped');
    await at(10, 'inbox');

    const recorded = await recountOutboxes(W, [7, 8, 9, 10, 11].map((prd) => ({ repository: REPO, prd })), deps);

    expect(recorded).toBe(5);
    expect(asked.map((r) => r.prd)).toEqual([7, 8]);
    expect(store.writes).toEqual([
      `${W} ${REPO}#7 3`, `${W} ${REPO}#8 1`, `${W} ${REPO}#9 0`, `${W} ${REPO}#10 0`, `${W} ${REPO}#11 0`,
    ]);
    expect(store.rows.find((r) => r.prd === 9)?.waiting).toEqual([]);
    expect(store.rows.find((r) => r.prd === 8)?.waiting).toEqual([{ id: 'a', rank: 'high', question: 'Question of a?' }]);
  });

  it('keeps what a PRD had when its summary cannot be read, and logs it', async () => {
    const { store, deps, at, logs } = setUp({ 7: null, 8: new Error('GitHub answered 502') });
    await at(7, 'building');
    await at(8, 'outbox');
    await store.record([{ workspace_id: W, repository: REPO, prd: 7, open_questions: 2, waiting: [] }]);
    store.writes.length = 0;

    const recorded = await recountOutboxes(W, [{ repository: REPO, prd: 7 }, { repository: REPO, prd: 8 }], deps);

    expect(recorded).toBe(0);
    expect(store.writes).toEqual([]);
    expect(store.rows.find((r) => r.prd === 7)?.open_questions).toBe(2);
    expect(logs.join('\n')).toContain(`${REPO}#8`);
  });

  it('asks the summary by the dossier id given, or else by a key of its own', async () => {
    const { asked, deps, at } = setUp({ 7: summary(7), 8: summary(8) });
    await at(7, 'outbox');
    await at(8, 'outbox');
    await recountOutboxes(W, [{ repository: REPO, prd: 7, id: 'd-7' }, { repository: 'Vertuoza/Vertuo-Omni-Loop', prd: 8 }], deps);
    expect(asked).toEqual([
      { id: 'd-7', home_repo: REPO, prd: 7 },
      { id: `prd-outbox ${W} ${REPO}#8`, home_repo: REPO, prd: 8 },
    ]);
  });

  it('records nothing for no PRD', async () => {
    const { store, deps } = setUp({});
    expect(await recountOutboxes(W, [], deps)).toBe(0);
    expect(store.writes).toEqual([]);
  });
});
