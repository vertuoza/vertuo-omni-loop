import { describe, expect, it } from 'vitest';
import { SETTINGS_MAP_PAGES } from './settings-map';
import { isCurrent, settingsNav } from './settings-nav';

describe('the settings navigation model (omni-loop-27 s2)', () => {
  it('marks exactly the page showing, for each page of the map', () => {
    for (const page of SETTINGS_MAP_PAGES) {
      const nav = settingsNav(page.path);
      const marked = nav.groups.flatMap((g) => g.pages).filter((p) => p.current).map((p) => p.path);
      expect(marked).toEqual([page.path]);
      expect(nav.current?.path).toBe(page.path);
    }
  });

  it('keeps the map\'s groups and order, API keys included', () => {
    const nav = settingsNav('/app/settings/api-keys');
    expect(nav.groups.map((g) => g.label)).toEqual(['Workspace', 'Access', 'Knowledge']);
    expect(nav.groups.flatMap((g) => g.pages).map((p) => p.path)).toContain('/app/settings/api-keys');
  });

  it('marks nothing outside the map, and a subpage or trailing slash counts as its page', () => {
    expect(settingsNav('/app/settings').current).toBeNull();
    expect(settingsNav(null).current).toBeNull();
    expect(isCurrent('/app/settings/jev/', '/app/settings/jev')).toBe(true);
    expect(isCurrent('/app/settings/playbook/x', '/app/settings/playbook')).toBe(true);
    expect(isCurrent('/app/settings/jevs', '/app/settings/jev')).toBe(false);
  });
});
