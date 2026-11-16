// The job's own `gh` sign-in (bug 2914), on a temporary home: `~/logs/job-<id>.gh/`, the `GH_CONFIG_DIR` of a job
// that runs as a GitHub App. It holds the job's current token, follows every fresh one (the runner's or the
// session's refresh), goes with the token file, and the sweep takes one a crash left. No test holds a real token.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sizeOf } from './checkpoint.ts';
import { keepGithubToken } from './github-refresh.ts';
import { forgetGithubToken, githubCliDir, githubTokenFile, saveGithubToken } from './github-token.ts';
import { sweep } from './sweep.ts';

const FIRST = ['ghs', 'firstTokenOfTheJobsSignIn0123456789AB'].join('_');
const NEXT = ['ghs', 'nextTokenOfTheJobsSignIn9876543210ZYX'].join('_');
const NOW = Date.parse('2026-11-15T12:00:00.000Z');
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

/** A runner's home whose job 7 holds `token`, expiring `left` from now: its token file and its sign-in folder. */
function jobOf(token = FIRST, left = 60 * MIN): { home: string; file: string; dir: string } {
  const home = mkdtempSync(join(tmpdir(), 'omni-github-cli-'));
  const file = githubTokenFile(home, '7');
  if (file === null) throw new Error('job 7 names no file');
  saveGithubToken(file, 'box-1', { token, expiresAt: new Date(NOW + left).toISOString() });
  return { home, file, dir: githubCliDir(file) };
}

const hostsOf = (dir: string): string => readFileSync(join(dir, 'hosts.yml'), 'utf8');

describe('the job’s own gh sign-in', () => {
  it('lives beside the token file, as job-<id>.gh', () => {
    expect(githubCliDir(join('/h', 'logs', 'job-7.github'))).toBe(join('/h', 'logs', 'job-7.gh'));
    expect(githubCliDir(join('/h', 'logs', 'job-a1_B-2.github'))).toBe(join('/h', 'logs', 'job-a1_B-2.gh'));
  });

  it('signs gh in to github.com with the current token, over HTTPS, readable by its owner alone', () => {
    const { dir } = jobOf();
    expect(hostsOf(dir)).toBe(`github.com:\n    oauth_token: "${FIRST}"\n    git_protocol: https\n`);
    expect(statSync(join(dir, 'hosts.yml')).mode & 0o777).toBe(0o600);
    expect(statSync(dir).mode & 0o777).toBe(0o700);
  });

  it('is already in the shape gh writes, so gh never migrates it nor moves the token to a keychain', () => {
    const { dir } = jobOf();
    expect(readFileSync(join(dir, 'config.yml'), 'utf8')).toBe('version: "1"\ngit_protocol: https\n');
    expect(statSync(join(dir, 'config.yml')).mode & 0o777).toBe(0o600);
  });

  it('follows every token the file gets: gh signs in with the newest, never a past one', () => {
    const { file, dir } = jobOf();
    saveGithubToken(file, 'box-1', { token: NEXT, expiresAt: new Date(NOW + 120 * MIN).toISOString() });
    expect(hostsOf(dir)).toContain(NEXT);
    expect(hostsOf(dir)).not.toContain(FIRST);
  });

  it('follows a refresh, whoever ran it: the session or the runner', async () => {
    const { file, dir } = jobOf(FIRST, MIN);
    const kept = await keepGithubToken({
      file,
      runner: 'box-1',
      job: '7',
      fetchToken: () => Promise.resolve({ token: NEXT, expiresAt: new Date(NOW + 61 * MIN).toISOString() }),
      now: () => NOW,
      sleep: () => Promise.resolve(),
    });
    expect(kept.token?.token).toBe(NEXT);
    expect(hostsOf(dir)).toContain(NEXT);
    expect(hostsOf(dir)).not.toContain(FIRST);
  });

  it('goes with the token file when the job is forgotten', () => {
    const { file, dir } = jobOf();
    forgetGithubToken(file);
    expect(existsSync(dir)).toBe(false);
    expect(existsSync(file)).toBe(false);
  });
});

describe('the sweep, on a sign-in a crash left', () => {
  /** `~/logs/<name>` as a folder `days` old, with a file in it when `withFile`. */
  const folder = (home: string, name: string, days: number, withFile = true): string => {
    const dir = join(home, 'logs', name);
    mkdirSync(dir, { recursive: true });
    if (withFile) writeFileSync(join(dir, 'hosts.yml'), 'x'.repeat(120));
    const at = (NOW - days * DAY) / 1000;
    utimesSync(dir, at, at);
    return dir;
  };
  const sweepOf = (home: string, running: string[]) =>
    sweep({ home, checkouts: new Map(), exec: () => '', running: new Set(running), keepLogsDays: 14, now: NOW });

  it('removes an old job-<id>.gh of a job not running, with its files, and counts what it freed', () => {
    const home = mkdtempSync(join(tmpdir(), 'omni-github-cli-sweep-'));
    const old = folder(home, 'job-7.gh', 20);
    const young = folder(home, 'job-8.gh', 3);
    const running = folder(home, 'job-9.gh', 20);
    const bytes = sizeOf(old);
    expect(bytes).toBeGreaterThanOrEqual(120);
    expect(sweepOf(home, ['9'])).toEqual({ worktrees: 0, branches: 0, logs: 1, bytes });
    expect([existsSync(old), existsSync(young), existsSync(running)]).toEqual([false, true, true]);
  });

  it('never takes a folder of ~/logs that is no job’s sign-in, however old', () => {
    const home = mkdtempSync(join(tmpdir(), 'omni-github-cli-sweep-'));
    const others = ['job-5.log', 'job-5', 'scratch.gh', 'job-6.github'].map((name) => folder(home, name, 400, false));
    expect(sweepOf(home, [])).toEqual({ worktrees: 0, branches: 0, logs: 0, bytes: 0 });
    for (const dir of others) expect(existsSync(dir)).toBe(true);
  });
});
