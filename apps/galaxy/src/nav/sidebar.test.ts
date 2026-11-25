import { SPRITE_DEFS } from '@omni/design';
import { describe, expect, it, vi } from 'vitest';
import { ANTI_SIDEBAR, OMNI, SETTINGS, SETTINGS_LANDING, SIDEBAR, badgeOf, currentItem, isAlarm, isQuiet, pageTrail, type SidebarItem } from './sidebar';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';
import { present } from '../ask/test/test-item';

// /app/settings' page only redirects: next/navigation's redirect, recorded instead of thrown.
const redirected = vi.hoisted((): string[] => []);
vi.mock('next/navigation', () => ({ redirect: (to: string) => void redirected.push(to) }));

// The app's sidebar as data (PRD 438, regrouped by PRD 572 and PRD 733): Dashboard and Work, then the foot's Settings, Docs
// and Release notes, and the two pure reads
// the shell makes of a path, the item it falls under and the top bar's trail (issue 704).

describe('SIDEBAR', () => {
  it('holds Inbox with no label, Dashboard and Work, and no Settings group (PRD 733, omni-loop-22)', () => {
    expect(SIDEBAR.map((g) => [g.id, g.label])).toEqual([
      ['inbox', null],
      ['dashboard', 'Dashboard'],
      ['work', 'Work'],
    ]);
  });

  it('gives every Dashboard and Work section and Settings its own 16 px sprite, and Docs and Release notes none (issue 653, PRD 733)', () => {
    const [inbox, dashboard, work] = SIDEBAR;
    assertDefined(inbox, 'the Inbox group');
    assertDefined(dashboard, 'the Dashboard group');
    assertDefined(work, 'the Work group');
    const drawn = [...inbox.items, ...dashboard.items, ...work.items, SETTINGS];
    expect(drawn.map((i) => [i.id, i.sprite])).toEqual([
      ['inbox', 'menu-inbox'], ['ai-fleet', 'menu-ai-fleet'], ['supervisor', 'menu-supervisor'], ['home', 'menu-home'], ['fleet', 'menu-fleet'], ['loop', 'menu-loop'], ['runners', 'item-box'], ['workspace', 'menu-workspace'], ['engineering', 'menu-engineering'],
      ['products', 'coin'], ['roadmaps', 'menu-roadmaps'], ['ideas', 'tile-block'], ['concepts', 'menu-concepts'], ['prds', 'menu-prds'], ['bugs', 'menu-bugs'], ['visual', 'menu-visual'], ['knowledge', 'menu-knowledge'],
      ['settings', 'menu-settings'],
    ]);
    for (const item of drawn) expect([SPRITE_DEFS[present(item.sprite, item.id)]?.w, SPRITE_DEFS[present(item.sprite, item.id)]?.h], item.id).toEqual([16, 16]);
    expect(OMNI.filter((i) => i.sprite)).toEqual([]);
  });

  const rows = (items: readonly SidebarItem[]) => items.map((i) => [i.id, i.label, i.path, (i.pages ?? []).map((p) => [p.label, p.path])]);

  it('holds Home, Fleet, Loop beside it (PRD 1139), Runners after Loop (PRD 1830), Workspace, then Engineering (PRD 612), under Dashboard, in that order', () => {
    const [, dashboard] = SIDEBAR;
    assertDefined(dashboard, 'the Dashboard group');
    expect(rows(dashboard.items)).toEqual([
      ['home', 'Home', '/app', []],
      ['fleet', 'Fleet', '/app/fleet', []],
      ['loop', 'Loop', '/app/loop', []],
      ['runners', 'Runners', '/app/runners', []],
      ['workspace', 'Workspace', '/app/workspace', []],
      ['engineering', 'Engineering', '/app/engineering', []],
    ]);
    expect(dashboard.items.some((i) => i.leavesApp)).toBe(false);
  });

  it('holds the Inbox first, at /app/inbox, its pages Done and Workspace not drawn as menu lines (omni-loop-22), AI Fleet right under it (PRD 3233 s3), then Supervisor (omni-loop-34 s5)', () => {
    const [inbox] = SIDEBAR;
    assertDefined(inbox, 'the Inbox group');
    expect(rows(inbox.items)).toEqual([
      ['inbox', 'Inbox', '/app/inbox', [['Done', '/app/inbox/done'], ['Workspace', '/app/inbox/workspace']]],
      ['ai-fleet', 'AI Fleet', '/app/ai-fleet', []],
      ['supervisor', 'Supervisor', '/app/supervisor', []],
    ]);
  });

  it('holds Products first (PRD 1364), Roadmaps (PRD 1162), Ideas (PRD 1246), Concepts (PRD 1272), then PRDs, Bug Fixes, Visual Updates and Knowledge under Work: Questions and Waiting left for the Inbox (omni-loop-22)', () => {
    const [, , work] = SIDEBAR;
    assertDefined(work, 'the Work group');
    expect(work.items[0]?.id).toBe('products');
    expect(rows(work.items)).toEqual([
      ['products', 'Products', '/app/products', []],
      ['roadmaps', 'Roadmaps', '/roadmaps', []],
      ['ideas', 'Ideas', '/ideas', []],
      ['concepts', 'Concepts', '/concepts', []],
      ['prds', 'PRDs', '/prd', []],
      ['bugs', 'Bug Fixes', '/bugs', []],
      ['visual', 'Visual Updates', '/visual', []],
      ['knowledge', 'Knowledge', '/knowledge', []],
    ]);
    expect(work.items.some((i) => i.leavesApp)).toBe(false);
  });

  it('holds one Settings entry at /app/settings, its pages Fleets, Repositories, Business, Jev and Playbook (PRD 733, PRD 748, PRD 859, PRD 812, PRD 2417)', () => {
    expect(rows([SETTINGS])).toEqual([
      ['settings', 'Settings', '/app/settings', [['Fleets', '/app/settings/fleets'], ['Repositories', '/app/settings/repositories'], ['Business', '/app/settings/business'], ['Jev', '/app/settings/jev'], ['Playbook', '/app/settings/playbook']]],
    ]);
    expect(SETTINGS.leavesApp).toBeFalsy();
  });

  it('lands /app/settings on its Fleets page (PRD 733)', () => {
    expect(SETTINGS_LANDING).toBe('/app/settings/fleets');
    expect(present(SETTINGS.pages?.[0], 'the first Settings page').path).toBe(SETTINGS_LANDING);
  });

  it('redirects /app/settings\' page to that landing (PRD 733)', async () => {
    const { default: SettingsPage } = await import('../../app/app/settings/page.tsx');
    redirected.length = 0;
    SettingsPage();
    expect(redirected).toEqual(['/app/settings/fleets']);
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
    ['/app/loop', 'loop', 'Dashboard › Loop'],
    ['/app/loop/0b7c6a2e-1f00-4d6a-9c55-2f1f3e4a5b6c', 'loop', 'Dashboard › Loop'],
    ['/app/loopy', 'home', 'Dashboard › Home'],
    ['/app/runners', 'runners', 'Dashboard › Runners'],
    ['/app/workspace', 'workspace', 'Dashboard › Workspace'],
    ['/app/workspace?period=season', 'workspace', 'Dashboard › Workspace'],
    ['/app/engineering', 'engineering', 'Dashboard › Engineering'],
    ['/app/engineering?period=30d&sort=merged', 'engineering', 'Dashboard › Engineering'],
    ['/app/engineering/demo-org/pdf-builder', 'engineering', 'Dashboard › Engineering'],
    ['/app/engineering/demo-org/pdf-builder?period=30d', 'engineering', 'Dashboard › Engineering'],
    ['/app/settings', 'settings', 'Settings'],
    ['/app/settings/fleets', 'settings', 'Settings › Fleets'],
    ['/app/settings/fleets?fleet=beaver', 'settings', 'Settings › Fleets'],
    ['/app/settings/repositories', 'settings', 'Settings › Repositories'],
    ['/app/settings/business', 'settings', 'Settings › Business'],
    ['/app/settings/jev', 'settings', 'Settings › Jev'],
    ['/app/settings/playbook', 'settings', 'Settings › Playbook'],
    ['/app/settingsx', 'home', 'Dashboard › Home'],
    ['/app/products', 'products', 'Work › Products'],
    ['/app/products/p-1', 'products', 'Work › Products'],
    ['/app/productsx', 'home', 'Dashboard › Home'],
    ['/roadmaps', 'roadmaps', 'Work › Roadmaps'],
    ['/roadmaps?product=p-1', 'roadmaps', 'Work › Roadmaps'],
    ['/roadmaps/0b7c6a2e-1f00-4d6a-9c55-2f1f3e4a5b6c', 'roadmaps', 'Work › Roadmaps'],
    ['/roadmapsx', null, null],
    ['/prd', 'prds', 'Work › PRDs'],
    ['/prd/3f2a', 'prds', 'Work › PRDs'],
    ['/prd?who=all', 'prds', 'Work › PRDs'],
    ['/app/inbox', 'inbox', 'Inbox'],
    ['/app/inbox?kind=outbox', 'inbox', 'Inbox'],
    ['/app/inbox/done', 'inbox', 'Inbox › Done'],
    ['/app/inbox/workspace', 'inbox', 'Inbox › Workspace'],
    ['/app/inboxes', 'home', 'Dashboard › Home'],
    ['/bugs', 'bugs', 'Work › Bug Fixes'],
    ['/bugs/3f2a', 'bugs', 'Work › Bug Fixes'],
    ['/visual', 'visual', 'Work › Visual Updates'],
    ['/visual/3f2a?tab=variations', 'visual', 'Work › Visual Updates'],
    ['/visualise', null, null],
    ['/ask/7c1e', 'inbox', 'Inbox'],
    ['/ask/q/42', 'inbox', 'Inbox'],
    ['/knowledge', 'knowledge', 'Work › Knowledge'],
    ['/ideas/acme/widgets', 'ideas', 'Work › Ideas'],
    ['/ideasx', null, null],
    ['/concepts', 'concepts', 'Work › Concepts'],
    ['/concepts/3f2a?tab=boards', 'concepts', 'Work › Concepts'],
    ['/conceptsx', null, null],
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
    expect(pageTrail('/app/inbox/done')?.crumbs).toEqual([
      { label: 'Inbox', path: '/app/inbox' },
      { label: 'Done' },
    ]);
    expect(pageTrail('/ask/q/42')?.crumbs).toEqual([{ label: 'Inbox', path: '/app/inbox' }]);
  });

  it('links the last crumb back to its page from a page under it, and not on the page itself, whatever the query', () => {
    expect(pageTrail('/prd/3f2a')?.crumbs.at(-1)).toEqual({ label: 'PRDs', path: '/prd' });
    expect(pageTrail('/app/engineering/demo-org/pdf-builder')?.crumbs.at(-1)).toEqual({ label: 'Engineering', path: '/app/engineering' });
    expect(pageTrail('/app/inbox/done')?.crumbs.at(-1)).toEqual({ label: 'Done' });
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
    expect(pageTrail('/app/settings/business')?.crumbs).toEqual([
      { label: 'Settings', path: '/app/settings' },
      { label: 'Business' },
    ]);
  });

  it('ends a PRD\'s and a fix\'s page on its item, named once the page names it, and a PRD\'s review screen on Review for approval (omni-loop-20 s6)', () => {
    const id = '00000000-0000-4000-8000-0000000000d1';
    expect(pageTrail(`/prd/${id}`)?.crumbs).toEqual([{ label: 'Work' }, { label: 'PRDs', path: '/prd' }, { label: 'PRD' }]);
    expect(pageTrail(`/prd/${id}?tab=spec`, 'PRD #216')?.crumbs).toEqual([{ label: 'Work' }, { label: 'PRDs', path: '/prd' }, { label: 'PRD #216' }]);
    expect(pageTrail(`/prd/${id}/review`, 'PRD #216')?.crumbs).toEqual([
      { label: 'Work' }, { label: 'PRDs', path: '/prd' }, { label: 'PRD #216', path: `/prd/${id}` }, { label: 'Review for approval' },
    ]);
    expect(pageTrail(`/visual/${id}`, 'Visual #548')?.crumbs.at(-1)).toEqual({ label: 'Visual #548' });
    expect(pageTrail(`/bugs/${id}`)?.crumbs.at(-1)).toEqual({ label: 'Bug fix' });
    expect(pageTrail(`/bugs/${id}/review`)?.crumbs.at(-1)).toEqual({ label: 'Bug Fixes', path: '/bugs' });
    expect(pageTrail('/prd/at/x', 'PRD #216')?.crumbs.at(-1)).toEqual({ label: 'PRDs', path: '/prd' });
    expect(pageTrail('/prd', 'PRD #216')?.crumbs.at(-1)).toEqual({ label: 'PRDs' });
  });

  it('carries the section\'s sprite, a page its section\'s, and none for an entry without one', () => {
    expect(pageTrail('/app/workspace')?.sprite).toBe('menu-workspace');
    expect(pageTrail('/prd/3f2a')?.sprite).toBe('menu-prds');
    expect(pageTrail('/ask/q/42')?.sprite).toBe('menu-inbox');
    expect(pageTrail('/app/settings/fleets')?.sprite).toBe('menu-settings');
    expect(pageTrail('/docs')?.sprite).toBeNull();
  });
});

