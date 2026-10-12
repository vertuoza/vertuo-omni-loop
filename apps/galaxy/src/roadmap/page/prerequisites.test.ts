import { describe, expect, it } from 'vitest';
import type { RoadmapPrerequisiteRow } from '../store';
import { prerequisitesOf, roadmapTabOf, roadmapTabsOf } from './prerequisites';

// The Prerequisites tab's model (PRD 1218, s6), pure: the count line, the rows grouped by category with
// the ones waiting on you first, each row's state, what it blocks, its card, and the machine and time
// of the last check; and the roadmap page's two tabs, picked by `?tab=`.

const row = (over: Partial<RoadmapPrerequisiteRow> & Pick<RoadmapPrerequisiteRow, 'row_id' | 'category'>): RoadmapPrerequisiteRow => ({
  roadmap_id: 'r-1', position: 0, need: `the need of ${over.row_id}`, check_with: null, fix_with: null, blocks_all: false, blocks: [],
  who: 'check', repos: [], card: null, state: 'ok', detail: null, ...over,
});
const CARD = { why: 'The tests start a database.', command: 'open -a Docker', whatItDoes: 'Starts Docker.', whoCanDoIt: 'Anyone with this laptop.' };
const AT = '2026-10-20T11:58:00Z';

describe('prerequisitesOf', () => {
  const rows = [
    row({ row_id: 'p1', category: 'permissions', who: 'agent', state: 'ok', blocks_all: true }),
    row({ row_id: 'p2', category: 'local', state: 'ok' }),
    row({ row_id: 'p3', category: 'local', state: 'waits', card: CARD, blocks: ['P2.2', 'P3.4'] }),
    row({ row_id: 'p4', category: 'access', who: 'agent', state: 'fixed', fix_with: 'base:install' }),
    row({ row_id: 'p5', category: 'services', who: 'person', state: 'ticked', card: CARD }),
    row({ row_id: 'p6', category: 'github', state: 'waits', card: CARD }),
    row({ row_id: 'p7', category: 'local', who: 'person', state: null, card: CARD }),
  ];
  const view = prerequisitesOf(rows, 'mbp-irisa', AT);

  it('counts the rows by state', () => {
    expect(view.count).toBe('2 ok · 1 fixed · 1 ticked · 2 wait on you · 1 not checked yet');
    expect(view.waiting).toBe(2);
    expect(prerequisitesOf([row({ row_id: 'p1', category: 'local', state: 'waits' })], null, null).count).toBe('0 ok · 0 fixed · 1 waits on you');
  });

  it('groups the rows by category, the groups with a row waiting on you first, and those rows first in their group', () => {
    expect(view.groups.map((g) => [g.category, g.rows.map((r) => r.id)])).toEqual([
      ['local', ['p3', 'p7', 'p2']],
      ['github', ['p6']],
      ['access', ['p4']],
      ['permissions', ['p1']],
      ['services', ['p5']],
    ]);
    expect(view.groups[0]?.label).toBe('On the machine');
  });

  it('opens the card of a row waiting on you, or not checked yet, and names what each row blocks', () => {
    const shown = view.groups.flatMap((g) => g.rows);
    const p3 = shown.find((r) => r.id === 'p3');
    expect(p3).toMatchObject({ state: 'waits', stateLabel: 'waits on you', open: true, blocks: 'blocks P2.2, P3.4', card: CARD });
    expect(shown.find((r) => r.id === 'p7')).toMatchObject({ stateLabel: 'not checked yet', open: true, checked: null });
    expect(shown.find((r) => r.id === 'p1')).toMatchObject({ open: false, blocks: 'blocks every PRD', who: 'the agent checks it and fixes it' });
    expect(shown.find((r) => r.id === 'p2')?.blocks).toBe('blocks nothing');
    expect(shown.find((r) => r.id === 'p4')?.stateLabel).toBe('fixed by the agent');
    expect(shown.find((r) => r.id === 'p5')).toMatchObject({ stateLabel: 'ticked', who: 'a person ticks it' });
  });

  it('says on which machine and when each checked row was last checked', () => {
    const shown = view.groups.flatMap((g) => g.rows);
    expect(shown.find((r) => r.id === 'p3')?.checked).toBe('last checked on mbp-irisa, 2026-10-20 11:58 UTC');
    expect(view.checked).toBe('last checked on mbp-irisa, 2026-10-20 11:58 UTC');
    expect(prerequisitesOf(rows, null, null).checked).toBeNull();
    expect(prerequisitesOf(rows, 'mbp', 'not a date').checked).toBe('last checked on mbp');
  });

  it('has no group and no count for a roadmap without prerequisites', () => {
    expect(prerequisitesOf([], null, null)).toEqual({ count: null, waiting: 0, groups: [], checked: null, tickError: null });
  });
});

