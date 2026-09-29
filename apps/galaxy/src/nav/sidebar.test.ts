import { SPRITE_DEFS } from '@omni/design';
import { describe, expect, it } from 'vitest';
import { SIDEBAR, badgeOf, currentItem, pageTrail, type SidebarItem } from './sidebar';

// The app's sidebar as data (PRD 438, regrouped by PRD 572): Dashboard, Work, Settings, then Omni, and the two pure reads
// the shell makes of a path, the item it falls under and the top bar's trail (issue 704).

describe('SIDEBAR', () => {
  it('holds Dashboard, Work, Settings, then Omni (PRD 572)', () => {
    expect(SIDEBAR.map((g) => [g.id, g.label])).toEqual([
      ['dashboard', 'Dashboard'],
      ['work', 'Work'],
      ['settings', 'Settings'],
      ['omni', 'Omni'],
    ]);
  });

  it('gives every Dashboard and Work section its own 16 px sprite, and Settings and Omni none (issue 653)', () => {
    const [dashboard, work, settings, omni] = SIDEBAR;
    expect([...dashboard.items, ...work.items].map((i) => [i.id, i.sprite])).toEqual([
      ['home', 'menu-home'], ['fleet', 'menu-fleet'], ['workspace', 'menu-workspace'], ['engineering', 'menu-engineering'],
      ['prds', 'menu-prds'], ['bugs', 'menu-bugs'], ['visual', 'menu-visual'], ['questions', 'menu-questions'], ['knowledge', 'menu-knowledge'],
    ]);
    for (const item of [...dashboard.items, ...work.items]) expect([SPRITE_DEFS[item.sprite!]?.w, SPRITE_DEFS[item.sprite!]?.h], item.id).toEqual([16, 16]);
    const rest = [...settings.items, ...omni.items, ...work.items.flatMap((i) => i.children ?? [])];
    expect(rest.filter((i) => i.sprite)).toEqual([]);
  });

  const rows = (items: readonly SidebarItem[]) => items.map((i) => [i.id, i.label, i.path, (i.children ?? []).map((c) => [c.id, c.label, c.path])]);

  it('holds Home, Fleet, Workspace, then Engineering (PRD 612), under Dashboard, in that order', () => {
    const [dashboard] = SIDEBAR;
    expect(rows(dashboard.items)).toEqual([
      ['home', 'Home', '/app', []],
      ['fleet', 'Fleet', '/app/fleet', []],
      ['workspace', 'Workspace', '/app/workspace', []],
      ['engineering', 'Engineering', '/app/engineering', []],
    ]);
    expect(dashboard.items.some((i) => i.leavesApp)).toBe(false);
  });

  it('holds PRDs, Bug Fixes, Visual Updates, Questions (Shared with me, History) and Knowledge under Work, in that order (PRD 627)', () => {
    const [, work] = SIDEBAR;
    expect(rows(work.items)).toEqual([
      ['prds', 'PRDs', '/prd', []],
      ['bugs', 'Bug Fixes', '/bugs', []],
      ['visual', 'Visual Updates', '/visual', []],
      ['questions', 'Questions', '/ask', [['for-me', 'Shared with me', '/ask/for-me'], ['history', 'History', '/ask/history']]],
      ['knowledge', 'Knowledge', '/knowledge', []],
    ]);
    expect(work.items.some((i) => i.leavesApp)).toBe(false);
  });

  it('holds Fleets, then Repositories (PRD 612), under Settings', () => {
    const [, , settings] = SIDEBAR;
    expect(rows(settings.items)).toEqual([
      ['fleets', 'Fleets', '/app/settings/fleets', []],
      ['repositories', 'Repositories', '/app/settings/repositories', []],
    ]);
    expect(settings.items.some((i) => i.leavesApp)).toBe(false);
  });

  it('holds Docs and Release notes under Omni, each leaving the app', () => {
    const [, , , omni] = SIDEBAR;
    expect(omni.items.map((i) => [i.id, i.label, i.path, i.leavesApp])).toEqual([
      ['docs', 'Docs', '/docs', true],
      ['releases', 'Release notes', '/releases', true],
    ]);
  });
});

