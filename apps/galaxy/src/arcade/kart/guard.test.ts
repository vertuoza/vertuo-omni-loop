import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sure } from '../test/sure';

// The loaded-on-demand guard (PRD 1359): everything under arcade/kart/ is OMNI KART's own engine, and
// a page that never opens its cabinet must never download it. The arcade imports it with a dynamic
// `import('./kart/index')` when the cabinet opens (ArcadeApp.tsx). This walks the static, run-time
// import graph from the arcade's entries and fails if any file outside arcade/kart/ imports a file
// inside it. Type-only imports vanish in the build and are not counted; a dynamic import() is not
// static.

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const KART = join(SRC, 'arcade', 'kart') + '/';
const ENTRIES = ['arcade/ArcadeClient.tsx', 'arcade/ArcadeApp.tsx', 'play-dock/DockGame.tsx', 'play-dock/PlayDock.tsx'];

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

/** Every file reachable through static run-time imports from `entries`, with the files in this source tree each imports. */
export function importGraph(entries: string[], read: (file: string) => string | null): Map<string, string[]> {
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

/** The files outside arcade/kart/ that import a file inside it at run time, relative to src/. */
export function kartOutsideKart(graph: Map<string, string[]>): string[] {
  return [...graph]
    .filter(([file, imports]) => !file.startsWith(KART) && imports.some((f) => f.startsWith(KART)))
    .map(([file]) => relative(SRC, file));
}

const disk = (file: string) => (/\.(ts|tsx)$/.test(file) && existsSync(file) ? readFileSync(file, 'utf8') : null);

describe('the loaded-on-demand guard', () => {
  it('reads multi-line, bare and re-exporting imports, and skips type-only and dynamic ones', () => {
    const text = [
      "import {\n  a,\n  b,\n} from './x';",
      "import './side.css';",
      "export { c } from '../y';",
      "import type { K } from '../kart/index';",
      "export type { P } from '../kart/art';",
      "const load = () => import('./kart/index');",
    ].join('\n');
    expect(runtimeImports(text)).toEqual(['./x', './side.css', '../y']);
  });

  it('walks the arcade from its entries, through its scenes and its games', () => {
    const files = [...importGraph(ENTRIES, disk).keys()].map((f) => relative(SRC, f));
    expect(files).toContain('arcade/ArcadeApp.tsx');
    expect(files).toContain('arcade/scenes/kart.tsx');
    expect(files).toContain('arcade/scenes/kart.ts');
    expect(files).toContain('arcade/games/index.ts');
    expect(files).toContain('arcade/scenes/common.ts');
  });

  it('finds the arcade never reaches arcade/kart/ but through its dynamic import', () => {
    const graph = importGraph(ENTRIES, disk);
    expect([...graph.keys()].filter((f) => f.startsWith(KART))).toEqual([]);
    expect(kartOutsideKart(graph)).toEqual([]);
    expect(disk(join(SRC, 'arcade/ArcadeApp.tsx'))).toContain("import('./kart/index')");
  });

  it('lets a scene import the game\'s types: type-only imports pass', () => {
    const sceneText = sure(disk(join(SRC, 'arcade/scenes/kart.ts')), 'the kart scene');
    expect(sceneText).toMatch(/typeof import\('\.\.\/kart\/index'\)/);
    expect(kartOutsideKart(importGraph(ENTRIES, disk))).toEqual([]);
  });

  it('fails on a static import of the game added to the arcade, to a scene, or through a re-export', () => {
    const app = join(SRC, 'arcade/ArcadeApp.tsx');
    const added = (file: string) => (file === app ? `import { createKart } from './kart/index';\n${disk(file)}` : disk(file));
    expect(kartOutsideKart(importGraph(ENTRIES, added))).toEqual(['arcade/ArcadeApp.tsx']);
    const scene = join(SRC, 'arcade/scenes/kart.ts');
    const bare = (file: string) => (file === scene ? `import '../kart/track';\n${disk(file)}` : disk(file));
    expect(kartOutsideKart(importGraph(ENTRIES, bare))).toEqual(['arcade/scenes/kart.ts']);
    const common = join(SRC, 'arcade/scenes/common.ts');
    const reexport = (file: string) => (file === common ? `export { TILE } from '../kart/track';\n${disk(file)}` : disk(file));
    expect(kartOutsideKart(importGraph(ENTRIES, reexport))).toEqual(['arcade/scenes/common.ts']);
  });
});
