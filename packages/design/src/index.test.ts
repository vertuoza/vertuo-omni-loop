import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as index from './index.ts';
import { dig } from 'vertuo-omni-plan/kit/bin/dig.ts';
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';

const src = dirname(fileURLToPath(import.meta.url));
const pkg: unknown = JSON.parse(readFileSync(join(src, '..', 'package.json'), 'utf8'));
const files = readdirSync(src);
const modules = files.filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.d.ts') && f !== 'index.ts');
const exported: Record<string, unknown> = index;

/** The keys of a value read from JSON: none when it is no object. */
const keysIn = (value: unknown): string[] => (typeof value === 'object' && value !== null ? Object.keys(value) : []);

describe('@omni/design', () => {
  it('is named @omni/design and depends on no React or Next', () => {
    expect(dig(pkg, 'name')).toBe('@omni/design');
    const deps = ['dependencies', 'peerDependencies', 'devDependencies'].flatMap((field) => keysIn(dig(pkg, field)));
    for (const name of ['react', 'react-dom', 'next']) expect(deps).not.toContain(name);
  });

  it('re-exports every module whole from the index', async () => {
    expect(modules.length).toBeGreaterThan(0);
    for (const file of modules) {
      const mod: unknown = await import(`./${file}`);
      for (const name of keysIn(mod)) expect(exported[name], `${file}: ${name}`).toBe(propertyOf(mod, name));
    }
  });

  it('re-exports each module with export *, its types read from the typed source, no declaration file beside it', () => {
    const js = readFileSync(join(src, 'index.ts'), 'utf8');
    for (const file of modules) expect(js).toContain(`export * from './${file}';`);
    // PRD 725 typed the modules: the hand-written `.d.mts` files and index.d.ts are gone.
    expect(files.filter((f) => f.endsWith('.d.ts') || f.endsWith('.d.mts'))).toEqual([]);
    expect(dig(pkg, 'exports', '.')).toEqual({ types: './src/index.ts', default: './src/index.ts' });
  });
});
