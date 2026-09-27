import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_HOME, GAME_HOME, SECTIONS } from './switch';

// The app's sections and the two homes (PRD 238): one list draws /app's cards, and each path it
// names is a page on disk, so a renamed route fails here before a card leads nowhere. The fifth card,
// Release notes, opens the public /releases (PRD 262).

const pageOf = (path: string) => new URL(`../../app${path}/page.tsx`, import.meta.url);

describe('the app\'s sections', () => {
  it('are Questions, For me, History, Knowledge map and Release notes, in that order', () => {
    expect(SECTIONS.map((s) => [s.title, s.path])).toEqual([
      ['Questions', '/ask'],
      ['For me', '/ask/for-me'],
      ['History', '/ask/history'],
      ['Knowledge map', '/knowledge'],
      ['Release notes', '/releases'],
    ]);
  });

  it('each say what they hold, in one line', () => {
    expect(SECTIONS.map((s) => s.line)).toEqual([
      'The questions Claude is asking you now',
      'Questions a teammate shared with you',
      'Every question your workspace was asked',
      'Principles, rules and invariants, as a map',
      'What Omni Loop shipped, week by week',
    ]);
  });

  it('each open a page that exists', () => {
    for (const { path } of SECTIONS) expect(existsSync(pageOf(path)), `app${path}/page.tsx`).toBe(true);
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
