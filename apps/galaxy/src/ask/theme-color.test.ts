import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from './theme-tokens';

// The browser's bar on the five app layouts (PRD 284): one colour, Omni's ground, with no media
// query. The metadata is static and cannot read the stored choice, and Omni is the default. The
// root's own color-scheme follows the theme, so the viewport's stays 'light dark'.

vi.mock('server-only', () => ({}));

const LAYOUTS = {
  '/app': () => import('../../app/app/layout.tsx'),
  '/ask': () => import('../../app/ask/layout.tsx'),
  '/knowledge': () => import('../../app/knowledge/layout.tsx'),
  '/prd': () => import('../../app/prd/layout.tsx'),
  '/releases': () => import('../../app/releases/layout.tsx'),
};

describe.each(Object.entries(LAYOUTS))('the %s layout', (_, load) => {
  it('paints the browser bar Omni\'s ground, one value for every visitor', async () => {
    const { viewport } = await load();
    expect(viewport.themeColor).toBe(TOKENS.omni.ground);
  });

  it('keeps colorScheme at light dark', async () => {
    const { viewport } = await load();
    expect(viewport.colorScheme).toBe('light dark');
  });
});
