import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildFunctions, FUNCTIONS } from '../build.ts';

// The GitHub App's Vercel functions start (#1084). Vercel compiles a TypeScript function file by file
// and keeps every `import './x.ts'` as written, so a function whose source imports TypeScript failed
// every webhook with ERR_MODULE_NOT_FOUND. Each file under `api/` is what Vercel deploys: it must be
// plain JavaScript that Node loads as it is, with no TypeScript beside it, and the bundle `build.ts`
// makes from today's source.

const api = fileURLToPath(new URL('../api/', import.meta.url));

/** How loading `file` in a bare Node process ends: `loaded`, or the error's code. */
function load(file: string): string {
  const script = `import(${JSON.stringify(file)}).then(() => console.log('loaded'), (e) => console.log(e.code ?? e.name))`;
  return execFileSync(process.execPath, ['--no-experimental-strip-types', '--input-type=module', '-e', script], {
    encoding: 'utf8',
    env: {},
  }).trim();
}

describe('the Vercel functions', () => {
  const files = readdirSync(api);

  it('are plain JavaScript, never TypeScript Vercel would compile file by file', () => {
    expect(files.filter((name) => /\.[cm]?tsx?$/.test(name))).toEqual([]);
    expect(files).toEqual(expect.arrayContaining(['github.mjs', 'inngest.mjs', 'server-event.mjs', 'health.mjs']));
  });

  it('builds every function vercel.json configures, and configures every function it builds', () => {
    const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as { functions: Record<string, { maxDuration: number }> };
    expect(Object.keys(config.functions).sort()).toEqual(FUNCTIONS.map((name) => `api/${name}.mjs`).sort());
    expect(config.functions['api/health.mjs']).toEqual({ maxDuration: 10 });
  });

  it('are the bundles a fresh build makes: run `node apps/omni-app/build.ts` after changing the app', async () => {
    const fresh = mkdtempSync(join(tmpdir(), 'omni-app-api-'));
    try {
      await buildFunctions(fresh);
      for (const name of FUNCTIONS) {
        expect(readFileSync(`${api}${name}.mjs`, 'utf8') === readFileSync(join(fresh, `${name}.mjs`), 'utf8'), `api/${name}.mjs is stale`).toBe(true);
      }
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  });

  it.each(['github.mjs', 'inngest.mjs', 'health.mjs'])('%s loads in plain Node, every import found', (name) => {
    expect(load(`${api}${name}`)).toBe('loaded');
  });
});
