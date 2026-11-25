import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SETTINGS_MAP, SETTINGS_MAP_PAGES } from './settings-map';
import { SETTINGS, SETTINGS_LANDING } from './sidebar';

const SETTINGS_DIR = join(import.meta.dirname, '../../app/app/settings');
const PREFIX = '/app/settings/';

/** The addresses of the pages that exist: each folder of app/app/settings holding a page.tsx. */
const pagesOnDisk = (): string[] =>
  readdirSync(SETTINGS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(SETTINGS_DIR, entry.name, 'page.tsx')))
    .map((entry) => `${PREFIX}${entry.name}`)
    .sort();

describe('the settings map (omni-loop-27)', () => {
  it('lists Workspace, Access and Knowledge, in that order', () => {
    expect(SETTINGS_MAP.map((g) => [g.label, g.pages.map((p) => p.label)])).toEqual([
      ['Workspace', ['Business', 'Repositories', 'Fleets']],
      ['Access', ['API keys', 'Jev']],
      ['Knowledge', ['Playbook']],
    ]);
  });

  it('gives every page a label, an address, one line of what it holds and who may change it', () => {
    for (const page of SETTINGS_MAP_PAGES) {
      expect(page.label, page.path).not.toBe('');
      expect(page.path.startsWith(PREFIX), page.path).toBe(true);
      expect(page.holds, page.path).toMatch(/\S.*\.$/);
      expect(page.holds, page.path).not.toContain('\n');
      expect(page.changedBy, page.path).not.toBe('');
    }
  });

  it('puts every settings page of app/app/settings in a group', () => {
    const mapped = SETTINGS_MAP_PAGES.map((p) => p.path);
    expect(pagesOnDisk().filter((path) => !mapped.includes(path))).toEqual([]);
  });

  it('has a page for every path of the map', () => {
    expect(SETTINGS_MAP_PAGES.map((p) => p.path).filter((path) => !pagesOnDisk().includes(path))).toEqual([]);
  });

  it('lists a page once, and lands on one of them', () => {
    const paths = SETTINGS_MAP_PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain(SETTINGS_LANDING);
  });

  it('is the list SETTINGS.pages is built from, API keys included', () => {
    expect(SETTINGS.pages).toEqual(SETTINGS_MAP_PAGES.map(({ label, path }) => ({ label, path })));
    expect(SETTINGS.pages?.some((p) => p.path === '/app/settings/api-keys')).toBe(true);
  });
});
