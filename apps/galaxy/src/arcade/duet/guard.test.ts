import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sure } from '../test/sure';

// The loaded-on-demand guard (PRD 1633): everything under arcade/duet/ is OMNI DUET's own engine, and a
// page that never opens its cabinet must never download it. The arcade imports it with a dynamic
// `import('./duet/index')` when the cabinet opens (ArcadeApp.tsx). This walks the static, run-time
// import graph from the arcade's entries and fails if any file outside arcade/duet/ imports a file
// inside it. Type-only imports vanish in the build and are not counted; a dynamic import() is not
// static. OMNI KART's folder has the same guard (kart/guard.test.ts).

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DUET = join(SRC, 'arcade', 'duet') + '/';
const ENTRIES = ['arcade/ArcadeClient.tsx', 'arcade/ArcadeApp.tsx', 'play-dock/DockGame.tsx', 'play-dock/PlayDock.tsx'];

// `import x from 'm'`, `import { a,\n b } from 'm'`, `import 'm'`, `export { a } from 'm'`: never
// `import type`/`export type`, never a dynamic import('m').
const STATIC = /(?:^|\n)\s*(import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/g;

/** The specifiers a file imports at run time. */
function runtimeImports(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(STATIC)) if (!m[2]) out.push(sure(m[3], 'the import\'s specifier'));
  return out;
}

const EXT = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

/** Every file reachable through static run-time imports from `entries`, with the files in this source tree each imports. */
function importGraph(entries: string[], read: (file: string) => string | null): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  const todo = entries.map((e) => join(SRC, e));
  while (todo.length) {
    const file = sure(todo.pop(), 'a file to read');
    if (graph.has(file)) continue;
    const text = read(file);
    if (text === null) continue;
    const local: string[] = [];
    graph.set(file, local);
    for (const spec of runtimeImports(text)) {
      if (!spec.startsWith('.')) continue;
      const base = resolve(dirname(file), spec);
      const hit = EXT.map((x) => base + x).find((f) => read(f) !== null);
      if (hit) { local.push(hit); todo.push(hit); }
    }
  }
  return graph;
}

/** The files outside arcade/duet/ that import a file inside it at run time, relative to src/. */
function duetOutsideDuet(graph: Map<string, string[]>): string[] {
  return [...graph]
    .filter(([file, imports]) => !file.startsWith(DUET) && imports.some((f) => f.startsWith(DUET)))
    .map(([file]) => relative(SRC, file));
}

const disk = (file: string) => (/\.(ts|tsx)$/.test(file) && existsSync(file) ? readFileSync(file, 'utf8') : null);

describe('OMNI DUET\'s loaded-on-demand guard', () => {
  it('walks the arcade from its entries, through the duet scene and the games', () => {
    const files = [...importGraph(ENTRIES, disk).keys()].map((f) => relative(SRC, f));
    expect(files).toContain('arcade/ArcadeApp.tsx');
    expect(files).toContain('arcade/scenes/duet.tsx');
    expect(files).toContain('arcade/scenes/duet.ts');
    expect(files).toContain('arcade/games/index.ts');
  });

  it('finds the arcade never reaches arcade/duet/ but through its dynamic import', () => {
    const graph = importGraph(ENTRIES, disk);
    expect([...graph.keys()].filter((f) => f.startsWith(DUET))).toEqual([]);
    expect(duetOutsideDuet(graph)).toEqual([]);
    expect(disk(join(SRC, 'arcade/ArcadeApp.tsx'))).toContain("import('./duet/index')");
  });

  it('lets a scene import the game\'s types: type-only imports pass', () => {
    const sceneText = sure(disk(join(SRC, 'arcade/scenes/duet.ts')), 'the duet scene');
    expect(sceneText).toMatch(/typeof import\('\.\.\/duet\/index'\)/);
    const scene = join(SRC, 'arcade/scenes/duet.ts');
    const typed = (file: string) => (file === scene ? `import type { Run } from '../duet/run';\n${disk(file)}` : disk(file));
    expect(duetOutsideDuet(importGraph(ENTRIES, typed))).toEqual([]);
  });

  it('fails on a static import of the game added to the arcade, to a scene, or through a re-export', () => {
    const app = join(SRC, 'arcade/ArcadeApp.tsx');
    const added = (file: string) => (file === app ? `import { createDuet } from './duet/index';\n${disk(file)}` : disk(file));
    expect(duetOutsideDuet(importGraph(ENTRIES, added))).toEqual(['arcade/ArcadeApp.tsx']);
    const scene = join(SRC, 'arcade/scenes/duet.ts');
    const bare = (file: string) => (file === scene ? `import '../duet/rules';\n${disk(file)}` : disk(file));
    expect(duetOutsideDuet(importGraph(ENTRIES, bare))).toEqual(['arcade/scenes/duet.ts']);
    const common = join(SRC, 'arcade/scenes/common.ts');
    const reexport = (file: string) => (file === common ? `export { RULES } from '../duet/rules';\n${disk(file)}` : disk(file));
    expect(duetOutsideDuet(importGraph(ENTRIES, reexport))).toEqual(['arcade/scenes/common.ts']);
  });
});
