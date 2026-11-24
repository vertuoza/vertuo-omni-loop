import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SETTINGS_LANDING_PATH, SETTINGS_MAP, settingsPages, uncoveredSettingsDirs, entriesWithoutPage } from './map';

const here = dirname(fileURLToPath(import.meta.url));
const settingsDir = join(here, '..', '..', 'app', 'app', 'settings');

describe('SETTINGS_MAP', () => {
  it('AC-6: groups the pages in Workspace, Agents and Developers, most touched first', () => {
    expect(SETTINGS_MAP.map((s) => [s.label, s.pages.map((p) => p.label)])).toEqual([
      ['Workspace', ['Fleets', 'Repositories', 'Business']],
      ['Agents', ['Jev', 'Playbook']],
      ['Developers', ['API keys']],
    ]);
  });

  it('AC-4: keeps every existing address and lands on Fleets', () => {
    expect(settingsPages().map((p) => p.path)).toEqual([
      '/app/settings/fleets',
      '/app/settings/repositories',
      '/app/settings/business',
      '/app/settings/jev',
      '/app/settings/playbook',
      '/app/settings/api-keys',
    ]);
    expect(SETTINGS_LANDING_PATH).toBe('/app/settings/fleets');
  });

  it('gives each section and page a summary, and each page an id and keywords', () => {
    for (const section of SETTINGS_MAP) {
      expect(section.summary).not.toBe('');
      expect(section.pages.length).toBeGreaterThan(0);
      for (const page of section.pages) {
        expect(page.id).not.toBe('');
        expect(page.summary).not.toBe('');
        expect(page.keywords.length).toBeGreaterThan(0);
      }
    }
  });

  it('writes every id, label and path once', () => {
    const pages = settingsPages();
    for (const key of ['id', 'label', 'path'] as const) {
      const values = pages.map((p) => p[key]);
      expect(new Set(values).size, `duplicate ${key}`).toBe(values.length);
    }
    const sections = SETTINGS_MAP.map((s) => s.label);
    expect(new Set(sections).size).toBe(sections.length);
  });

  it('AC-2: every settings directory that holds a page is in the map', () => {
    const dirs = readdirSync(settingsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(settingsDir, d.name, 'page.tsx')))
      .map((d) => d.name);
    expect(uncoveredSettingsDirs(dirs), 'missing from the map').toEqual([]);
  });

  it('AC-3: every map entry has a page', () => {
    const missing = entriesWithoutPage((dir) => existsSync(join(settingsDir, dir, 'page.tsx')));
    expect(missing, 'map entries with no page').toEqual([]);
  });

  it('AC-2: names the directory a map lacks', () => {
    expect(uncoveredSettingsDirs(['fleets', 'brand-new'])).toEqual(['brand-new']);
  });

  it('AC-3: names the entry whose path has no page', () => {
    expect(entriesWithoutPage((dir) => dir !== 'jev')).toEqual(['/app/settings/jev']);
  });
});