describe('AI Fleet (PRD 3233 s3, AC-1)', () => {
  it('has /app/ai-fleet fall under it, its trail reading AI Fleet, and a fleet\'s AI Fleet › <name>', () => {
    expect(currentItem('/app/ai-fleet?fleet=orion')).toBe('ai-fleet');
    expect(currentItem('/app/fleet')).toBe('fleet');
    expect(pageTrail('/app/ai-fleet')?.crumbs).toEqual([{ label: 'AI Fleet' }]);
    expect(pageTrail('/app/ai-fleet', 'Orion')?.crumbs).toEqual([{ label: 'AI Fleet', path: '/app/ai-fleet' }, { label: 'Orion' }]);
    expect(pageTrail('/app/ai-fleet', 'Orion')?.sprite).toBe('menu-ai-fleet');
  });
});

describe('badgeOf', () => {
  const counts = { questions: 3, shared: 1, outbox: 2, approvals: 1, runners: 4, reviews: 6, total: 12 };

  it('AC-1: gives Inbox the waiting total, the only filled count', () => {
    expect(badgeOf('inbox', counts)).toBe(12);
    expect(isQuiet('inbox')).toBe(false);
    expect(badgeOf('inbox', { ...counts, total: 0 })).toBeNull();
  });

  it('gives Runners the jobs waiting for an answer as a quiet count, none at 0 (PRD 2255)', () => {
    expect(badgeOf('runners', counts)).toBe(4);
    expect(isQuiet('runners')).toBe(true);
    expect(badgeOf('runners', { ...counts, runners: 0 })).toBeNull();
  });

  it('gives Supervisor the open high findings as a red filled count, none at 0 or unread (omni-loop-34 s5)', () => {
    expect(badgeOf('supervisor', { ...counts, supervisor: 2 })).toBe(2);
    expect(badgeOf('supervisor', { ...counts, supervisor: 0 })).toBeNull();
    expect(badgeOf('supervisor', counts)).toBeNull();
    expect(isQuiet('supervisor')).toBe(false);
    expect(isAlarm('supervisor')).toBe(true);
    expect(isAlarm('inbox')).toBe(false);
    expect(currentItem('/app/supervisor?finding=f1')).toBe('supervisor');
    expect(pageTrail('/app/supervisor')).toEqual({ crumbs: [{ label: 'Supervisor' }], sprite: 'menu-supervisor' });
  });

  it('gives no badge to any other entry, PRDs included', () => {
    for (const id of ['ai-fleet', 'home', 'fleet', 'loop', 'workspace', 'engineering', 'roadmaps', 'ideas', 'prds', 'bugs', 'visual', 'knowledge', 'settings', 'docs', 'releases'] as const) expect(badgeOf(id, counts)).toBeNull();
  });
});

