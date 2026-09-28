import { describe, expect, it } from 'vitest';
import { SIDEBAR, badgeOf, currentItem, pageTitle } from './sidebar';

// The app's sidebar as data (PRD 438): the Work group, then the Omni group, and the two pure reads
// the shell makes of a path, the item it falls under and the top bar's title.

describe('SIDEBAR', () => {
  it('holds Work, then Omni', () => {
    expect(SIDEBAR.map((g) => [g.id, g.label])).toEqual([
      ['work', 'Work'],
      ['omni', 'Omni'],
    ]);
  });

  it('holds Home, PRDs, Questions (For me, History), Knowledge and Fleets under Work, in that order', () => {
    const [work] = SIDEBAR;
    expect(work.items.map((i) => [i.id, i.label, i.path, (i.children ?? []).map((c) => [c.id, c.label, c.path])])).toEqual([
      ['home', 'Home', '/app', []],
      ['prds', 'PRDs', '/prd', []],
      ['questions', 'Questions', '/ask', [['for-me', 'Shared with me', '/ask/for-me'], ['history', 'History', '/ask/history']]],
      ['knowledge', 'Knowledge', '/knowledge', []],
      ['fleets', 'Fleets', '/app/fleets', []],
    ]);
    expect(work.items.some((i) => i.leavesApp)).toBe(false);
  });

  it('holds Docs and Release notes under Omni, each leaving the app', () => {
    const [, omni] = SIDEBAR;
    expect(omni.items.map((i) => [i.id, i.label, i.path, i.leavesApp])).toEqual([
      ['docs', 'Docs', '/docs', true],
      ['releases', 'Release notes', '/releases', true],
    ]);
  });
});

describe('currentItem and pageTitle', () => {
  const CASES: Array<[string, string | null, string | null]> = [
    ['/app', 'home', 'Home'],
    ['/app/fleets', 'fleets', 'Fleets'],
    ['/prd', 'prds', 'PRDs'],
    ['/prd/3f2a', 'prds', 'PRDs'],
    ['/prd?who=all', 'prds', 'PRDs'],
    ['/ask', 'questions', 'Questions'],
    ['/ask/7c1e', 'questions', 'Questions'],
    ['/ask/q/42', 'questions', 'Questions'],
    ['/ask/for-me', 'for-me', 'Questions / Shared with me'],
    ['/ask/history', 'history', 'Questions / History'],
    ['/knowledge', 'knowledge', 'Knowledge'],
    ['/knowledge?domain=x', 'knowledge', 'Knowledge'],
    ['/nowhere', null, null],
    ['/application', null, null],
    ['/', null, null],
  ];

  it.each(CASES)('%s falls under %s, titled %s', (path, item, title) => {
    expect(currentItem(path)).toBe(item);
    expect(pageTitle(path)).toBe(title);
  });

  it('reads no item from nothing', () => {
    expect(currentItem(null)).toBeNull();
    expect(pageTitle(null)).toBeNull();
  });
});

describe('badgeOf', () => {
  const counts = { questions: 3, shared: 1, outbox: 2, total: 5 };

  it('gives Questions the Questions part, and Shared with me the shared questions only', () => {
    expect(badgeOf('questions', counts)).toBe(3);
    expect(badgeOf('for-me', counts)).toBe(1);
  });

  it('gives PRDs the Outbox part', () => {
    expect(badgeOf('prds', counts)).toBe(2);
    expect(badgeOf('prds', { ...counts, outbox: 0 })).toBeNull();
  });

  it('gives no badge at 0, nor to an item that counts nothing', () => {
    expect(badgeOf('questions', { ...counts, questions: 0 })).toBeNull();
    expect(badgeOf('for-me', { ...counts, shared: 0 })).toBeNull();
    for (const id of ['home', 'history', 'knowledge', 'fleets', 'docs', 'releases'] as const) expect(badgeOf(id, counts)).toBeNull();
  });
});