describe('Mark as done on the tab (s7)', () => {
  const rows = [
    row({ row_id: 'p1', category: 'local', state: 'waits', card: CARD }),
    row({ row_id: 'p2', category: 'permissions', who: 'person', state: 'waits', card: CARD }),
    row({ row_id: 'p3', category: 'services', who: 'person', state: 'ticked', card: CARD }),
    row({ row_id: 'p4', category: 'services', who: 'person', state: null, card: CARD }),
  ];
  const shown = (view: ReturnType<typeof prerequisitesOf>) => view.groups.flatMap((g) => g.rows);

  it('offers it on a person row not ticked yet, only to a member where marking is open', () => {
    const member = shown(prerequisitesOf(rows, 'mbp', AT, { tickable: true, ticked: null, tickError: null }));
    expect(member.filter((r) => r.tickable).map((r) => r.id)).toEqual(['p2', 'p4']);
    expect(shown(prerequisitesOf(rows, 'mbp', AT)).some((r) => r.tickable)).toBe(false);
    expect(shown(prerequisitesOf(rows, 'mbp', AT, { tickable: false, ticked: null, tickError: null })).some((r) => r.tickable)).toBe(false);
  });

  it('shows the person row just ticked as ticked, until the next check records it', () => {
    const view = prerequisitesOf(rows, 'mbp', AT, { tickable: true, ticked: 'p2', tickError: null });
    expect(shown(view).find((r) => r.id === 'p2')).toMatchObject({
      state: 'ticked', stateLabel: 'ticked by you: the next check records it', tickable: false, open: false,
    });
    expect(view.count).toBe('0 ok · 0 fixed · 2 ticked · 1 waits on you · 1 not checked yet');
    // Only a person row is ticked: a `?ticked=` naming another row changes nothing.
    expect(shown(prerequisitesOf(rows, 'mbp', AT, { tickable: true, ticked: 'p1', tickError: null })).find((r) => r.id === 'p1')?.state).toBe('waits');
  });

  it('says why a tick was not posted, in words', () => {
    const words = (code: string) => prerequisitesOf(rows, 'mbp', AT, { tickable: true, ticked: null, tickError: code }).tickError;
    expect(words('no-access')).toMatch(/may not comment on the roadmap's issue/);
    expect(words('refused')).toMatch(/authorisation was refused/);
    expect(words('down')).toMatch(/GitHub did not answer/);
    expect(words('state')).toMatch(/try again/i);
    expect(words('whatever')).toMatch(/nothing was posted/i);
    expect(words('constructor')).toMatch(/nothing was posted/i);
    expect(prerequisitesOf(rows, 'mbp', AT).tickError).toBeNull();
  });
});

describe('the roadmap page\'s tabs', () => {
  it('picks Prerequisites only by name, Overview otherwise', () => {
    expect(roadmapTabOf('prerequisites')).toBe('prerequisites');
    expect(roadmapTabOf('overview')).toBe('overview');
    expect(roadmapTabOf(null)).toBe('overview');
    expect(roadmapTabOf('nope')).toBe('overview');
  });

  it('links Overview to the page and Prerequisites to ?tab=prerequisites, with how many wait on you', () => {
    expect(roadmapTabsOf('/roadmaps/r-1', 'prerequisites', 2)).toEqual([
      { tab: 'overview', label: 'Overview', href: '/roadmaps/r-1', current: false, badge: null },
      { tab: 'prerequisites', label: 'Prerequisites', href: '/roadmaps/r-1?tab=prerequisites', current: true, badge: 2 },
    ]);
    expect(roadmapTabsOf('/roadmaps/r-1', 'overview', 0)[1]?.badge).toBeNull();
  });
});
