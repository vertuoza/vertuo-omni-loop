import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { settingsPages as mapPages } from '../settings/map';
import { SETTINGS, SETTINGS_LANDING } from './sidebar';
import { SETTINGS_TABS } from './section-tabs';

// The guard of issue 2538: a Settings page nothing links to is a page nobody finds. Every folder under
// app/app/settings/ that holds a page is one of the Settings tabs, so a new Settings page fails here
// until it gets its tab.

const SETTINGS_DIR = fileURLToPath(new URL('../../app/app/settings/', import.meta.url));

/** The Settings pages on disk, as their paths: each folder under app/app/settings/ holding a page.tsx. */
function settingsPages(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .filter((name) => readdirSync(join(dir, name)).includes('page.tsx'))
    .map((name) => `/app/settings/${name}`)
    .sort();
}

describe('the Settings tabs', () => {
  it('link every Settings page on disk', () => {
    const pages = settingsPages(SETTINGS_DIR);
    expect(pages).toContain('/app/settings/fleets');
    expect(pages.filter((page) => !SETTINGS_TABS.some((tab) => tab.href === page))).toEqual([]);
  });

  it('AC-1: list the map\'s pages in its order, the same as the menu, API keys included', () => {
    expect(SETTINGS_TABS.map((tab) => [tab.label, tab.href])).toEqual(mapPages().map((p) => [p.label, p.path]));
    expect(SETTINGS_TABS.map((tab) => tab.href)).toEqual((SETTINGS.pages ?? []).map((p) => p.path));
    expect(SETTINGS_TABS.map((tab) => tab.href)).toContain('/app/settings/api-keys');
  });

  it('AC-4: keep every address as it was, and land /app/settings on Fleets', () => {
    expect([...SETTINGS_TABS.map((tab) => tab.href)].sort()).toEqual(['/app/settings/api-keys', '/app/settings/business', '/app/settings/fleets', '/app/settings/jev', '/app/settings/playbook', '/app/settings/repositories']);
    expect(SETTINGS_LANDING).toBe('/app/settings/fleets');
  });
});
