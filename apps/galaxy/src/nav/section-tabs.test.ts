import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SETTINGS_MAP_PAGES } from './settings-map';
import { SETTINGS_LANDING } from './sidebar';
import * as tabs from './section-tabs';

// omni-loop-27 s3: Settings has no section tabs. Its layout draws the grouped navigation from the
// settings map, so no screen carries a row of its own, and no settings address stops working.

const SETTINGS_DIR = join(import.meta.dirname, '../../app/app/settings');
const at = (path: string) => join(SETTINGS_DIR, path.replace('/app/settings/', ''));

describe('the Settings tabs are gone', () => {
  it('leaves only the Questions row in section-tabs', () => {
    expect(Object.keys(tabs)).not.toContain('SETTINGS_TABS');
    expect(tabs.QUESTIONS_TABS.length).toBeGreaterThan(0);
  });
});

describe('every settings address still answers', () => {
  it('AC-5: has a page for each path of the map, API keys included', () => {
    expect(SETTINGS_MAP_PAGES.map((page) => page.path)).toContain('/app/settings/api-keys');
    for (const { path } of SETTINGS_MAP_PAGES) expect(existsSync(join(at(path), 'page.tsx')), path).toBe(true);
  });

  it('AC-5: keeps the old addresses: SETTINGS_LANDING still answers, /app/settings is the home, and the moved Products ones redirect', () => {
    expect(readFileSync(join(SETTINGS_DIR, 'page.tsx'), 'utf8')).not.toContain('redirect(');
    expect(SETTINGS_MAP_PAGES.map((page) => page.path)).toContain(SETTINGS_LANDING);
    expect(existsSync(join(SETTINGS_DIR, 'products/route.ts'))).toBe(true);
    expect(existsSync(join(SETTINGS_DIR, 'products/[id]/route.ts'))).toBe(true);
  });
});
