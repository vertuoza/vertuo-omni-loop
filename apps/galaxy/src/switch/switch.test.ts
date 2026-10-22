import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hrefOf, SETTINGS, SIDEBAR } from '../nav/sidebar.ts';
import { APP_HOME, GAME_HOME } from './switch';

// The app's sections and the two homes (PRD 238): the sidebar's in-app items (src/nav/sidebar.ts, PRD
// 438, which replaced /app's cards; grouped as Dashboard and Work by PRD 572, Settings at the foot since
// PRD 733), and the pages under them, each name a page on disk, so a renamed route fails here before an
// entry or a tab leads nowhere.

const APP = new URL('../../app/', import.meta.url);

/** The page.tsx a path opens, looked for through route groups too (`app/ask/(shell)/for-me/`, PRD 1705),
 * which Next.js leaves out of the URL. */
const pageOf = (path: string): URL => {
  const find = (dir: URL, segments: string[]): URL | null => {
    const [head, ...rest] = segments;
    if (head === undefined && existsSync(new URL('page.tsx', dir))) return new URL('page.tsx', dir);
    if (head !== undefined && existsSync(new URL(`${head}/`, dir))) {
      const found = find(new URL(`${head}/`, dir), rest);
      if (found) return found;
    }
    for (const group of readdirSync(dir).filter((name) => name.startsWith('('))) {
      const found = find(new URL(`${group}/`, dir), segments);
      if (found) return found;
    }
    return null;
  };
  return find(APP, path.split('/').filter(Boolean)) ?? new URL(`.${path}/page.tsx`, APP);
};

describe('the app\'s sections', () => {
  it('are the sidebar\'s Dashboard and Work entries and Settings, and their pages, each opening a page that exists', () => {
    // Ideas (PRD 1246) opens a board, /ideas/<owner>/<repo>, or Settings › Repositories with none.
    const inApp = [...SIDEBAR.flatMap((g) => g.items), SETTINGS].flatMap((i) => [{ path: hrefOf(i, null) }, ...(i.pages ?? [])]);
    expect(existsSync(new URL('../../app/ideas/[owner]/[repo]/page.tsx', import.meta.url)), 'app/ideas/[owner]/[repo]/page.tsx').toBe(true);
    expect(inApp.map((i) => i.path)).toEqual(['/app', '/app/fleet', '/app/loop', '/app/runners', '/app/workspace', '/app/engineering', '/app/products', '/roadmaps', '/app/settings/repositories', '/concepts', '/prd', '/app/waiting', '/bugs', '/visual', '/ask', '/ask/for-me', '/ask/history', '/knowledge', '/app/settings', '/app/settings/fleets', '/app/settings/repositories', '/app/settings/business', '/app/settings/jev']);
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
