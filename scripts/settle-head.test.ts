// The settle gate of the `checks` workflow (PRD 598): after the wait, a branch whose tip moved past
// the run's head sha answers stale=true, one still at it stale=false, and a `gh` that fails answers
// stale=false, so a settle that cannot look never skips the checks. A pull request whose files are all
// docs answers stale=true at once. `gh` is a stub on PATH: no test calls GitHub.
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

function settle({ ghTip, ghExit = 0, files, filesExit = 0 }: { ghTip: string; ghExit?: number; files?: string[]; filesExit?: number }) {
  const dir = mkdtempSync(join(tmpdir(), 'settle-head-'));
  dirs.push(dir);
  const gh = join(dir, 'gh');
  writeFileSync(
    gh,
    [
      '#!/usr/bin/env bash',
      'case "$*" in',
      `  */files*) [ "${filesExit}" = 0 ] || { echo "gh: files boom" >&2; exit ${filesExit}; }; printf '%s\\n' ${(files ?? []).map((f) => `'${f}'`).join(' ')}; exit 0 ;;`,
      'esac',
      `[ "${ghExit}" = 0 ] || { echo "gh: boom" >&2; exit ${ghExit}; }`,
      `echo "${ghTip}"`,
      '',
    ].join('\n'),
  );
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
      ...(files === undefined ? {} : { SETTLE_PR: '42' }),
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

  it('answers stale=true at once when every file of the pull request is docs', () => {
    const run = settle({ ghTip: HEAD, files: ['README.md', 'docs/guide/loop.md', '.omni-loop/knowledge/product/rules.md'] });
    expect(run.status).toBe(0);
    expect(run.output).toBe('stale=true\n');
    expect(run.stdout).toContain('#42 changes only docs');
  });

  it('runs the checks when one file is not docs', () => {
    const run = settle({ ghTip: HEAD, files: ['README.md', 'kit/lib/config.ts'] });
    expect(run.status).toBe(0);
    expect(run.output).toBe('stale=false\n');
  });

  it('runs the checks with one stderr line when the files cannot be read', () => {
    const run = settle({ ghTip: HEAD, files: ['README.md'], filesExit: 1 });
    expect(run.status).toBe(0);
    expect(run.output).toBe('stale=false\n');
    expect(run.stderr.split('\n').filter((line) => line.startsWith('settle:'))).toHaveLength(1);
  });
});
