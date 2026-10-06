// The settle gate of the `checks` workflow (PRD 598): after the wait, a branch whose tip moved past
// the run's head sha answers stale=true, one still at it stale=false, and a `gh` that fails answers
// stale=false, so a settle that cannot look never skips the checks. `gh` is a stub on PATH: no test
// calls GitHub.
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const script = join(dirname(fileURLToPath(import.meta.url)), 'settle-head.sh');
const HEAD = 'a'.repeat(40);
const dirs: string[] = [];

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

function settle({ ghTip, ghExit = 0 }: { ghTip: string; ghExit?: number }) {
  const dir = mkdtempSync(join(tmpdir(), 'settle-head-'));
  dirs.push(dir);
  const gh = join(dir, 'gh');
  writeFileSync(gh, `#!/usr/bin/env bash\n[ "${ghExit}" = 0 ] || { echo "gh: boom" >&2; exit ${ghExit}; }\necho "${ghTip}"\n`);
  chmodSync(gh, 0o755);
  const output = join(dir, 'output');
  writeFileSync(output, '');
  const run = spawnSync('bash', [script], {
    encoding: 'utf8',
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      SETTLE_SECONDS: '0',
      GITHUB_HEAD_REF: 'feat/topic',
      SETTLE_HEAD_SHA: HEAD,
      GITHUB_REPOSITORY: 'acme/widgets',
      GITHUB_OUTPUT: output,
    },
  });
  return { ...run, output: readFileSync(output, 'utf8') };
}

describe('settle-head.sh', () => {
  it('answers stale=false when the branch tip is still the head sha', () => {
    const run = settle({ ghTip: HEAD });
    expect(run.status).toBe(0);
    expect(run.output).toBe('stale=false\n');
  });

  it('answers stale=true when the branch tip moved past the head sha', () => {
    const run = settle({ ghTip: 'b'.repeat(40) });
    expect(run.status).toBe(0);
    expect(run.output).toBe('stale=true\n');
  });

  it('answers stale=false with one stderr line when gh fails', () => {
    const run = settle({ ghTip: HEAD, ghExit: 1 });
    expect(run.status).toBe(0);
    expect(run.output).toBe('stale=false\n');
    const lines = run.stderr.split('\n').filter((line) => line.startsWith('settle:'));
    expect(lines).toHaveLength(1);
  });
});
