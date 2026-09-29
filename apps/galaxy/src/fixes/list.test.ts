import { describe, expect, it } from 'vitest';
import type { DossierListRow } from '../dossier/store';
import { fixAddress, fixChoices, fixItems, readFixFilters } from './list';

// /visual and /bugs (PRD 627), as pure functions of the rows dossier_list() gives the viewer and the
// filters in the address: only the dossiers of the list's kind, newest activity first, Mine (the ones
// the viewer pushed, the default) or All (`who=all`), a repository, and the words of a title; each row
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

const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe('the filters in the address', () => {
  it('reads Mine by default, All, a repository and a search; anything else is no filter', () => {
    expect(readFixFilters({})).toEqual({ who: 'mine' });
    expect(readFixFilters({ who: 'all', repo: ' Vertuoza/Vertuo-Core ', q: '  bar ', state: 'draft' })).toEqual({ who: 'all', repo: 'vertuoza/vertuo-core', search: 'bar' });
    expect(readFixFilters({ who: 'nobody', repo: '', q: ' ' })).toEqual({ who: 'mine' });
  });

  it('writes each filter back into the list\'s own address', () => {
    expect(fixAddress('visual', { who: 'mine' })).toBe('/visual');
    expect(fixAddress('bug', { who: 'all', repo: 'vertuoza/vertuo-core', search: 'crash' })).toBe('/bugs?repo=vertuoza%2Fvertuo-core&q=crash&who=all');
  });
});

describe('the rows', () => {
  it('lists only the dossiers of its kind, newest activity first', () => {
    expect(ids(fixItems(ROWS, 'visual', { who: 'all' }, 'u-pierre'))).toEqual([SIDEBAR.id, TOPBAR.id]);
    expect(ids(fixItems(ROWS, 'bug', { who: 'all' }, 'u-pierre'))).toEqual([CRASH.id]);
  });

  it('keeps Mine to the fixes the viewer pushed, so one the fallback read shows only under All', () => {
    expect(ids(fixItems(ROWS, 'visual', { who: 'mine' }, 'u-pierre'))).toEqual([SIDEBAR.id]);
    expect(ids(fixItems(ROWS, 'visual', { who: 'mine' }, null))).toEqual([]);
  });

  it('filters by any of its repositories, and by every word of the search', () => {
    expect(ids(fixItems(ROWS, 'visual', { who: 'all', repo: 'vertuoza/vertuo-core' }, 'u-pierre'))).toEqual([TOPBAR.id]);
    expect(ids(fixItems(ROWS, 'visual', { who: 'all', search: 'SIDEBAR dark' }, 'u-pierre'))).toEqual([SIDEBAR.id]);
    expect(ids(fixItems(ROWS, 'visual', { who: 'all', search: 'sidebar light' }, 'u-pierre'))).toEqual([]);
  });

  it('shows #n, the title, the repositories, what it holds and its last activity, and opens the fix\'s own page', () => {
    const [sidebar, topbar] = fixItems(ROWS, 'visual', { who: 'all' }, 'u-pierre');
    expect(sidebar).toEqual({
      id: SIDEBAR.id, href: `/visual/${SIDEBAR.id}`, heading: '#548', title: 'Darker sidebar', repos: ['vertuoza/vertuo-omni-loop'],
      artifacts: [{ kind: 'before-after', label: 'Before/after', badge: 'v1' }, { kind: 'variations', label: 'Variations', badge: '2 rounds' }],
      activity: 'last activity 29 Sep 2026, 09:30 UTC', at: SIDEBAR.last_activity,
    });
    expect(topbar.artifacts).toEqual([]);
    const [crash] = fixItems(ROWS, 'bug', { who: 'all' }, 'u-pierre');
    expect(crash).toMatchObject({ href: `/bugs/${CRASH.id}`, heading: '#571', artifacts: [{ kind: 'bug-record', label: 'Bug record', badge: 'v1' }] });
  });

  it('offers the repositories of its own kind only', () => {
    expect(fixChoices(ROWS, 'visual')).toEqual({ repos: ['vertuoza/vertuo-core', 'vertuoza/vertuo-omni-loop'] });
    expect(fixChoices(ROWS, 'bug')).toEqual({ repos: ['vertuoza/vertuo-omni-loop'] });
  });
});
