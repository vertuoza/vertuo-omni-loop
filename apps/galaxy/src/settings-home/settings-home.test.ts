import { describe, expect, it } from 'vitest';
import { SETTINGS_MAP, SETTINGS_MAP_PAGES } from '../nav/settings-map';
import { settingsHome } from './settings-home';

describe('the settings home model (omni-loop-32)', () => {
  it('AC-1: lists every group and page of the map once, in the map order, with description and who may change it', () => {
    const home = settingsHome(SETTINGS_MAP, {});
    expect(home.map((g) => [g.label, g.pages.map((p) => p.path)])).toEqual(
      SETTINGS_MAP.map((g) => [g.label, g.pages.map((p) => p.path)]),
    );
    const cards = home.flatMap((g) => g.pages);
    expect(cards).toHaveLength(SETTINGS_MAP_PAGES.length);
    for (const [i, card] of cards.entries()) {
      const page = SETTINGS_MAP_PAGES[i];
      expect(card.label).toBe(page?.label);
      expect(card.description).toBe(page?.holds);
      expect(card.changedBy).toBe(page?.changedBy);
    }
  });

  it('fails for a page of the map missing from the home', () => {
    const home = settingsHome(SETTINGS_MAP, {});
    const shown = home.flatMap((g) => g.pages.map((p) => p.path));
    expect(SETTINGS_MAP_PAGES.map((p) => p.path).filter((path) => !shown.includes(path))).toEqual([]);
  });

  it('AC-2: a page with something to set up carries its chip, every other page none', () => {
    const home = settingsHome(SETTINGS_MAP, {
      '/app/settings/repositories': 'No repository tracked',
      '/app/settings/jev': 'Jev is off',
    });
    const chips = Object.fromEntries(home.flatMap((g) => g.pages).map((p) => [p.path, p.chip]));
    expect(chips).toEqual({
      '/app/settings/business': null,
      '/app/settings/repositories': 'No repository tracked',
      '/app/settings/fleets': null,
      '/app/settings/api-keys': null,
      '/app/settings/jev': 'Jev is off',
      '/app/settings/playbook': null,
    });
  });

  it('treats an empty chip as none and ignores a status for a page not in the map', () => {
    const home = settingsHome(SETTINGS_MAP, { '/app/settings/business': '', '/app/settings/nowhere': 'Lost' });
    const cards = home.flatMap((g) => g.pages);
    expect(cards.every((p) => p.chip === null)).toBe(true);
    expect(cards.map((p) => p.path)).not.toContain('/app/settings/nowhere');
  });

  it('keeps the groups it is given, so a page added to the map appears with no change here', () => {
    const map = [{ label: 'New', pages: [{ label: 'X', path: '/app/settings/x', holds: 'Holds x.', changedBy: 'Any member' }] }];
    expect(settingsHome(map, {})).toEqual([
      { label: 'New', pages: [{ label: 'X', path: '/app/settings/x', description: 'Holds x.', changedBy: 'Any member', chip: null }] },
    ]);
  });
});
