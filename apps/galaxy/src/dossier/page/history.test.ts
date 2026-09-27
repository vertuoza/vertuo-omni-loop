import { describe, it, expect } from 'vitest';
import type { DossierListRow } from '../store';
import { filtered, historyChoices, historyItems, readHistoryFilters } from './history';

// /prd, the history (PRD 216's spec, "The pages"), as pure functions of the rows dossier_list() gives the
// viewer and the filters in the address: newest activity first, filtered by repository — any of a
// dossier's repositories, so a dossier with three shows under each — and by draft or PRD, searched by the
// words of a title, each row opening /prd/<id>.

const row = (id: string, more: Partial<DossierListRow> = {}): DossierListRow => ({
  id, workspace_id: 'w1', home_repo: 'vertuoza/vertuo-omni-loop', prd: null, title: 'An idea', opened_by: 'u-pierre',
  created_at: '2026-09-20T09:00:00Z', numbered_at: null, repos: ['vertuoza/vertuo-omni-loop'], latest: {}, asked: 0, answered: 0,
  last_activity: '2026-09-20T09:00:00Z', ...more,
});

const DOSSIERS = row('00000000-0000-4000-8000-0000000000d1', {
  prd: 216, title: 'PRD dossiers', numbered_at: '2026-09-27T10:00:00Z',
  repos: ['vertuoza/vertuo-omni-loop', 'vertuoza/vertuo-ai-domain', 'vertuoza/vertuo-core'],
  latest: {
    spec: { id: 's3', version: 3, source: 'github', created_at: '2026-09-28T08:00:00Z' },
    'before-after': { id: 'b1', version: 1, source: 'kit', created_at: '2026-09-27T10:00:00Z' },
  },
  asked: 12, answered: 11, last_activity: '2026-09-28T08:00:00Z',
});
const QUOTES = row('00000000-0000-4000-8000-0000000000d2', {
  title: 'Offline quotes on the site app', repos: ['vertuoza/vertuo-mobile'], home_repo: 'vertuoza/vertuo-mobile',
  asked: 2, answered: 0, last_activity: '2026-09-28T09:30:00Z',
});
const ASK = row('00000000-0000-4000-8000-0000000000d3', {
  prd: 71, title: 'Ask mode — questions on a page', numbered_at: '2026-09-10T10:00:00Z',
  latest: { plan: { id: 'p1', version: 1, source: 'kit', created_at: '2026-09-10T11:00:00Z' } }, last_activity: '2026-09-12T08:00:00Z',
});
const ROWS = [ASK, DOSSIERS, QUOTES];

describe('the filters in the address', () => {
  it('reads a repository, draft or PRD, and a search; anything else is no filter', () => {
    expect(readHistoryFilters({})).toEqual({});
    expect(readHistoryFilters({ repo: ' Vertuoza/Vertuo-Core ', state: 'draft', q: '  dossier  ' })).toEqual({
      repo: 'vertuoza/vertuo-core', state: 'draft', search: 'dossier',
    });
    expect(readHistoryFilters({ state: 'prd' })).toEqual({ state: 'prd' });
    expect(readHistoryFilters({ repo: '', state: 'shipped', q: ' ' })).toEqual({});
    expect(readHistoryFilters({ repo: ['a/b', 'c/d'] })).toEqual({ repo: 'a/b' });
  });

  it('says whether any filter is set', () => {
    expect(filtered({})).toBe(false);
    expect(filtered({ state: 'prd' })).toBe(true);
  });
});

