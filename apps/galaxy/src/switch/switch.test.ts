import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SIDEBAR } from '../nav/sidebar.ts';
import { APP_HOME, GAME_HOME } from './switch';

// The app's sections and the two homes (PRD 238): the sidebar's Work items (src/nav/sidebar.ts, PRD
// 438, which replaced /app's cards) each name a page on disk, so a renamed route fails here before an
// item leads nowhere.

const pageOf = (path: string) => new URL(`../../app${path}/page.tsx`, import.meta.url);

describe('the app\'s sections', () => {
  it('are the sidebar\'s Work items, each opening a page that exists', () => {
    const work = SIDEBAR.find((g) => g.id === 'work')!.items.flatMap((i) => [i, ...(i.children ?? [])]);
    expect(work.map((i) => i.path)).toEqual(['/app', '/prd', '/ask', '/ask/for-me', '/ask/history', '/knowledge', '/app/fleets']);
    for (const { path } of work) expect(existsSync(pageOf(path)), `app${path}/page.tsx`).toBe(true);
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
