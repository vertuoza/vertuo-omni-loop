import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sure } from '../arcade/sure';

// The lazy loading guard (PRD 817): Phaser is about 350 KB gzipped, and only SUPER OMNI WORLD needs
// it. It is fetched with a dynamic import('phaser') by the platformer's one way in
// (arcade/platformer/PlatformerScreen.tsx), so a page that never opens the game never downloads it.
// This walks the static imports from the dock's game and the arcade's Invaders scene, and fails if
// any file outside arcade/platformer/ imports Phaser statically. Type-only imports vanish in the build
// and are not counted.

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLATFORMER = join(SRC, 'arcade', 'platformer') + '/';
const ENTRIES = ['play-dock/DockGame.tsx', 'play-dock/PlayDock.tsx', 'arcade/scenes/invaders.tsx', 'arcade/scenes/invaders.ts'];

// `import x from 'm'`, `import { a,\n b } from 'm'`, `import 'm'`, `export { a } from 'm'`: never
// `import type`/`export type`, never a dynamic import('m').
const STATIC = /(?:^|\n)\s*(import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/g;

/** The specifiers a file imports at run time. */
export function runtimeImports(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(STATIC)) if (!m[2]) out.push(sure(m[3], 'the import\'s specifier'));
  return out;
}

const EXT = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

/** Every file reachable through static run-time imports from `entries`, and the packages each imports. */
export function importGraph(entries: string[], read: (file: string) => string | null): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  const todo = entries.map((e) => join(SRC, e));
  while (todo.length) {
    const file = sure(todo.pop(), 'a file to read');
    if (graph.has(file)) continue;
    const text = read(file);
    if (text === null) continue;
    const packages: string[] = [];
    graph.set(file, packages);
    for (const spec of runtimeImports(text)) {
      if (!spec.startsWith('.')) { packages.push(spec); continue; }
      const base = resolve(dirname(file), spec);
      const hit = EXT.map((x) => base + x).find((f) => read(f) !== null);
      if (hit) todo.push(hit);
    }
  }
  return graph;
}

/** The files outside arcade/platformer/ that import Phaser statically, relative to src/. */
export function phaserOutsidePlatformer(graph: Map<string, string[]>): string[] {
  return [...graph]
    .filter(([file, packages]) => !file.startsWith(PLATFORMER) && packages.some((p) => p === 'phaser' || p.startsWith('phaser/')))
    .map(([file]) => relative(SRC, file));
}

const disk = (file: string) => (/\.(ts|tsx)$/.test(file) && existsSync(file) ? readFileSync(file, 'utf8') : null);

describe('the lazy loading guard', () => {
  it('reads multi-line, bare and re-exporting imports, and skips type-only and dynamic ones', () => {
    const text = [
      "import {\n  a,\n  b,\n} from './x';",
      "import './side.css';",
      "export { c } from '../y';",
      "import type Phaser from 'phaser';",
      "export type { P } from 'phaser';",
      "const load = () => import('phaser');",
    ].join('\n');
    expect(runtimeImports(text)).toEqual(['./x', './side.css', '../y']);
  });

  it('walks from the dock and the arcade\'s Invaders into the platformer\'s one way in', () => {
    const graph = importGraph(ENTRIES, disk);
    const files = [...graph.keys()].map((f) => relative(SRC, f));
    expect(files).toContain('play-dock/DockPlatformer.tsx');
    expect(files).toContain('arcade/platformer/PlatformerScreen.tsx');
    expect(files).toContain('arcade/games/invaders.ts');
  });

  it('finds no static Phaser import outside arcade/platformer/', () => {
    expect(phaserOutsidePlatformer(importGraph(ENTRIES, disk))).toEqual([]);
  });

  it('fails on a static import of Phaser added to DockGame.tsx', () => {
    const dockGame = join(SRC, 'play-dock/DockGame.tsx');
    const added = (file: string) => (file === dockGame ? `import 'phaser';\n${disk(file)}` : disk(file));
    expect(phaserOutsidePlatformer(importGraph(ENTRIES, added))).toEqual(['play-dock/DockGame.tsx']);
    const named = (file: string) => (file === dockGame ? `import Phaser from 'phaser';\n${disk(file)}` : disk(file));
    expect(phaserOutsidePlatformer(importGraph(ENTRIES, named))).toEqual(['play-dock/DockGame.tsx']);
  });
});
