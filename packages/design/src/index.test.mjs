import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as index from './index.mjs';

const src = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(src, '..', 'package.json'), 'utf8'));
const files = readdirSync(src);
const modules = files.filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs') && f !== 'index.mjs');

describe('@omni/design', () => {
  it('is named @omni/design and depends on no React or Next', () => {
    expect(pkg.name).toBe('@omni/design');
    const deps = { ...pkg.dependencies, ...pkg.peerDependencies, ...pkg.devDependencies };
    for (const name of ['react', 'react-dom', 'next']) expect(deps).not.toHaveProperty(name);
  });

  it('re-exports every module whole from the index', async () => {
    expect(modules.length).toBeGreaterThan(0);
    for (const file of modules) {
      const mod = await import(`./${file}`);
      for (const name of Object.keys(mod)) expect(index[name], `${file}: ${name}`).toBe(mod[name]);
    }
  });

  it('re-exports each module with export *, and declares each module in a file of its own', () => {
    const js = readFileSync(join(src, 'index.mjs'), 'utf8');
    const dts = readFileSync(join(src, 'index.d.ts'), 'utf8');
    for (const file of modules) {
      expect(js).toContain(`export * from './${file}';`);
      expect(dts).toContain(`export * from './${file}';`);
      expect(files).toContain(file.replace(/\.mjs$/, '.d.mts'));
    }
  });
});
