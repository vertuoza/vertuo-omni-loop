// The committed engine page (PRD 1108 s4): `kit/dist/pitch-engine/` is only ever a build of
// `kit/pitch-engine/`, so it must be exactly what `pnpm kit:build` gives today — rebuild and commit it.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const COMMITTED = join(repoRoot, 'kit/dist/pitch-engine');

describe('the committed engine page', () => {
  it('equals a fresh build byte for byte, file for file — rebuild with `pnpm kit:build` and commit it', () => {
    const out = mkdtempSync(join(tmpdir(), 'pitch-engine-dist-'));
    execFileSync('node', [join(repoRoot, 'kit/build.ts'), join(out, 'omni.mjs')], { cwd: tmpdir(), stdio: 'ignore' });
    const fresh = join(out, 'pitch-engine');
    expect(readdirSync(COMMITTED).sort()).toEqual(['engine.js', 'index.html']);
    expect(readdirSync(fresh).sort()).toEqual(['engine.js', 'index.html']);
    for (const file of ['engine.js', 'index.html']) expect(readFileSync(join(fresh, file)).equals(readFileSync(join(COMMITTED, file)))).toBe(true);
  });

  it('is a page that loads the bundle, and the bundle carries no source path of this computer', () => {
    expect(readFileSync(join(COMMITTED, 'index.html'), 'utf8')).toContain('<script src="engine.js"></script>');
    expect(readFileSync(join(COMMITTED, 'engine.js'), 'utf8')).not.toContain(repoRoot);
  });
});
