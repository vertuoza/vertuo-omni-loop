import { describe, it, expect } from 'vitest';
import { HOOK_WAIT_MS, type SessionRow } from './view';
import { ageLabel, firstTab, needsYou, pageTabs, pageWithList, pageWithPane, startPage, tabsOf, tabsTitle, type TabRow } from './tabs';

const NOW = Date.parse('2026-09-26T10:00:00Z');
const MIN = 60_000;
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

function row(id: string, patch: { title?: string; seen?: number; status?: SessionRow['status']; round?: { ago: number; status?: 'open' | 'answered' | 'abandoned'; header?: string | null } | null } = {}): TabRow {
  const { title = `vertuo-omni-loop · ${id}`, seen = 1000, status = 'open', round = null } = patch;
  return {
    session: { id, owner: 'ada', title, status, created_at: at(60 * MIN), last_seen_at: at(seen) },
    newest: round && { id: `${id}-round`, status: round.status ?? 'open', created_at: at(round.ago), header: round.header === undefined ? 'Storage' : round.header },
  };
}

describe('a tab', () => {
  it("shows the session's title and its latest question's header", () => {
    const [tab] = tabsOf([row('a', { title: 'vertuo-omni-loop · main', round: { ago: MIN, header: 'Access' } })], NOW);
    expect(tab).toMatchObject({ id: 'a', title: 'vertuo-omni-loop · main', header: 'Access' });
    expect(tabsOf([row('b')], NOW)[0].header).toBeNull();
  });

  it('needs you while its newest round is open and the hook still waits, with its age', () => {
    const [tab] = tabsOf([row('a', { round: { ago: 3 * MIN } })], NOW);
    expect(tab).toMatchObject({ state: 'needs-you', age: '3 min' });
    expect(tabsOf([row('a', { round: { ago: HOOK_WAIT_MS - 1 } })], NOW)[0].state).toBe('needs-you');
  });

  it('is working otherwise: no round, an answered one, one the terminal took, or one the hook gave up on', () => {
    for (const round of [null, { ago: MIN, status: 'answered' as const }, { ago: MIN, status: 'abandoned' as const }, { ago: HOOK_WAIT_MS }]) {
      expect(tabsOf([row('a', { round })], NOW)[0], JSON.stringify(round)).toMatchObject({ state: 'working', age: null });
    }
  });

  it('is closed once its session closes or idles for 12 hours, a question open or not', () => {
    expect(tabsOf([row('a', { status: 'closed', round: { ago: MIN } })], NOW)[0].state).toBe('closed');
    expect(tabsOf([row('a', { seen: 12 * 60 * MIN, round: { ago: MIN } })], NOW)[0].state).toBe('closed');
  });

  it('says an age in whole minutes, and just now under one', () => {
    expect(ageLabel(0)).toBe('just now');
    expect(ageLabel(59_999)).toBe('just now');
    expect(ageLabel(MIN)).toBe('1 min');
    expect(ageLabel(9 * MIN - 1)).toBe('8 min');
  });
});

describe('the order of the tabs', () => {
  it('puts the ones that need you first, oldest question first, then the others, most recently active first', () => {
    const tabs = tabsOf([
      row('quiet-old', { seen: 30 * MIN }),
      row('asks-new', { round: { ago: MIN } }),
      row('quiet-new', { seen: 5_000, round: { ago: 20 * MIN, status: 'answered' } }),
      row('asks-old', { round: { ago: 4 * MIN } }),
    ], NOW);
    expect(tabs.map((t) => t.id)).toEqual(['asks-old', 'asks-new', 'quiet-new', 'quiet-old']);
  });
});

describe('the browser title', () => {
  it('counts the tabs that need you', () => {
    const tabs = tabsOf([row('a', { round: { ago: MIN } }), row('b', { round: { ago: 2 * MIN } }), row('c')], NOW);
    expect(needsYou(tabs)).toBe(2);
    expect(tabsTitle(2)).toBe('● (2) Claude asks · OMNI LOOP');
    expect(tabsTitle(1)).toBe('● (1) Claude asks · OMNI LOOP');
    expect(tabsTitle(0)).toBe('Ask · OMNI LOOP');
  });
});

describe('the tab /ask selects', () => {
  it('is the first in the order, the one that needs you longest', () => {
    expect(firstTab(tabsOf([row('quiet'), row('asks', { round: { ago: MIN } })], NOW))).toBe('asks');
    expect(firstTab(tabsOf([row('quiet')], NOW))).toBe('quiet');
    expect(firstTab([])).toBeNull();
  });
});

describe("the page's state", () => {
  it('opens on the first tab, or on the one the link names', () => {
    const rows = [row('quiet'), row('asks', { round: { ago: MIN } })];
    expect(startPage(rows, null, null, NOW).selected).toBe('asks');
    expect(startPage(rows, 'quiet', null, NOW).selected).toBe('quiet');
    expect(startPage([], null, null, NOW).selected).toBeNull();
  });

  it('shows a closed session the link names read-only, as the last tab', () => {
    const closed = row('gone', { status: 'closed', round: { ago: MIN } });
    const page = startPage([row('a', { round: { ago: MIN } }), row('b')], 'gone', closed, NOW);
    expect(page.selected).toBe('gone');
    const tabs = pageTabs(page, NOW);
    expect(tabs.map((t) => [t.id, t.state])).toEqual([['a', 'needs-you'], ['b', 'working'], ['gone', 'closed']]);
  });

  it('never changes the selection when a question arrives in another tab: it badges that tab and counts it in the title', () => {
    const before = startPage([row('a'), row('b')], 'a', null, NOW);
    const after = pageWithList(before, [row('a'), row('b', { round: { ago: 0 } })]);
    expect(after.selected).toBe('a');
    const tabs = pageTabs(after, NOW);
    expect(tabs.map((t) => t.id)).toEqual(['b', 'a']);
    expect(tabs.find((t) => t.id === 'b')?.state).toBe('needs-you');
    expect(tabsTitle(needsYou(tabs))).toBe('● (1) Claude asks · OMNI LOOP');
  });

  it('keeps the selected tab, read-only at the end, once its session leaves the list', () => {
    const before = startPage([row('a', { round: { ago: MIN } }), row('b')], 'a', null, NOW);
    const after = pageWithList(before, [row('b')]);
    expect(after.selected).toBe('a');
    expect(pageTabs(after, NOW).map((t) => [t.id, t.state])).toEqual([['b', 'working'], ['a', 'closed']]);
  });

  it('shows new sessions without selecting one when none was selected', () => {
    const after = pageWithList(startPage([], null, null, NOW), [row('a', { round: { ago: 0 } })]);
    expect(after.selected).toBeNull();
    expect(pageTabs(after, NOW).map((t) => t.id)).toEqual(['a']);
  });

  it("takes the selected tab's newest round from the pane, which reads it first", () => {
    const before = startPage([row('a', { round: { ago: MIN } }), row('b')], 'a', null, NOW);
    const after = pageWithPane(before, {
      session: before.rows[0].session,
      rounds: [{ id: 'a-round', questions: [], answers: { q: 'x' }, answered_via: 'page', status: 'answered', created_at: at(MIN), answered_at: at(0) }],
    });
    expect(pageTabs(after, NOW).find((t) => t.id === 'a')?.state).toBe('working');
    expect(needsYou(pageTabs(after, NOW))).toBe(0);
  });
});
