import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sure } from '../test/sure';

// The loaded-on-demand guard (PRD 2101): everything under arcade/pong/ is PULSAR VOLLEY's own, its
// microphone included, and a page that never opens its cabinet must never download it. The arcade
// imports it with a dynamic `import('./pong/index')` when the cabinet opens (ArcadeApp.tsx). This walks
// the static, run-time import graph from the arcade's entries and fails if any file outside arcade/pong/
// imports a file inside it. Type-only imports vanish in the build and are not counted; a dynamic
// import() is not static.

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PONG = join(SRC, 'arcade', 'pong') + '/';
const ENTRIES = ['arcade/ArcadeClient.tsx', 'arcade/ArcadeApp.tsx', 'play-dock/DockGame.tsx', 'play-dock/PlayDock.tsx'];
const RESOLVE = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

// `import x from 'm'`, `import { a,\n b } from 'm'`, `import 'm'`, `export { a } from 'm'`, and their
// `type` forms, which are told apart; a dynamic import('m') never matches.
const STATIC = /(?:^|\n)\s*(import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/g;

type Read = (file: string) => string | null;

/** The files in this source tree that `file` imports at run time. */
function localImports(file: string, read: Read): string[] {
  const text = read(file) ?? '';
  return [...text.matchAll(STATIC)]
    .filter((m) => !m[2])
    .map((m) => sure(m[3], "the import's specifier"))
    .filter((spec) => spec.startsWith('.'))
    .flatMap((spec) => RESOLVE.map((x) => resolve(dirname(file), spec) + x).find((f) => read(f) !== null) ?? []);
}

/** The files outside arcade/pong/ that import a file inside it at run time, walking from the entries, relative to src/. */
function pongReachedFrom(read: Read): { files: string[]; offenders: string[] } {
  const seen = new Map<string, string[]>();
  const todo = ENTRIES.map((e) => join(SRC, e)).filter((f) => read(f) !== null);
  for (let file = todo.pop(); file !== undefined; file = todo.pop()) {
    if (seen.has(file)) continue;
    const imports = localImports(file, read);
    seen.set(file, imports);
    todo.push(...imports);
  }
  const offenders = [...seen].filter(([file, imports]) => !file.startsWith(PONG) && imports.some((f) => f.startsWith(PONG)));
  return { files: [...seen.keys()].map((f) => relative(SRC, f)), offenders: offenders.map(([file]) => relative(SRC, file)) };
}

const disk: Read = (file) => (/\.(ts|tsx)$/.test(file) && existsSync(file) ? readFileSync(file, 'utf8') : null);
const withLine = (target: string, line: string): Read => (file) => (file === join(SRC, target) ? `${line}\n${disk(file) ?? ''}` : disk(file));

describe('PULSAR VOLLEY\'s loaded-on-demand guard', () => {
  it('walks the arcade from its entries, through the pong scene and the games', () => {
    const { files } = pongReachedFrom(disk);
    for (const f of ['arcade/ArcadeApp.tsx', 'arcade/scenes/pong.tsx', 'arcade/scenes/pong.ts', 'arcade/scenes/pong.live.ts', 'arcade/games/index.ts']) {
      expect(files).toContain(f);
    }
  });

  it('finds the arcade never reaches arcade/pong/ but through its dynamic import', () => {
    const { files, offenders } = pongReachedFrom(disk);
    expect(files.filter((f) => f.startsWith('arcade/pong/'))).toEqual([]);
    expect(offenders).toEqual([]);
    expect(disk(join(SRC, 'arcade/ArcadeApp.tsx'))).toContain("import('./pong/index')");
  });

  it('lets a scene import the game\'s types: type-only imports pass', () => {
    expect(disk(join(SRC, 'arcade/scenes/pong.ts'))).toMatch(/import type \{ LimitName \} from '\.\.\/pong\/rules'/);
    expect(pongReachedFrom(withLine('arcade/scenes/pong.tsx', "import type { PitchSource } from '../pong/mic';")).offenders).toEqual([]);
  });

  it('fails on a static import of the game added to the arcade, to a scene, or through a re-export', () => {
    expect(pongReachedFrom(withLine('arcade/ArcadeApp.tsx', "import { createPong } from './pong/index';")).offenders).toEqual(['arcade/ArcadeApp.tsx']);
    expect(pongReachedFrom(withLine('arcade/scenes/pong.ts', "import '../pong/mic';")).offenders).toEqual(['arcade/scenes/pong.ts']);
    expect(pongReachedFrom(withLine('arcade/scenes/common.ts', "export { LIMITS } from '../pong/rules';")).offenders).toEqual(['arcade/scenes/common.ts']);
  });
});
