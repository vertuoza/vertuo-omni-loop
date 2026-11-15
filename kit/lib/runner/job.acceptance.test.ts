// A job's process on an acceptance line (PRD 2898 s8): it runs the e2e fallback as plain code, never an agent,
// and writes its exit as any job does. Every program is a fake script on the PATH; nothing reaches a model.
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { acceptanceLine, acceptanceOfLog } from './acceptance.ts';
import { runJobProcess } from './job.ts';

const SHA = 'd4'.repeat(20);
const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function job(line: string) {
  const { root } = makeRepo({ files: { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\ne2e:\n  url: https://preview.example.test\n', 'pnpm-lock.yaml': '', 'e2e/.keep': '' } });
  roots.push(root);
  const bin = join(root, '.bin');
  mkdirSync(bin);
  const calls = join(root, '.calls');
  for (const [name, body] of Object.entries({ git: 'exit 0', claude: 'exit 0', pnpm: 'if [ "$2" = "e2e" ]; then mkdir -p .e2e; echo \'{"schemaVersion":"report-1","run":{"results":[]}}\' > .e2e/report.json; fi; exit 0' })) {
    writeFileSync(join(bin, name), `#!/bin/sh\necho "${name} $*" >> "${calls}"\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  }
  const files = { line: join(root, '.line'), log: join(root, '.log'), exit: join(root, '.exit') };
  writeFileSync(files.line, `${line}\n`);
  writeFileSync(files.log, '');
  return { root, files, env: { PATH: `${bin}:/usr/bin:/bin` }, calls: () => (existsSync(calls) ? readFileSync(calls, 'utf8').trim().split('\n') : []) };
}

describe('runJobProcess on an acceptance line', () => {
  it('runs the e2e fallback itself, installing once after its checkout, and starts no agent', async () => {
    const one = job(acceptanceLine({ prd: 2898, pr: 2927, sha: SHA }));
    expect(await runJobProcess({ cwd: one.root, files: one.files, out: { write: () => true }, env: one.env })).toBe(0);
    expect(one.calls().filter((call) => call.startsWith('claude'))).toEqual([]);
    expect(one.calls().filter((call) => call === 'pnpm install --frozen-lockfile')).toHaveLength(1);
    expect(one.calls()[0]).toBe(`git fetch origin ${SHA}`);
    expect(acceptanceOfLog(readFileSync(one.files.log, 'utf8'))).toMatchObject({ ok: true, report: { commit: SHA, results: [] } });
    expect(readFileSync(one.files.exit, 'utf8')).toBe('0\n');
  });

  it('writes the exit 1 of a fallback that failed', async () => {
    const one = job(acceptanceLine({ prd: 2898, pr: 2927, sha: SHA }));
    writeFileSync(join(one.root, '.bin', 'git'), '#!/bin/sh\nexit 1\n');
    expect(await runJobProcess({ cwd: one.root, files: one.files, out: { write: () => true }, env: one.env })).toBe(1);
    expect(readFileSync(one.files.exit, 'utf8')).toBe('1\n');
    expect(acceptanceOfLog(readFileSync(one.files.log, 'utf8'))).toEqual({ ok: false, why: 'git fetch exited 1' });
  });
});
