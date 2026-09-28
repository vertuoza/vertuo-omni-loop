import { describe, it, expect } from 'vitest';
import type { DossierListRow } from '../store';
import { filtered, historyAddress, historyChoices, historyItems, readHistoryFilters, type HistoryFilters } from './history';

// /prd, the history (PRD 216's spec, "The pages"), as pure functions of the rows dossier_list() gives the
// viewer and the filters in the address: newest activity first, filtered by repository — any of a
// dossier's repositories, so a dossier with three shows under each — and by draft or PRD, searched by the
// words of a title, each row opening /prd/<id>. PRD 413: Mine (the dossiers the viewer opened, the
// default) or All (`who=all`), which combines with every other filter and is never cleared.

const ALL = { who: 'all' } as const;
const all = (more: Omit<HistoryFilters, 'who'> = {}): HistoryFilters => ({ ...ALL, ...more });

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
    expect(readHistoryFilters({})).toEqual({ who: 'mine' });
    expect(readHistoryFilters({ repo: ' Vertuoza/Vertuo-Core ', state: 'draft', q: '  dossier  ' })).toEqual({
      who: 'mine', repo: 'vertuoza/vertuo-core', state: 'draft', search: 'dossier',
    });
    expect(readHistoryFilters({ state: 'prd' })).toEqual({ who: 'mine', state: 'prd' });
    expect(readHistoryFilters({ repo: '', state: 'shipped', q: ' ' })).toEqual({ who: 'mine' });
    expect(readHistoryFilters({ repo: ['a/b', 'c/d'] })).toEqual({ who: 'mine', repo: 'a/b' });
  });

  it('reads who=all as All; a missing, empty or unknown who is Mine', () => {
    expect(readHistoryFilters({ who: 'all' })).toEqual({ who: 'all' });
    expect(readHistoryFilters({ who: ' all ' })).toEqual({ who: 'all' });
    expect(readHistoryFilters({})).toEqual({ who: 'mine' });
    expect(readHistoryFilters({ who: '' })).toEqual({ who: 'mine' });
    expect(readHistoryFilters({ who: 'x' })).toEqual({ who: 'mine' });
    expect(readHistoryFilters({ who: 'mine' })).toEqual({ who: 'mine' });
    expect(readHistoryFilters({ who: 'ALL' })).toEqual({ who: 'mine' });
  });

  it('says whether any filter is set', () => {
    expect(filtered({ who: 'mine' })).toBe(false);
    expect(filtered({ who: 'mine', state: 'prd' })).toBe(true);
  });

  it('does not count who as a filter: clearing keeps it', () => {
    expect(filtered(ALL)).toBe(false);
    expect(filtered(all({ search: 'x' }))).toBe(true);
  });
});

describe('the addresses', () => {
  it('carries every filter, and who=all last only for All', () => {
    expect(historyAddress({ who: 'mine' })).toBe('/prd');
    expect(historyAddress(ALL)).toBe('/prd?who=all');
    expect(historyAddress({ who: 'mine', repo: 'vertuoza/vertuo-core', state: 'prd', search: 'ask mode' }))
      .toBe('/prd?repo=vertuoza%2Fvertuo-core&state=prd&q=ask+mode');
    expect(historyAddress(all({ repo: 'a/b', state: 'draft', search: 'x' }))).toBe('/prd?repo=a%2Fb&state=draft&q=x&who=all');
  });
});

