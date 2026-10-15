import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Viewport } from 'next';
import { describe, expect, it, vi } from 'vitest';

// Zoom on the reading pages (bug 1826). The root layout keeps the Game Boy's viewport, never zoomed
// by a pinch or a double tap; every section on the reading surface overrides it so a person reading
// on a phone can zoom. Next merges a section's viewport over the root's key by key, as `merged` does.

vi.mock('server-only', () => ({}));

const ROOT = () => import('../../app/layout.tsx');

const READING = {
  '/app': () => import('../../app/app/layout.tsx'),
  '/ask': () => import('../../app/ask/layout.tsx'),
  '/bugs': () => import('../../app/bugs/layout.tsx'),
  '/concepts': () => import('../../app/concepts/layout.tsx'),
  '/docs': () => import('../../app/docs/layout.tsx'),
  '/ideas': () => import('../../app/ideas/layout.tsx'),
  '/knowledge': () => import('../../app/knowledge/layout.tsx'),
  '/prd': () => import('../../app/prd/layout.tsx'),
  '/releases': () => import('../../app/releases/layout.tsx'),
  '/roadmaps': () => import('../../app/roadmaps/layout.tsx'),
  '/signup': () => import('../../app/signup/layout.tsx'),
  '/visual': () => import('../../app/visual/layout.tsx'),
};

// A section whose layout sets a viewport of its own and is not on the reading surface: `/design`,
// the design system's own showcase, dark and drawn at full size.
const NOT_READING = ['/design'];

const APP = fileURLToPath(new URL('../../app/', import.meta.url));

/** Every section whose layout exports a viewport, as `/<folder>`. */
function sectionsWithViewport(): string[] {
  return readdirSync(APP, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => {
      try {
        return readFileSync(`${APP}${entry.name}/layout.tsx`, 'utf8').includes('export const viewport');
      } catch {
        return false;
      }
    })
    .map((entry) => `/${entry.name}`)
    .sort();
}

async function merged(load: () => Promise<{ viewport: Viewport }>): Promise<Viewport> {
  const [{ viewport: root }, { viewport: section }] = await Promise.all([ROOT(), load()]);
  return { ...root, ...section };
}

describe('the root layout', () => {
  it('keeps the Game Boy never zoomed by a pinch or a double tap', async () => {
    const { viewport } = await ROOT();
    expect(viewport.userScalable).toBe(false);
    expect(viewport.maximumScale).toBe(1);
  });
});

describe('the sections with a viewport of their own', () => {
  it('are each on the reading surface, or named as not', () => {
    expect(sectionsWithViewport()).toEqual([...Object.keys(READING), ...NOT_READING].sort());
  });
});

describe.each(Object.entries(READING))('the %s layout', (_, load) => {
  it('lets a person zoom the page', async () => {
    const viewport = await merged(load);
    expect(viewport.userScalable).toBe(true);
    expect(viewport.maximumScale).toBeGreaterThan(1);
  });

  it('keeps the root\'s width and edge-to-edge fit', async () => {
    const viewport = await merged(load);
    expect(viewport.width).toBe('device-width');
    expect(viewport.viewportFit).toBe('cover');
  });
});
