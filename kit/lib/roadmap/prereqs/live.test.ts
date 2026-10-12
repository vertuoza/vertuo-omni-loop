// PRD 1218, slice s2: the real command runner and files a run uses outside tests. The commands here
// are this test's own Node process, never Docker, an install or gh.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { liveEnv, liveFiles, liveShell, machineName } from './live.ts';

const node = process.execPath;

describe('liveShell', () => {
  it('runs a command in the folder given, with what it printed and its exit code', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'omni-prereqs-shell-'));
    const result = await liveShell(node, ['-e', 'console.log(process.cwd()); console.error("warn"); process.exit(3)'], { cwd: dir, timeoutMs: 20_000 });
    expect(result.code).toBe(3);
    expect(result.stdout.trim()).toMatch(/omni-prereqs-shell-/);
    expect(result.stderr.trim()).toBe('warn');
  });

  it('answers code 0 on success', async () => {
    expect(await liveShell(node, ['-e', ''], { cwd: tmpdir(), timeoutMs: 20_000 })).toEqual({ code: 0, stdout: '', stderr: '' });
  });

  it('stops a command that runs past its limit, with no code', async () => {
    const result = await liveShell(node, ['-e', 'setTimeout(() => {}, 60000)'], { cwd: tmpdir(), timeoutMs: 200 });
    expect(result.code).toBeNull();
  });

  it('rejects a command that cannot start', async () => {
    await expect(liveShell('omni-no-such-command-anywhere', [], { cwd: tmpdir(), timeoutMs: 20_000 })).rejects.toThrow(/ENOENT/);
  });
});

describe('liveFiles', () => {
  it('reads, checks and copies files relative to the root, never over one that exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-prereqs-files-'));
    mkdirSync(join(root, 'apps/web'), { recursive: true });
    writeFileSync(join(root, 'apps/web/.env.example'), 'A=\n');
    writeFileSync(join(root, '.env'), 'B=secret\n');
    writeFileSync(join(root, '.env.example'), 'B=\n');
    const files = liveFiles(root);
    expect(files.exists('apps/web/.env.example')).toBe(true);
    expect(files.read('apps/web/.env.example')).toBe('A=\n');
    expect(files.read('missing')).toBeNull();
    expect(files.copyNew('apps/web/.env.example', 'apps/web/.env')).toBe(true);
    expect(readFileSync(join(root, 'apps/web/.env'), 'utf8')).toBe('A=\n');
    expect(files.copyNew('.env.example', '.env')).toBe(false);
    expect(readFileSync(join(root, '.env'), 'utf8')).toBe('B=secret\n');
    expect(files.copyNew('nothing', 'other')).toBe(false);
    expect(existsSync(join(root, 'other'))).toBe(false);
  });
});

describe('liveEnv and machineName', () => {
  it('puts the real shell and files on the root, with the labels and the sign-in given', () => {
    const env = liveEnv({ root: '/repo', labels: { autoCreate: false }, signedIn: () => true });
    expect(env.root).toBe('/repo');
    expect(env.shell).toBe(liveShell);
    expect(env.labels).toEqual({ autoCreate: false });
    expect(env.signedIn()).toBe(true);
  });

  it('names this machine by its host name', () => {
    expect(machineName()).toMatch(/\S/);
  });
});
