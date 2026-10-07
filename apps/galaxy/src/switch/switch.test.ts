import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SETTINGS, SIDEBAR } from '../nav/sidebar.ts';
import { APP_HOME, GAME_HOME } from './switch';

// The app's sections and the two homes (PRD 238): the sidebar's in-app items (src/nav/sidebar.ts, PRD
// 438, which replaced /app's cards; grouped as Dashboard and Work by PRD 572, Settings at the foot since
// PRD 733), and the pages under them, each name a page on disk, so a renamed route fails here before an
// entry or a tab leads nowhere.

const pageOf = (path: string) => new URL(`../../app${path}/page.tsx`, import.meta.url);

describe('the app\'s sections', () => {
  it('are the sidebar\'s Dashboard and Work entries and Settings, and their pages, each opening a page that exists', () => {
    const inApp = [...SIDEBAR.flatMap((g) => g.items), SETTINGS].flatMap((i) => [i, ...(i.pages ?? [])]);
    expect(inApp.map((i) => i.path)).toEqual(['/app', '/app/fleet', '/app/loop', '/app/workspace', '/app/engineering', '/roadmaps', '/prd', '/bugs', '/visual', '/ask', '/ask/for-me', '/ask/history', '/knowledge', '/app/settings', '/app/settings/fleets', '/app/settings/repositories', '/app/settings/business', '/app/settings/products', '/app/settings/jev']);
    for (const { path } of inApp) expect(existsSync(pageOf(path)), `app${path}/page.tsx`).toBe(true);
  });
});

describe('the two homes', () => {
  it('are /app on the app\'s side, and the arcade\'s menu on the game\'s', () => {
    expect(APP_HOME).toBe('/app');
    expect(GAME_HOME).toBe('/#menu');
  });

  it('are pages that exist', () => {
    expect(existsSync(pageOf(APP_HOME)), 'app/app/page.tsx').toBe(true);
    expect(existsSync(new URL('../../app/page.tsx', import.meta.url)), 'app/page.tsx').toBe(true);
  });
});