describe('the rows', () => {
  it('lists every dossier newest activity first, each opening its page', () => {
    const items = historyItems(ROWS, {});
    expect(items.map((i) => i.title)).toEqual(['Offline quotes on the site app', 'PRD dossiers', 'Ask mode — questions on a page']);
    expect(items[1].href).toBe('/prd/00000000-0000-4000-8000-0000000000d1');
  });

  it('shows #n or DRAFT, the repository chips, which artifacts it has with how many versions, and answered out of asked', () => {
    const [quotes, dossiers, ask] = historyItems(ROWS, {});
    expect(dossiers).toMatchObject({
      heading: '#216', draft: false, repos: ['vertuoza/vertuo-omni-loop', 'vertuoza/vertuo-ai-domain', 'vertuoza/vertuo-core'],
      artifacts: [{ kind: 'before-after', label: 'Before/after', badge: 'v1' }, { kind: 'spec', label: 'Spec', badge: 'v3' }],
      questions: '11/12 answered', activity: 'last activity 28 Sep 2026, 08:00 UTC', at: '2026-09-28T08:00:00Z',
    });
    expect(quotes).toMatchObject({ heading: 'DRAFT', draft: true, artifacts: [], questions: '0/2 answered' });
    expect(ask).toMatchObject({ heading: '#71', artifacts: [{ kind: 'plan', label: 'Plan', badge: 'v1' }], questions: 'no question yet' });
  });

  it('keeps each dossier whose repositories include the one picked: one with three shows under each', () => {
    for (const repo of DOSSIERS.repos) expect(historyItems(ROWS, { repo }).map((i) => i.title), repo).toContain('PRD dossiers');
    expect(historyItems(ROWS, { repo: 'vertuoza/vertuo-omni-loop' }).map((i) => i.title)).toEqual(['PRD dossiers', 'Ask mode — questions on a page']);
    expect(historyItems(ROWS, { repo: 'vertuoza/vertuo-mobile' }).map((i) => i.title)).toEqual(['Offline quotes on the site app']);
    expect(historyItems(ROWS, { repo: 'vertuoza/elsewhere' })).toEqual([]);
  });

  it('keeps the drafts, or the numbered PRDs', () => {
    expect(historyItems(ROWS, { state: 'draft' }).map((i) => i.heading)).toEqual(['DRAFT']);
    expect(historyItems(ROWS, { state: 'prd' }).map((i) => i.heading)).toEqual(['#216', '#71']);
  });

  it('finds a dossier by the words of its title, in any case, each word somewhere in it', () => {
    expect(historyItems(ROWS, { search: 'dossiers' }).map((i) => i.title)).toEqual(['PRD dossiers']);
    expect(historyItems(ROWS, { search: 'QUOTES site' }).map((i) => i.title)).toEqual(['Offline quotes on the site app']);
    expect(historyItems(ROWS, { search: 'quotes dossiers' })).toEqual([]);
    expect(historyItems(ROWS, { search: 'on' }).map((i) => i.title)).toEqual(['Offline quotes on the site app', 'Ask mode — questions on a page']);
  });

  it('combines the filters', () => {
    expect(historyItems(ROWS, { repo: 'vertuoza/vertuo-omni-loop', state: 'prd', search: 'ask' }).map((i) => i.heading)).toEqual(['#71']);
  });
});

describe('what the repository filter offers', () => {
  it('every repository of every dossier, once each, in order', () => {
    expect(historyChoices(ROWS).repos).toEqual([
      'vertuoza/vertuo-ai-domain', 'vertuoza/vertuo-core', 'vertuoza/vertuo-mobile', 'vertuoza/vertuo-omni-loop',
    ]);
    expect(historyChoices([]).repos).toEqual([]);
  });
});

describe('the open questions (PRD 251)', () => {
  const waiting = row('00000000-0000-4000-8000-0000000000d4', { prd: 251, title: 'Answer the outbox anywhere', open_questions: 3 });
  const rows = [...ROWS, waiting, row('00000000-0000-4000-8000-0000000000d5', { title: 'Quiet', open_questions: 0 })];

  it('shows n open on a row whose outbox has open questions, and nothing on the others', () => {
    const items = historyItems(rows, {});
    expect(items.find((i) => i.id === waiting.id)?.open).toBe('3 open');
    expect(items.filter((i) => i.id !== waiting.id).map((i) => i.open)).toEqual([null, null, null, null]);
  });

  it('reads Needs an answer from the address, and keeps only the rows with open questions', () => {
    expect(readHistoryFilters({ needs: 'answer' })).toEqual({ needsAnswer: true });
    expect(readHistoryFilters({ needs: 'nonsense' })).toEqual({});
    expect(filtered({ needsAnswer: true })).toBe(true);
    expect(historyItems(rows, { needsAnswer: true }).map((i) => i.id)).toEqual([waiting.id]);
  });
});