describe('currentItem and pageTrail', () => {
  const CASES: Array<[string, string | null, string | null]> = [
    ['/app', 'home', 'Dashboard › Home'],
    ['/app/fleet', 'fleet', 'Dashboard › Fleet'],
    ['/app/fleet?fleet=beaver&period=30d', 'fleet', 'Dashboard › Fleet'],
    ['/app/workspace', 'workspace', 'Dashboard › Workspace'],
    ['/app/workspace?period=season', 'workspace', 'Dashboard › Workspace'],
    ['/app/engineering', 'engineering', 'Dashboard › Engineering'],
    ['/app/engineering?period=30d&sort=merged', 'engineering', 'Dashboard › Engineering'],
    ['/app/engineering/vertuoza/pdf-builder', 'engineering', 'Dashboard › Engineering'],
    ['/app/engineering/vertuoza/pdf-builder?period=30d', 'engineering', 'Dashboard › Engineering'],
    ['/app/settings/fleets', 'fleets', 'Settings › Fleets'],
    ['/app/settings/repositories', 'repositories', 'Settings › Repositories'],
    ['/prd', 'prds', 'Work › PRDs'],
    ['/prd/3f2a', 'prds', 'Work › PRDs'],
    ['/prd?who=all', 'prds', 'Work › PRDs'],
    ['/bugs', 'bugs', 'Work › Bug Fixes'],
    ['/bugs/3f2a', 'bugs', 'Work › Bug Fixes'],
    ['/visual', 'visual', 'Work › Visual Updates'],
    ['/visual/3f2a?tab=variations', 'visual', 'Work › Visual Updates'],
    ['/visualise', null, null],
    ['/ask', 'questions', 'Work › Questions'],
    ['/ask/7c1e', 'questions', 'Work › Questions'],
    ['/ask/q/42', 'questions', 'Work › Questions'],
    ['/ask/for-me', 'for-me', 'Work › Questions › Shared with me'],
    ['/ask/history', 'history', 'Work › Questions › History'],
    ['/knowledge', 'knowledge', 'Work › Knowledge'],
    ['/knowledge?domain=x', 'knowledge', 'Work › Knowledge'],
    ['/nowhere', null, null],
    ['/application', null, null],
    ['/', null, null],
  ];
  const read = (path: string | null) => pageTrail(path)?.crumbs.map((c) => c.label).join(' › ') ?? null;

  it.each(CASES)('%s falls under %s, its trail %s', (path, item, trail) => {
    expect(currentItem(path)).toBe(item);
    expect(read(path)).toBe(trail);
  });

  it('reads no item from nothing', () => {
    expect(currentItem(null)).toBeNull();
    expect(pageTrail(null)).toBeNull();
  });

  it('links a nested item\'s section, and never its group, which has no page of its own', () => {
    expect(pageTrail('/ask/for-me')?.crumbs).toEqual([
      { label: 'Work' },
      { label: 'Questions', path: '/ask' },
      { label: 'Shared with me' },
    ]);
  });

  it('links the last crumb back to its page from a page under it, and not on the page itself, whatever the query', () => {
    expect(pageTrail('/prd/3f2a')?.crumbs.at(-1)).toEqual({ label: 'PRDs', path: '/prd' });
    expect(pageTrail('/app/engineering/vertuoza/pdf-builder')?.crumbs.at(-1)).toEqual({ label: 'Engineering', path: '/app/engineering' });
    expect(pageTrail('/prd')?.crumbs.at(-1)).toEqual({ label: 'PRDs' });
    expect(pageTrail('/prd/?who=all')?.crumbs.at(-1)).toEqual({ label: 'PRDs' });
    expect(pageTrail('/app/workspace#top')?.crumbs.at(-1)).toEqual({ label: 'Workspace' });
  });

  it('carries the section\'s sprite, a nested item its parent\'s, and none for a section without one', () => {
    expect(pageTrail('/app/workspace')?.sprite).toBe('menu-workspace');
    expect(pageTrail('/prd/3f2a')?.sprite).toBe('menu-prds');
    expect(pageTrail('/ask/history')?.sprite).toBe('menu-questions');
    expect(pageTrail('/app/settings/fleets')?.sprite).toBeNull();
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
    for (const id of ['home', 'fleet', 'workspace', 'engineering', 'bugs', 'visual', 'history', 'knowledge', 'fleets', 'repositories', 'docs', 'releases'] as const) expect(badgeOf(id, counts)).toBeNull();
  });
});
