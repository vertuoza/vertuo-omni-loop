// PRD 420: `npm install -g` of this repository installs the bundle alone. The bundle carries every
// module it needs, so the root package declares no runtime dependencies for npm to download.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dig } from '../bin/dig.ts';

const pkg: unknown = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

describe('the root package', () => {
  it('has no dependencies: what the kit uses is a devDependency, bundled into kit/dist/omni.mjs', () => {
    expect(dig(pkg, 'dependencies') ?? {}).toEqual({});
    const devDependencies = dig(pkg, 'devDependencies');
    if (typeof devDependencies !== 'object' || devDependencies === null) throw new Error('package.json has no devDependencies');
    expect(Object.keys(devDependencies)).toEqual(expect.arrayContaining(['yaml', 'zod', 'esbuild']));
  });

  it('installs the committed bundle as omni', () => {
    expect(dig(pkg, 'bin')).toEqual({ omni: 'kit/dist/omni.mjs' });
  });
});
