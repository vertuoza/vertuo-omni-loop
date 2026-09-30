import { SPRITE_DEFS } from '@omni/design';
import { describe, expect, it } from 'vitest';
import { OMNI, SETTINGS, SETTINGS_LANDING, SIDEBAR, badgeOf, currentItem, pageTrail, type SidebarItem } from './sidebar';

// The app's sidebar as data (PRD 438, regrouped by PRD 572 and PRD 733): Dashboard and Work, then the foot's Settings, Docs
// and Release notes, and the two pure reads
// the shell makes of a path, the item it falls under and the top bar's trail (issue 704).

describe('SIDEBAR', () => {
  it('holds Dashboard and Work, and no Settings group (PRD 733)', () => {
    expect(SIDEBAR.map((g) => [g.id, g.label])).toEqual([
      ['dashboard', 'Dashboard'],
      ['work', 'Work'],
    ]);
  });

  it('gives every Dashboard and Work section and Settings its own 16 px sprite, and Docs and Release notes none (issue 653, PRD 733)', () => {
    const [dashboard, work] = SIDEBAR;
    const drawn = [...dashboard.items, ...work.items, SETTINGS];
    expect(drawn.map((i) => [i.id, i.sprite])).toEqual([
      ['home', 'menu-home'], ['fleet', 'menu-fleet'], ['workspace', 'menu-workspace'], ['engineering', 'menu-engineering'],
      ['prds', 'menu-prds'], ['bugs', 'menu-bugs'], ['visual', 'menu-visual'], ['questions', 'menu-questions'], ['knowledge', 'menu-knowledge'],
      ['settings', 'menu-settings'],
    ]);
    for (const item of drawn) expect([SPRITE_DEFS[item.sprite!]?.w, SPRITE_DEFS[item.sprite!]?.h], item.id).toEqual([16, 16]);
    expect(OMNI.filter((i) => i.sprite)).toEqual([]);
  });

  const rows = (items: readonly SidebarItem[]) => items.map((i) => [i.id, i.label, i.path, (i.pages ?? []).map((p) => [p.label, p.path])]);

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

  it('holds PRDs, Bug Fixes, Visual Updates, Questions and Knowledge under Work, Questions\' pages not drawn as menu lines (PRD 733)', () => {
    const [, work] = SIDEBAR;
    expect(rows(work.items)).toEqual([
      ['prds', 'PRDs', '/prd', []],
      ['bugs', 'Bug Fixes', '/bugs', []],
      ['visual', 'Visual Updates', '/visual', []],
      ['questions', 'Questions', '/ask', [['Shared with me', '/ask/for-me'], ['History', '/ask/history']]],
      ['knowledge', 'Knowledge', '/knowledge', []],
    ]);
    expect(work.items.some((i) => i.leavesApp)).toBe(false);
  });

  it('holds one Settings entry at /app/settings, its pages Fleets and Repositories (PRD 733)', () => {
    expect(rows([SETTINGS])).toEqual([
      ['settings', 'Settings', '/app/settings', [['Fleets', '/app/settings/fleets'], ['Repositories', '/app/settings/repositories']]],
    ]);
    expect(SETTINGS.leavesApp).toBeFalsy();
  });

  it('lands /app/settings on its Fleets page (PRD 733)', () => {
    expect(SETTINGS_LANDING).toBe('/app/settings/fleets');
    expect(SETTINGS.pages?.[0].path).toBe(SETTINGS_LANDING);
  });

  it('holds Docs and Release notes for the foot, each leaving the app', () => {
    expect(OMNI.map((i) => [i.id, i.label, i.path, i.leavesApp])).toEqual([
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
    ['/app/settings', 'settings', 'Settings'],
    ['/app/settings/fleets', 'settings', 'Settings › Fleets'],
    ['/app/settings/fleets?fleet=beaver', 'settings', 'Settings › Fleets'],
    ['/app/settings/repositories', 'settings', 'Settings › Repositories'],
    ['/app/settingsx', 'home', 'Dashboard › Home'],
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
    ['/ask/for-me', 'questions', 'Work › Questions › Shared with me'],
    ['/ask/history', 'questions', 'Work › Questions › History'],
    ['/ask/history?page=2', 'questions', 'Work › Questions › History'],
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

  it('links a page\'s section, and never its group, which has no page of its own', () => {
    expect(pageTrail('/ask/for-me')?.crumbs).toEqual([
      { label: 'Work' },
      { label: 'Questions', path: '/ask' },
      { label: 'Shared with me' },
    ]);
  });

  it('links the last crumb back to its page from a page under it, and not on the page itself, whatever the query', () => {
    expect(pageTrail('/prd/3f2a')?.crumbs.at(-1)).toEqual({ label: 'PRDs', path: '/prd' });
    expect(pageTrail('/app/engineering/vertuoza/pdf-builder')?.crumbs.at(-1)).toEqual({ label: 'Engineering', path: '/app/engineering' });
    expect(pageTrail('/ask/history')?.crumbs.at(-1)).toEqual({ label: 'History' });
    expect(pageTrail('/prd')?.crumbs.at(-1)).toEqual({ label: 'PRDs' });
    expect(pageTrail('/prd/?who=all')?.crumbs.at(-1)).toEqual({ label: 'PRDs' });
    expect(pageTrail('/app/workspace#top')?.crumbs.at(-1)).toEqual({ label: 'Workspace' });
  });

  it('gives the foot\'s Settings no group crumb: "Settings › Fleets", Settings linked (PRD 733)', () => {
    expect(pageTrail('/app/settings/fleets')?.crumbs).toEqual([
      { label: 'Settings', path: '/app/settings' },
      { label: 'Fleets' },
    ]);
    expect(pageTrail('/app/settings/repositories')?.crumbs).toEqual([
      { label: 'Settings', path: '/app/settings' },
      { label: 'Repositories' },
    ]);
  });

  it('carries the section\'s sprite, a page its section\'s, and none for an entry without one', () => {
    expect(pageTrail('/app/workspace')?.sprite).toBe('menu-workspace');
    expect(pageTrail('/prd/3f2a')?.sprite).toBe('menu-prds');
    expect(pageTrail('/ask/history')?.sprite).toBe('menu-questions');
    expect(pageTrail('/app/settings/fleets')?.sprite).toBe('menu-settings');
    expect(pageTrail('/docs')?.sprite).toBeNull();
  });
});

describe('badgeOf', () => {
  const counts = { questions: 3, shared: 1, outbox: 2, total: 5 };

  it('gives Questions the Questions part, the shared ones included', () => {
    expect(badgeOf('questions', counts)).toBe(3);
  });

  it('gives PRDs the Outbox part', () => {
    expect(badgeOf('prds', counts)).toBe(2);
    expect(badgeOf('prds', { ...counts, outbox: 0 })).toBeNull();
  });

  it('gives no badge at 0, nor to any other entry: only Questions and PRDs count (PRD 733)', () => {
    expect(badgeOf('questions', { ...counts, questions: 0 })).toBeNull();
    for (const id of ['home', 'fleet', 'workspace', 'engineering', 'bugs', 'visual', 'knowledge', 'settings', 'docs', 'releases'] as const) expect(badgeOf(id, counts)).toBeNull();
  });
});
