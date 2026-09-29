import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// The frame paints at once (PRD 657 s4): every route under /app and /prd has a loading.tsx, so the
// layout's frame (the sidebar, the top bar) and a skeleton of the page are sent before any of the
// page's data is read. Read from the folders, as the router reads them.

const GALAXY = join(import.meta.dirname, '..', '..');

/** Every folder under `dir`, `dir` included. */
function folders(dir: string): string[] {
  return [dir, ...readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? folders(path) : [];
  })];
}

const routes = ['app/app', 'app/prd']
  .flatMap((root) => folders(join(GALAXY, root)))
  .filter((dir) => existsSync(join(dir, 'page.tsx')))
  .map((dir) => relative(GALAXY, dir));

describe('every page under /app and /prd has its skeleton', () => {
  it('finds the pages', () => {
    expect(routes).toEqual(expect.arrayContaining(['app/app', 'app/app/workspace', 'app/app/fleet', 'app/prd', 'app/prd/[id]']));
  });

  it.each(routes)('%s has a loading.tsx that draws a skeleton', (route) => {
    const file = join(GALAXY, route, 'loading.tsx');
    expect(existsSync(file), `${route}/loading.tsx`).toBe(true);
    const source = readFileSync(file, 'utf8');
    expect(source).toMatch(/export default function/);
    expect(source).toMatch(/src\/skeleton\//);
  });
});
