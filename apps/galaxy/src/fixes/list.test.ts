import { describe, expect, it } from 'vitest';
import type { DossierListRow } from '../dossier/store';
import { UNREAD } from '../dossier/github/summary';
import { peopleOf } from '../people/load';
import { fixAddress, fixChoices, fixItems, readFixFilters } from './list';

// /visual and /bugs (PRD 627), as pure functions of the rows dossier_list() gives the viewer and the
// filters in the address: only the dossiers of the list's kind, newest activity first, Mine (the ones
// the viewer pushed or whose issue they opened, the default) or All (`who=all`), a repository, and the words of a title; each row
// opens the fix's own page.

const row = (id: string, more: Partial<DossierListRow> = {}): DossierListRow => ({
  id, workspace_id: 'w1', home_repo: 'vertuoza/vertuo-omni-loop', prd: 1, kind: 'visual', title: 'A fix', opened_by: 'u-pierre',
  created_at: '2026-09-20T09:00:00Z', numbered_at: '2026-09-20T09:00:00Z', repos: ['vertuoza/vertuo-omni-loop'], latest: {}, asked: 0,
  answered: 0, last_activity: '2026-09-20T09:00:00Z', ...more,
});

const SIDEBAR = row('00000000-0000-4000-8000-0000000000f1', {
  prd: 548, title: 'Darker sidebar', last_activity: '2026-09-29T09:30:00Z',
  latest: {
    'before-after': { id: 'b1', version: 1, source: 'kit', created_at: '2026-09-29T09:30:00Z' },
    variations: { id: 'r2', version: 2, source: 'kit', created_at: '2026-09-29T09:20:00Z' },
  },
});
const TOPBAR = row('00000000-0000-4000-8000-0000000000f2', {
  prd: 561, title: 'Top bar spacing', opened_by: null, home_repo: 'vertuoza/vertuo-core', repos: ['vertuoza/vertuo-core'],
  last_activity: '2026-09-28T09:00:00Z',
});
const CRASH = row('00000000-0000-4000-8000-0000000000f3', {
  prd: 571, kind: 'bug', title: 'Ask page crash', last_activity: '2026-09-29T10:00:00Z',
  latest: { 'bug-record': { id: 'g1', version: 1, source: 'github', created_at: '2026-09-29T10:00:00Z' } },
});
const PRD = row('00000000-0000-4000-8000-0000000000d1', { prd: 216, kind: 'prd', title: 'PRD dossiers', last_activity: '2026-09-29T11:00:00Z' });
const OLD_PRD = row('00000000-0000-4000-8000-0000000000d2', { prd: 71, kind: undefined, title: 'Ask mode' });
const ROWS = [TOPBAR, PRD, CRASH, SIDEBAR, OLD_PRD];