describe('ANTI_SIDEBAR (PRD 2490)', () => {
  it('holds one Anti-loop group with Anti-dashboard and Anti-work, each with a 16 px sprite', () => {
    expect(ANTI_SIDEBAR.map((g) => [g.id, g.label, g.items.map((i) => [i.id, i.label, i.path])])).toEqual([
      ['anti', 'Anti-loop', [['anti-dashboard', 'Anti-dashboard', '/anti'], ['anti-work', 'Anti-work', '/anti/work']]],
    ]);
    for (const entry of ANTI_SIDEBAR.flatMap((g) => g.items)) expect([SPRITE_DEFS[present(entry.sprite, entry.id)]?.w, SPRITE_DEFS[present(entry.sprite, entry.id)]?.h], entry.id).toEqual([16, 16]);
  });

  it('reads /anti and /anti/work as those entries, and the trail Anti-loop › …', () => {
    expect(currentItem('/anti')).toBe('anti-dashboard');
    expect(currentItem('/anti/work')).toBe('anti-work');
    expect(pageTrail('/anti')?.crumbs).toEqual([{ label: 'Anti-loop' }, { label: 'Anti-dashboard' }]);
    expect(pageTrail('/anti/work')?.crumbs).toEqual([{ label: 'Anti-loop' }, { label: 'Anti-work' }]);
  });

  it('leaves every forward path as it was', () => {
    expect(currentItem('/app')).toBe('home');
    expect(currentItem('/app/settings/fleets')).toBe('settings');
    expect(pageTrail('/app')?.crumbs).toEqual([{ label: 'Dashboard' }, { label: 'Home' }]);
  });
});
