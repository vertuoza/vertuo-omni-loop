// The suite runs inside a runner job too, whose environment names the bot and carries its sign-in (#2618).
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import config from '../vitest.config.ts';

describe("a job's identity stays out of the tests", () => {
  it('is set up for every test file', () => {
    expect(config.test.setupFiles).toContain('./kit/test/job-env.setup.ts');
  });

  it('leaves a fixture repository its own author', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'job-identity-'));
    const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
    git('init', '-q');
    git('config', 'user.name', 'Fixture');
    git('config', 'user.email', 'fixture@example.com');
    git('commit', '-q', '--allow-empty', '-m', 'one');
    expect(git('log', '-1', '--format=%ae %ce')).toBe('fixture@example.com fixture@example.com');
  });

  it("carries none of the job's values, even after a test file unstubs its own", () => {
    vi.unstubAllEnvs();
    const child = execFileSync(process.execPath, ['-p', 'JSON.stringify([process.env.OMNI_TOKEN ?? null, process.env.OMNI_GITHUB_APP ?? null, process.env.GIT_AUTHOR_EMAIL ?? null])'], { encoding: 'utf8' }).trim();
    expect(child).toBe('[null,null,null]');
  });
});
