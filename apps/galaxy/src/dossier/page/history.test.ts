import { describe, it, expect, vi } from 'vitest';
import { fakePrdOutboxStore } from '../../stages/outbox/store.fake';
import type { DossierListRow } from '../store';
import {
  filtered, historyAddress, historyChoices, historyItems, historyStageBar, historyToRead, readCurrentStages, readHistoryFilters, readLoginIds,
  readOpenCounts, stageKeyOf, type CurrentStages, type HistoryFilters, type OpenCounts,
} from './history';

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

  it('reads who=all as All; a missing, empty or malformed who is Mine', () => {
    expect(readHistoryFilters({ who: 'all' })).toEqual({ who: 'all' });
    expect(readHistoryFilters({ who: ' all ' })).toEqual({ who: 'all' });
    expect(readHistoryFilters({})).toEqual({ who: 'mine' });
    expect(readHistoryFilters({ who: '' })).toEqual({ who: 'mine' });
    expect(readHistoryFilters({ who: 'mine' })).toEqual({ who: 'mine' });
    expect(readHistoryFilters({ who: 'ALL' })).toEqual({ who: 'mine' });
    expect(readHistoryFilters({ who: 'Mine' })).toEqual({ who: 'mine' });
    for (const bad of ['-ada', 'ada-', 'a--b', 'a b', 'ada/../x', 'a'.repeat(40)]) expect(readHistoryFilters({ who: bad }), bad).toEqual({ who: 'mine' });
  });

  it('reads who=<login> as that person, the login in lower case (PRD 698)', () => {
    expect(readHistoryFilters({ who: 'x' })).toEqual({ who: { login: 'x' } });
    expect(readHistoryFilters({ who: ' Ada-GH ' })).toEqual({ who: { login: 'ada-gh' } });
    expect(filtered({ who: { login: 'ada-gh' } })).toBe(false);
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

  it('carries who=<login> last, as the profile\'s stage links write it (PRD 698)', () => {
    expect(historyAddress({ who: { login: 'ada-gh' } })).toBe('/prd?who=ada-gh');
    expect(historyAddress({ who: { login: 'ada-gh' }, stage: 'inbox' })).toBe('/prd?stage=inbox&who=ada-gh');
  });
});