describe('the rows', () => {
  it('lists every dossier newest activity first, each opening its page', () => {
    const items = historyItems(ROWS, ALL, 'u-pierre');
    expect(items.map((i) => i.title)).toEqual(['Offline quotes on the site app', 'PRD dossiers', 'Ask mode — questions on a page']);
    expect(items[1].href).toBe('/prd/00000000-0000-4000-8000-0000000000d1');
  });

  it('shows #n or DRAFT, the repository chips, which artifacts it has with how many versions, and answered out of asked', () => {
    const [quotes, dossiers, ask] = historyItems(ROWS, ALL, 'u-pierre');
    expect(dossiers).toMatchObject({
      heading: '#216', draft: false, repos: ['vertuoza/vertuo-omni-loop', 'vertuoza/vertuo-ai-domain', 'vertuoza/vertuo-core'],
      artifacts: [{ kind: 'before-after', label: 'Before/after', badge: 'v1' }, { kind: 'spec', label: 'Spec', badge: 'v3' }],
      questions: '11/12 answered', activity: 'last activity 28 Sep 2026, 08:00 UTC', at: '2026-09-28T08:00:00Z',
    });
    expect(quotes).toMatchObject({ heading: 'DRAFT', draft: true, artifacts: [], questions: '0/2 answered' });
    expect(ask).toMatchObject({ heading: '#71', artifacts: [{ kind: 'plan', label: 'Plan', badge: 'v1' }], questions: 'no question yet' });
  });

  it('keeps each dossier whose repositories include the one picked: one with three shows under each', () => {
    for (const repo of DOSSIERS.repos) expect(historyItems(ROWS, all({ repo }), 'u-pierre').map((i) => i.title), repo).toContain('PRD dossiers');
    expect(historyItems(ROWS, all({ repo: 'vertuoza/vertuo-omni-loop' }), 'u-pierre').map((i) => i.title)).toEqual(['PRD dossiers', 'Ask mode — questions on a page']);
    expect(historyItems(ROWS, all({ repo: 'vertuoza/vertuo-mobile' }), 'u-pierre').map((i) => i.title)).toEqual(['Offline quotes on the site app']);
    expect(historyItems(ROWS, all({ repo: 'vertuoza/elsewhere' }), 'u-pierre')).toEqual([]);
  });

  it('keeps the drafts, or the numbered PRDs', () => {
    expect(historyItems(ROWS, all({ state: 'draft' }), 'u-pierre').map((i) => i.heading)).toEqual(['DRAFT']);
    expect(historyItems(ROWS, all({ state: 'prd' }), 'u-pierre').map((i) => i.heading)).toEqual(['#216', '#71']);
  });

  it('finds a dossier by the words of its title, in any case, each word somewhere in it', () => {
    expect(historyItems(ROWS, all({ search: 'dossiers' }), 'u-pierre').map((i) => i.title)).toEqual(['PRD dossiers']);
    expect(historyItems(ROWS, all({ search: 'QUOTES site' }), 'u-pierre').map((i) => i.title)).toEqual(['Offline quotes on the site app']);
    expect(historyItems(ROWS, all({ search: 'quotes dossiers' }), 'u-pierre')).toEqual([]);
    expect(historyItems(ROWS, all({ search: 'on' }), 'u-pierre').map((i) => i.title)).toEqual(['Offline quotes on the site app', 'Ask mode — questions on a page']);
  });

  it('combines the filters', () => {
    expect(historyItems(ROWS, all({ repo: 'vertuoza/vertuo-omni-loop', state: 'prd', search: 'ask' }), 'u-pierre').map((i) => i.heading)).toEqual(['#71']);
  });
});

describe('Mine and All', () => {
  const PAULAS = row('00000000-0000-4000-8000-0000000000d4', {
    prd: 300, title: 'Paula\'s PRD', opened_by: 'u-paula', numbered_at: '2026-09-25T10:00:00Z', last_activity: '2026-09-25T10:00:00Z',
  });
  const FALLBACK = row('00000000-0000-4000-8000-0000000000d5', {
    prd: 301, title: 'Read from GitHub', opened_by: null, numbered_at: '2026-09-24T10:00:00Z', last_activity: '2026-09-24T10:00:00Z',
  });
  const EVERY = [...ROWS, PAULAS, FALLBACK];

  it('Mine keeps only the dossiers the viewer opened, drafts and numbered alike', () => {
    expect(historyItems(EVERY, { who: 'mine' }, 'u-pierre').map((i) => i.heading)).toEqual(['DRAFT', '#216', '#71']);
    expect(historyItems(EVERY, { who: 'mine' }, 'u-paula').map((i) => i.heading)).toEqual(['#300']);
  });

  it('Mine drops a dossier nobody opened, and keeps nothing for a viewer with none', () => {
    expect(historyItems(EVERY, { who: 'mine' }, 'u-pierre').map((i) => i.title)).not.toContain('Read from GitHub');
    expect(historyItems(EVERY, { who: 'mine' }, 'u-nobody')).toEqual([]);
    expect(historyItems(EVERY, { who: 'mine' }, null)).toEqual([]);
  });

  it('All keeps every dossier, whoever opened it', () => {
    expect(historyItems(EVERY, ALL, 'u-pierre').map((i) => i.heading)).toEqual(['DRAFT', '#216', '#300', '#301', '#71']);
    expect(historyItems(EVERY, ALL, null)).toHaveLength(5);
  });

  it('combines with the repository, the state and the search', () => {
    expect(historyItems(EVERY, { who: 'mine', state: 'prd' }, 'u-pierre').map((i) => i.heading)).toEqual(['#216', '#71']);
    expect(historyItems(EVERY, { who: 'mine', repo: 'vertuoza/vertuo-mobile' }, 'u-pierre').map((i) => i.heading)).toEqual(['DRAFT']);
    expect(historyItems(EVERY, { who: 'mine', search: 'ask' }, 'u-pierre').map((i) => i.heading)).toEqual(['#71']);
    expect(historyItems(EVERY, { who: 'mine', state: 'prd', search: 'paula' }, 'u-pierre')).toEqual([]);
    expect(historyItems(EVERY, all({ state: 'prd', search: 'paula' }), 'u-pierre').map((i) => i.heading)).toEqual(['#300']);
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