const ISSUE = {
  number: 548, url: 'https://github.com/vertuoza/vertuo-omni-loop/issues/548', state: 'open' as const, author: 'anna',
  createdAt: '2026-09-29T08:00:00Z', risk: null as string | null, regression: false,
};
const OPEN = { number: 562, url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/562', state: 'open' as const, mergedAt: null as string | null, mergedBy: null };

/** The viewer: the user who pushed the fixes opened_by names, signed in as @pierre. */
const ME = { id: 'u-pierre', login: 'pierre' };

const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe('the filters in the address', () => {
  it('reads Mine by default, All, a repository and a search; anything else is no filter', () => {
    expect(readFixFilters({})).toEqual({ who: 'mine' });
    expect(readFixFilters({ who: 'all', repo: ' Vertuoza/Vertuo-Core ', q: '  bar ', state: 'draft' })).toEqual({ who: 'all', repo: 'vertuoza/vertuo-core', search: 'bar' });
    expect(readFixFilters({ who: 'no body', repo: '', q: ' ' })).toEqual({ who: 'mine' });
  });

  it('reads who=<login> as that person, and writes it back (PRD 698)', () => {
    expect(readFixFilters({ who: 'Anna' })).toEqual({ who: { login: 'anna' } });
    expect(fixAddress('bug', { who: { login: 'anna' }, state: 'merged' })).toBe('/bugs?state=merged&who=anna');
  });

  it('writes each filter back into the list\'s own address', () => {
    expect(fixAddress('visual', { who: 'mine' })).toBe('/visual');
    expect(fixAddress('bug', { who: 'all', repo: 'vertuoza/vertuo-core', search: 'crash' })).toBe('/bugs?repo=vertuoza%2Fvertuo-core&q=crash&who=all');
  });
});

describe('the rows', () => {
  it('lists only the dossiers of its kind, newest activity first', () => {
    expect(ids(fixItems(ROWS, 'visual', { who: 'all' }, ME))).toEqual([SIDEBAR.id, TOPBAR.id]);
    expect(ids(fixItems(ROWS, 'bug', { who: 'all' }, ME))).toEqual([CRASH.id]);
  });

  it('keeps Mine to the fixes the viewer pushed, so one the fallback read shows only under All', () => {
    expect(ids(fixItems(ROWS, 'visual', { who: 'mine' }, ME))).toEqual([SIDEBAR.id]);
    expect(ids(fixItems(ROWS, 'visual', { who: 'mine' }, null))).toEqual([]);
  });

  it('keeps under Mine a fix the sync read whose issue the viewer opened, their GitHub login in any case (issue 674)', () => {
    const facts = new Map([
      [TOPBAR.id, { issue: { ...ISSUE, number: 561, author: 'PierreDerval' }, pull: null, approvals: [], release: null }],
      [CRASH.id, { issue: { ...ISSUE, number: 571, author: 'anna' }, pull: null, approvals: [], release: null }],
    ]);
    const pierre = { id: 'u-other', login: 'pierrederval' };
    expect(ids(fixItems(ROWS, 'visual', { who: 'mine' }, pierre, facts))).toEqual([TOPBAR.id]);
    expect(ids(fixItems(ROWS, 'bug', { who: 'mine' }, pierre, facts))).toEqual([]);
  });

  it('keeps under who=<login> the fixes that person asked for, by Mine\'s rule: pushed by one of their ids, or their issue (PRD 698)', () => {
    const facts = new Map([
      [TOPBAR.id, { issue: { ...ISSUE, number: 561, author: 'Anna' }, pull: null, approvals: [], release: null }],
      [CRASH.id, { issue: { ...ISSUE, number: 571, author: 'bob' }, pull: null, approvals: [], release: null }],
    ]);
    const anna = { who: { login: 'anna' } } as const;
    expect(ids(fixItems(ROWS, 'visual', anna, ME, facts))).toEqual([TOPBAR.id]);
    expect(ids(fixItems(ROWS, 'visual', { who: { login: 'someone' } }, ME, facts, undefined, new Set(['u-pierre'])))).toEqual([SIDEBAR.id]);
    expect(ids(fixItems(ROWS, 'bug', anna, ME, facts))).toEqual([]);
    // The ids come from whom, never from the viewer: with none resolved, only the issue's author counts.
    expect(ids(fixItems(ROWS, 'visual', { who: { login: 'pierre' } }, { id: 'u-pierre', login: 'pierre' }, new Map()))).toEqual([]);
  });

  it('filters by any of its repositories, and by every word of the search', () => {
    expect(ids(fixItems(ROWS, 'visual', { who: 'all', repo: 'vertuoza/vertuo-core' }, ME))).toEqual([TOPBAR.id]);
    expect(ids(fixItems(ROWS, 'visual', { who: 'all', search: 'SIDEBAR dark' }, ME))).toEqual([SIDEBAR.id]);
    expect(ids(fixItems(ROWS, 'visual', { who: 'all', search: 'sidebar light' }, ME))).toEqual([]);
  });

  it('shows #n, the title, the repositories, what it holds and its last activity, and opens the fix\'s own page', () => {
    const [sidebar, topbar] = fixItems(ROWS, 'visual', { who: 'all' }, ME);
    expect(sidebar).toEqual({
      id: SIDEBAR.id, href: `/visual/${SIDEBAR.id}`, heading: '#548', title: 'Darker sidebar', repos: ['vertuoza/vertuo-omni-loop'],
      artifacts: [{ kind: 'before-after', label: 'Before/after', badge: 'v1' }, { kind: 'variations', label: 'Variations', badge: '2 rounds' }],
      activity: 'last activity 29 Sep 2026, 09:30 UTC', at: SIDEBAR.last_activity,
      askedBy: null, state: null, stateLabel: '—', risk: null, regression: false,
    });
    expect(topbar!.artifacts).toEqual([]);
    const [crash] = fixItems(ROWS, 'bug', { who: 'all' }, ME);
    expect(crash).toMatchObject({ href: `/bugs/${CRASH.id}`, heading: '#571', artifacts: [{ kind: 'bug-record', label: 'Bug record', badge: 'v1' }] });
  });

  it('shows who asked and the state pill from GitHub, — when it did not answer (PRD 627, s5)', () => {
    const facts = new Map([
      [SIDEBAR.id, { issue: { ...ISSUE, risk: 'omni:risk-low', regression: true }, pull: { ...OPEN, state: 'merged' as const, mergedAt: '2026-09-29T12:00:00Z' }, approvals: [], release: null }],
      [TOPBAR.id, { issue: UNREAD, pull: UNREAD, approvals: UNREAD, release: UNREAD }],
      [CRASH.id, { issue: { ...ISSUE, risk: 'omni:risk-high', regression: true }, pull: null, approvals: [], release: null }],
    ]);
    const [sidebar, topbar] = fixItems(ROWS, 'visual', { who: 'all' }, ME, facts);
    expect(sidebar).toMatchObject({ askedBy: { name: '@anna' }, state: 'merged', stateLabel: 'Merged', risk: null, regression: false });
    expect(topbar).toMatchObject({ askedBy: null, state: null, stateLabel: '—' });
    expect(fixItems(ROWS, 'bug', { who: 'all' }, ME, facts)[0]).toMatchObject({
      state: 'asked', stateLabel: 'Asked', risk: 'omni:risk-high', regression: true,
    });
    expect(ids(fixItems(ROWS, 'visual', { who: 'all', state: 'merged' }, ME, facts))).toEqual([SIDEBAR.id]);
    expect(ids(fixItems(ROWS, 'visual', { who: 'all', state: 'asked' }, ME, facts))).toEqual([]);
  });

  it('gives who asked a face, by login through the directory of the fix\'s workspace (PRD 652, s6)', () => {
    const facts = new Map([[SIDEBAR.id, { issue: ISSUE, pull: null, approvals: [], release: null }], [TOPBAR.id, { issue: { ...ISSUE, author: 'Stranger' }, pull: null, approvals: [], release: null }]]);
    const anna = { user_id: 'u-anna', name: 'Anna', github_login: 'ANNA', avatar_url: 'https://a.test/anna.png', fleet: null, hero: null };
    const asked: string[] = [];
    const peopleIn = (workspace: string) => { asked.push(workspace); return peopleOf([anna], []); };
    const [sidebar, topbar] = fixItems(ROWS, 'visual', { who: 'all' }, ME, facts, peopleIn);
    expect(sidebar!.askedBy).toMatchObject({ name: '@anna', face: { kind: 'photo', url: 'https://a.test/anna.png' } });
    expect(topbar!.askedBy).toMatchObject({ name: '@Stranger', face: { kind: 'photo', url: 'https://github.com/Stranger.png?size=48' } });
    expect(asked).toEqual(['w1', 'w1']);
    // With no directory, a login still gets its GitHub photo.
    expect(fixItems(ROWS, 'visual', { who: 'all' }, ME, facts)[0]!.askedBy?.face).toEqual({ kind: 'photo', url: 'https://github.com/anna.png?size=48' });
  });

  it('reads and writes the state filter', () => {
    expect(readFixFilters({ state: 'in-review' })).toEqual({ who: 'mine', state: 'in-review' });
    expect(fixAddress('bug', { who: 'mine', state: 'merged' })).toBe('/bugs?state=merged');
  });

  it('offers the repositories of its own kind only', () => {
    expect(fixChoices(ROWS, 'visual')).toEqual({ repos: ['vertuoza/vertuo-core', 'vertuoza/vertuo-omni-loop'] });
    expect(fixChoices(ROWS, 'bug')).toEqual({ repos: ['vertuoza/vertuo-omni-loop'] });
  });
});