describe('the rows', () => {
  it('lists every dossier newest activity first, each opening its page', () => {
    const items = historyItems(ROWS, ALL, 'u-pierre');
    expect(items.map((i) => i.title)).toEqual(['Offline quotes on the site app', 'PRD dossiers', 'Ask mode — questions on a page']);
    expect(items[1]?.href).toBe('/prd/00000000-0000-4000-8000-0000000000d1');
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

describe('the open questions (PRD 251)', () => {
  const WAITING = row('00000000-0000-4000-8000-0000000000d6', {
    prd: 251, title: 'Answer the outbox anywhere', numbered_at: '2026-09-26T10:00:00Z', last_activity: '2026-09-26T10:00:00Z',
  });
  const rows = [...ROWS, WAITING];
  const open: OpenCounts = new Map([[WAITING.id, 3], [ASK.id, 0]]);

  it('shows n open on a row whose outbox has open questions, and nothing on the others', () => {
    const items = historyItems(rows, ALL, 'u-pierre', open);
    expect(items.find((i) => i.id === WAITING.id)?.open).toBe('3 open');
    expect(items.filter((i) => i.id !== WAITING.id).map((i) => i.open)).toEqual([null, null, null]);
    expect(historyItems(rows, ALL, 'u-pierre').map((i) => i.open)).toEqual([null, null, null, null]);
  });

  it('reads Needs an answer from the address, and writes it back', () => {
    expect(readHistoryFilters({ needs: 'answer' })).toEqual({ who: 'mine', needsAnswer: true });
    expect(readHistoryFilters({ needs: 'nonsense' })).toEqual({ who: 'mine' });
    expect(filtered({ who: 'mine', needsAnswer: true })).toBe(true);
    expect(historyAddress(all({ state: 'prd', needsAnswer: true }))).toBe('/prd?state=prd&needs=answer&who=all');
  });

  it('Needs an answer keeps only the rows with open questions; a row not read counts as none', () => {
    expect(historyItems(rows, all({ needsAnswer: true }), 'u-pierre', open).map((i) => i.id)).toEqual([WAITING.id]);
    expect(historyItems(rows, all({ needsAnswer: true }), 'u-pierre')).toEqual([]);
    expect(historyItems(rows, { who: 'mine', needsAnswer: true, search: 'outbox' }, 'u-pierre', open).map((i) => i.heading)).toEqual(['#251']);
  });

  it('asks the reader only for the numbered dossiers the other filters let through', () => {
    expect(historyToRead(rows, ALL, 'u-pierre').map((r) => r.prd)).toEqual([216, 251, 71]);
    expect(historyToRead(rows, all({ needsAnswer: true, search: 'ask' }), 'u-pierre').map((r) => r.prd)).toEqual([71]);
    expect(historyToRead(rows, { who: 'mine' }, 'u-nobody')).toEqual([]);
  });

  it('reads each dossier\'s open questions from the stored outboxes, one read per workspace, and never GitHub (PRD 657, s5)', async () => {
    const OTHER = row('00000000-0000-4000-8000-0000000000da', { prd: 216, workspace_id: 'w2', title: 'Same number, other workspace', last_activity: '2026-09-01T10:00:00Z' });
    const store = fakePrdOutboxStore();
    await store.record([
      { workspace_id: 'w1', repository: DOSSIERS.home_repo, prd: 216, open_questions: 2, waiting: [] },
      { workspace_id: 'w1', repository: WAITING.home_repo, prd: 251, open_questions: 0, waiting: [] },
      { workspace_id: 'w2', repository: OTHER.home_repo, prd: 216, open_questions: 5, waiting: [] },
      { workspace_id: 'w1', repository: 'vertuoza/elsewhere', prd: 71, open_questions: 9, waiting: [] },
    ]);
    const github = vi.fn();
    vi.stubGlobal('fetch', github);
    const counts = await readOpenCounts([...historyToRead(rows, ALL, 'u-pierre'), OTHER, QUOTES], store);
    vi.unstubAllGlobals();
    expect(github).not.toHaveBeenCalled();
    expect(store.reads.sort()).toEqual(['w1 3', 'w2 1']);
    expect([...counts].sort()).toEqual([[DOSSIERS.id, 2], [WAITING.id, 0], [OTHER.id, 5]].sort());
    // The same counts give the same badges and the same Needs an answer as before.
    expect(historyItems([...rows, OTHER], all({ needsAnswer: true }), 'u-pierre', counts).map((i) => [i.heading, i.open]))
      .toEqual([['#216', '2 open'], ['#216', '5 open']]);
  });

  it('counts nothing without a store, and a workspace whose outboxes cannot be read leaves its rows out', async () => {
    expect((await readOpenCounts([WAITING], null)).size).toBe(0);
    const OTHER = row('00000000-0000-4000-8000-0000000000db', { prd: 9, workspace_id: 'w2' });
    const store = fakePrdOutboxStore();
    await store.record([{ workspace_id: 'w2', repository: OTHER.home_repo, prd: 9, open_questions: 1, waiting: [] }]);
    const countsOf = store.countsOf.bind(store);
    store.countsOf = async (workspace, prds) => {
      if (workspace === 'w1') throw new Error('boom');
      return countsOf(workspace, prds);
    };
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const counts = await readOpenCounts([WAITING, OTHER], store);
    expect([...counts]).toEqual([[OTHER.id, 1]]);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('the stages (PRD 587)', () => {
  const PAULAS = row('00000000-0000-4000-8000-0000000000d7', {
    prd: 300, title: 'Paula ships', opened_by: 'u-paula', numbered_at: '2026-09-25T10:00:00Z', last_activity: '2026-09-25T10:00:00Z',
  });
  const ANSWERED = row('00000000-0000-4000-8000-0000000000d8', {
    title: 'A brainstorm under way', asked: 3, answered: 1, last_activity: '2026-09-19T10:00:00Z',
  });
  const SYNCING = row('00000000-0000-4000-8000-0000000000d9', {
    prd: 590, title: 'Not synced yet', numbered_at: '2026-09-29T10:00:00Z', last_activity: '2026-09-18T10:00:00Z',
  });
  const rows = [...ROWS, PAULAS, ANSWERED, SYNCING];
  const stages: CurrentStages = new Map([
    [stageKeyOf(DOSSIERS), 'inbox'], [stageKeyOf(ASK), 'shipped'], [stageKeyOf(PAULAS), 'inbox'],
  ]);
  const counts = (filters: HistoryFilters, open: OpenCounts = new Map()) =>
    Object.fromEntries(historyStageBar(rows, filters, 'u-pierre', open, stages).map((s) => [s.id, s.count]));

  it('reads ?stage= from the address, ignores an unknown one, and writes it back before who', () => {
    expect(readHistoryFilters({ stage: 'inbox' })).toEqual({ who: 'mine', stage: 'inbox' });
    expect(readHistoryFilters({ stage: ' building ' })).toEqual({ who: 'mine', stage: 'building' });
    expect(readHistoryFilters({ stage: 'nonsense' })).toEqual({ who: 'mine' });
    expect(readHistoryFilters({ stage: 'syncing' })).toEqual({ who: 'mine' });
    expect(filtered({ who: 'mine', stage: 'idea' })).toBe(true);
    expect(historyAddress(all({ state: 'prd', stage: 'shipped' }))).toBe('/prd?state=prd&stage=shipped&who=all');
  });

  it('gives each row its current stage: stored for a numbered PRD, idea for an answered draft, none otherwise', () => {
    const byTitle = Object.fromEntries(historyItems(rows, ALL, 'u-pierre', new Map(), stages).map((i) => [i.title, i.stage]));
    expect(byTitle).toEqual({
      'PRD dossiers': 'inbox', 'Ask mode — questions on a page': 'shipped', 'Paula ships': 'inbox',
      'A brainstorm under way': 'idea', 'Offline quotes on the site app': null, 'Not synced yet': null,
    });
    expect(historyItems(rows, ALL, 'u-pierre').map((i) => i.stage).filter(Boolean)).toEqual(['idea']);
  });

  it('keeps only the rows at the stage picked', () => {
    expect(historyItems(rows, all({ stage: 'inbox' }), 'u-pierre', new Map(), stages).map((i) => i.heading)).toEqual(['#216', '#300']);
    expect(historyItems(rows, all({ stage: 'idea' }), 'u-pierre', new Map(), stages).map((i) => i.title)).toEqual(['A brainstorm under way']);
    expect(historyItems(rows, all({ stage: 'retro' }), 'u-pierre', new Map(), stages)).toEqual([]);
    expect(historyItems(rows, { ...readHistoryFilters({ stage: 'unknown' }), who: 'all' }, 'u-pierre', new Map(), stages)).toHaveLength(6);
  });

  it('counts the seven stages in track order over the rows every filter but the stage keeps', () => {
    expect(historyStageBar(rows, ALL, 'u-pierre', new Map(), stages).map((s) => s.id))
      .toEqual(['idea', 'prd', 'inbox', 'building', 'outbox', 'shipped', 'retro']);
    const none = { idea: 0, prd: 0, inbox: 0, building: 0, outbox: 0, shipped: 0, retro: 0 };
    expect(counts(ALL)).toEqual({ ...none, idea: 1, inbox: 2, shipped: 1 });
    expect(counts(all({ stage: 'shipped' }))).toEqual(counts(ALL));
    expect(counts({ who: 'mine' })).toEqual({ ...none, idea: 1, inbox: 1, shipped: 1 });
    expect(counts(all({ repo: 'vertuoza/vertuo-core' }))).toEqual({ ...none, inbox: 1 });
    expect(counts(all({ state: 'draft' }))).toEqual({ ...none, idea: 1 });
    expect(counts(all({ search: 'ask' }))).toEqual({ ...none, shipped: 1 });
    expect(counts(all({ needsAnswer: true }), new Map([[PAULAS.id, 2]]))).toEqual({ ...none, inbox: 1 });
  });

  it('links each stage to the list filtered to it, keeping the other filters; the selected one clears it', () => {
    const bar = historyStageBar(rows, all({ repo: 'a/b', stage: 'inbox' }), 'u-pierre', new Map(), stages);
    expect(bar.find((s) => s.id === 'inbox')).toMatchObject({ label: 'inbox', selected: true, href: '/prd?repo=a%2Fb&who=all' });
    expect(bar.find((s) => s.id === 'prd')).toMatchObject({ label: 'PRD', selected: false, href: '/prd?repo=a%2Fb&stage=prd&who=all' });
    expect(bar.filter((s) => s.selected)).toHaveLength(1);
  });

  it('does not narrow the outbox reads by the stage', () => {
    expect(historyToRead(rows, all({ stage: 'retro' }), 'u-pierre').map((r) => r.prd)).toEqual([216, 300, 590, 71]);
  });

  it('reads the current stages per workspace of the numbered rows, and a workspace that fails reads none', async () => {
    const OTHER = row('00000000-0000-4000-8000-0000000000da', { prd: 7, workspace_id: 'w2', home_repo: 'Acme/Tool' });
    const asked: [string, unknown][] = [];
    const read = await readCurrentStages([...rows, OTHER], {
      currentStages: (workspace, prds) => {
        asked.push([workspace, prds]);
        if (workspace === 'w2') return Promise.reject(new Error('boom'));
        return Promise.resolve(new Map([['vertuoza/vertuo-omni-loop#216', 'building' as const]]));
      },
    });
    expect(asked).toEqual([
      ['w1', [
        { repository: 'vertuoza/vertuo-omni-loop', prd: 71 }, { repository: 'vertuoza/vertuo-omni-loop', prd: 216 },
        { repository: 'vertuoza/vertuo-omni-loop', prd: 300 }, { repository: 'vertuoza/vertuo-omni-loop', prd: 590 },
      ]],
      ['w2', [{ repository: 'Acme/Tool', prd: 7 }]],
    ]);
    expect([...read]).toEqual([[stageKeyOf(DOSSIERS), 'building']]);
    expect((await readCurrentStages(rows, null)).size).toBe(0);
    expect((await readCurrentStages(ROWS.filter((r) => r.prd === null), { currentStages: () => Promise.reject(new Error('never asked')) })).size).toBe(0);
  });
});

describe('one person\'s PRDs, who=<login> (PRD 698)', () => {
  const ADA = { who: { login: 'ada-gh' } } as const;
  const BY_ADA = row('00000000-0000-4000-8000-0000000000e1', { prd: 300, title: 'Ada\'s PRD', opened_by: 'u-ada', last_activity: '2026-09-29T09:00:00Z' });
  const SYNCED = row('00000000-0000-4000-8000-0000000000e2', { prd: 301, title: 'Synced', opened_by: null });
  const MIXED = [...ROWS, BY_ADA, SYNCED];

  it('keeps the dossiers opened by one of the account ids the login holds, by the rule Mine uses', () => {
    expect(historyItems(MIXED, ADA, 'u-pierre', new Map(), new Map(), new Set(['u-ada'])).map((i) => i.title)).toEqual(['Ada\'s PRD']);
    expect(historyToRead(MIXED, ADA, 'u-pierre', new Set(['u-ada'])).map((r) => r.id)).toEqual([BY_ADA.id]);
    expect(historyStageBar(MIXED, ADA, 'u-pierre', new Map(), new Map(), new Set(['u-ada'])).find((s) => s.id === 'inbox')?.href).toBe('/prd?stage=inbox&who=ada-gh');
  });

  it('keeps none when the login holds no account here, never the viewer\'s', () => {
    expect(historyItems(MIXED, ADA, 'u-pierre')).toEqual([]);
    expect(historyItems(MIXED, ADA, 'u-ada', new Map(), new Map(), new Set())).toEqual([]);
  });

  it('keeps Mine and All as they were', () => {
    expect(historyItems(MIXED, { who: 'mine' }, 'u-ada', new Map(), new Map(), new Set(['u-pierre'])).map((i) => i.title)).toEqual(['Ada\'s PRD']);
    expect(historyItems(MIXED, ALL, 'u-ada')).toHaveLength(5);
  });

  it('reads the account ids a login holds in each workspace once, ignoring case; a roster that fails adds none', async () => {
    const roster = vi.fn((workspace: string) => {
      if (workspace === 'w3') return Promise.reject(new Error('down'));
      return Promise.resolve(workspace === 'w1'
        ? [{ user_id: 'u-ada', github_login: 'Ada-GH' }, { user_id: 'u-bob', github_login: 'bob' }]
        : [{ user_id: 'u-ada-2', github_login: 'ada-gh' }, { user_id: 'u-none', github_login: null }]);
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rows = [row('a'), row('b'), row('c', { workspace_id: 'w2' }), row('d', { workspace_id: 'w3' })];
    expect([...await readLoginIds(rows, 'ada-gh', roster)].sort()).toEqual(['u-ada', 'u-ada-2']);
    expect(roster).toHaveBeenCalledTimes(3);
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });
});
