// How `pnpm design` is wired (PRD omni-loop-11, slice s6): the package.json script runs the ratchet with
// the arguments it was given, then the detector, and exits with the ratchet's code; the repository's
// config points the design review at it. Nothing here reads GitHub, a model or the network.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const script = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts.design ?? '';

const scratch: string[] = [];
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A folder whose ratchet and detector only record their arguments, the ratchet exiting `ratchet`. */
function fake(ratchet: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'omni-design-'));
  scratch.push(dir);
  mkdirSync(join(dir, 'scripts'));
  const record = (name: string, code: number) =>
    `import { appendFileSync } from 'node:fs';\nappendFileSync('calls.log', '${name} ' + process.argv.slice(2).join(' ') + '\\n');\nprocess.exit(${String(code)});\n`;
  writeFileSync(join(dir, 'scripts/design-ratchet.ts'), record('ratchet', ratchet));
  writeFileSync(join(dir, 'scripts/design-detect.ts'), record('detector', 0));
  return dir;
}

const run = (dir: string, args: string[]) => {
  const result = spawnSync('/bin/sh', ['-c', `${script} ${args.map((arg) => `'${arg}'`).join(' ')}`], { cwd: dir, encoding: 'utf8' });
  return { code: result.status, calls: readFileSync(join(dir, 'calls.log'), 'utf8').trim().split('\n').map((line) => line.trim()) };
};

describe('pnpm design', () => {
  it('AC-6: the repository config points the design review at it, and omni config prints the command', () => {
    const printed = execFileSync('node', ['.omni-loop/bin/omni.mjs', 'config', 'commands.design'], { cwd: root, encoding: 'utf8' }).trim();
    expect(printed).toBe('pnpm design');
  });

  it('runs the ratchet with its arguments, then the detector, and exits 0 when the ratchet does', () => {
    expect(run(fake(0), ['--base', 'origin/main'])).toEqual({ code: 0, calls: ['ratchet --base origin/main', 'detector'] });
  });

  it('still runs the detector when the ratchet fails, and exits with the ratchet’s code', () => {
    expect(run(fake(1), [])).toEqual({ code: 1, calls: ['ratchet', 'detector'] });
    expect(run(fake(2), [])).toMatchObject({ code: 2 });
  });
});
