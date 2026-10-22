// The token of a job that runs as a GitHub App (PRD 2433, s2), on a temporary home: where the runner keeps it,
// what `omni runner github-token` prints of it and to whom, and how every line the runner sends hides it.
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { forgetGithubToken, githubTokenFile, jobGithubToken, maskJobTokens, maskTokens, readGithubToken, saveGithubToken } from './github-token.ts';

const home = (): string => mkdtempSync(join(tmpdir(), 'omni-github-token-'));
const T1 = ['ghs', 'firstInstallationToken0123456789ABCDEF'].join('_');
const T2 = ['ghs', 'secondInstallationToken9876543210ZYXWVU'].join('_');

describe("a job's token file", () => {
  it('lives beside the job’s log, as job-<id>.github, and only for an id the runner could have named a file after', () => {
    expect(githubTokenFile('/h', '7')).toBe(join('/h', 'logs', 'job-7.github'));
    expect(githubTokenFile('/h', 'a1_B-2')).toBe(join('/h', 'logs', 'job-a1_B-2.github'));
    for (const id of ['', '../x', 'a/b', 'a b', 'a.b', '..']) expect(githubTokenFile('/h', id), id).toBeNull();
  });

  it('keeps the runner, the token and when it expires, readable by its owner alone', () => {
    const file = githubTokenFile(home(), '7');
    expect(file).not.toBeNull();
    if (file === null) return;
    expect(readGithubToken(file)).toBeNull();
    saveGithubToken(file, 'box-1', { token: T1, expiresAt: '2026-10-22T17:33:17Z' });
    expect(readGithubToken(file)).toEqual({ runner: 'box-1', tokens: [{ token: T1, expiresAt: '2026-10-22T17:33:17Z' }] });
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it('keeps every token the job had, the newest last, so a past one is still known', () => {
    const file = githubTokenFile(home(), '7');
    if (file === null) throw new Error('no file');
    saveGithubToken(file, 'box-1', { token: T1, expiresAt: '2026-10-22T17:33:17Z' });
    saveGithubToken(file, 'box-1', { token: T2, expiresAt: '2026-10-22T18:33:17Z' });
    expect(readGithubToken(file)?.tokens.map((entry) => entry.token)).toEqual([T1, T2]);
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it('starts again when the runner named is another: a job’s file holds one runner’s tokens', () => {
    const file = githubTokenFile(home(), '7');
    if (file === null) throw new Error('no file');
    saveGithubToken(file, 'box-1', { token: T1, expiresAt: '2026-10-22T17:33:17Z' });
    saveGithubToken(file, 'box-2', { token: T2, expiresAt: '2026-10-22T18:33:17Z' });
    expect(readGithubToken(file)).toEqual({ runner: 'box-2', tokens: [{ token: T2, expiresAt: '2026-10-22T18:33:17Z' }] });
  });

  it('reads a file that is not a token file as none, and forgets one it holds', () => {
    const dir = home();
    mkdirSync(join(dir, 'logs'));
    const file = join(dir, 'logs', 'job-7.github');
    for (const text of ['', 'not json', '{}', '{"runner":"box-1","tokens":[]}', '{"runner":"box-1","tokens":[{"token":"","expiresAt":"x"}]}']) {
      writeFileSync(file, text);
      expect(readGithubToken(file), text).toBeNull();
    }
    saveGithubToken(file, 'box-1', { token: T1, expiresAt: '2026-10-22T17:33:17Z' });
    forgetGithubToken(file);
    expect(readGithubToken(file)).toBeNull();
    expect(() => { forgetGithubToken(file); }).not.toThrow();
  });

  it('forgets nothing it cannot reach without throwing: a job’s end goes on', () => {
    const dir = home();
    mkdirSync(join(dir, 'logs'));
    const regular = join(dir, 'logs', 'job-7.log');
    writeFileSync(regular, 'a log');
    expect(() => { forgetGithubToken(join(regular, 'job-7.github')); }).not.toThrow();
    expect(readFileSync(regular, 'utf8')).toBe('a log');
  });
});

describe('jobGithubToken: the token omni runner github-token prints', () => {
  function saved(runner = 'box-1') {
    const dir = home();
    const file = githubTokenFile(dir, '7');
    if (file === null) throw new Error('no file');
    saveGithubToken(file, runner, { token: T1, expiresAt: '2026-10-22T17:33:17Z' });
    return { dir, file };
  }

  it('answers the current token of the job the session runs, and the newest once it was renewed', () => {
    const { dir, file } = saved();
    expect(jobGithubToken({ job: '7', runner: 'box-1' }, dir)).toEqual({ token: T1, expiresAt: '2026-10-22T17:33:17Z' });
    saveGithubToken(file, 'box-1', { token: T2, expiresAt: '2026-10-22T18:33:17Z' });
    expect(jobGithubToken({ job: '7', runner: 'box-1' }, dir)).toEqual({ token: T2, expiresAt: '2026-10-22T18:33:17Z' });
  });

  it('answers no token outside a runner job, one with no runner, or one that does not run as an app', () => {
    const { dir } = saved();
    expect(jobGithubToken(null, dir)).toEqual({ refusal: 'this session is not a runner job.' });
    expect(jobGithubToken({ job: '7', runner: null }, dir)).toEqual({ refusal: 'this runner job names no runner.' });
    expect(jobGithubToken({ job: '8', runner: 'box-1' }, dir)).toEqual({ refusal: 'job 8 does not run as a GitHub App.' });
  });

  it("never answers another runner's token, nor one for an id that names no file of the runner", () => {
    const { dir } = saved('box-2');
    expect(jobGithubToken({ job: '7', runner: 'box-1' }, dir)).toEqual({ refusal: "the token of job 7 is another runner's." });
    expect(jobGithubToken({ job: '../logs/job-7', runner: 'box-2' }, dir)).toEqual({ refusal: 'job ../logs/job-7 does not run as a GitHub App.' });
  });

  it('never carries the token in a refusal', () => {
    const { dir } = saved('box-2');
    const refusal = jobGithubToken({ job: '7', runner: 'box-1' }, dir);
    expect(JSON.stringify(refusal)).not.toContain(T1);
    expect(readFileSync(join(dir, 'logs', 'job-7.github'), 'utf8')).toContain(T1);
  });
});

describe('maskTokens', () => {
  it('replaces every occurrence of every token with ***, the past ones too', () => {
    expect(maskTokens(`push ${T1} then ${T2}, again ${T1}`, [T1, T2])).toBe('push *** then ***, again ***');
    expect(maskTokens(`https://x-access-token:${T1}@github.com/acme/widgets.git`, [T1])).toBe('https://x-access-token:***@github.com/acme/widgets.git');
  });

  it('keeps a text that holds no token as it is, and a list with no token changes nothing', () => {
    expect(maskTokens('claude read: /omni:bug-fix 9\nPR: https://github.com/acme/widgets/pull/42', [T1])).toBe('claude read: /omni:bug-fix 9\nPR: https://github.com/acme/widgets/pull/42');
    expect(maskTokens(`a ${T1}`, [])).toBe(`a ${T1}`);
    expect(maskTokens(`a ${T1}`, [''])).toBe(`a ${T1}`);
  });

  it('masks the longer token first when one holds another', () => {
    expect(maskTokens('x ghs_abcdefgh12 y', [['ghs', 'abcdefgh'].join('_'), ['ghs', 'abcdefgh12'].join('_')])).toBe('x *** y');
  });

  it('masks the start of a token a log ends on, still being written, from six characters on', () => {
    expect(maskTokens(`token: ${T1.slice(0, 20)}`, [T1])).toBe('token: ***');
    expect(maskTokens(`token: ${T1.slice(0, 6)}`, [T1])).toBe('token: ***');
    // A few characters are no token: `ghs_` is the start of every one, and a line may end on it.
    expect(maskTokens('token: ghs_', [T1])).toBe('token: ghs_');
    expect(maskTokens('the git', [T1])).toBe('the git');
  });

  it('does not change the number of lines: a token never holds a newline', () => {
    const log = `a\n${T1}\nb\n${T2.slice(0, 12)}`;
    expect(maskTokens(log, [T1, T2]).split('\n')).toHaveLength(4);
  });
});

describe('maskJobTokens', () => {
  it('masks every token the job had, the past ones too, and leaves the text of a job with none', () => {
    const dir = home();
    const file = githubTokenFile(dir, '7');
    if (file === null) throw new Error('no file');
    saveGithubToken(file, 'box-1', { token: T1, expiresAt: '2026-10-22T17:33:17Z' });
    saveGithubToken(file, 'box-1', { token: T2, expiresAt: '2026-10-22T18:33:17Z' });
    expect(maskJobTokens(dir, '7', `push ${T1}, then ${T2}`)).toBe('push ***, then ***');
    expect(maskJobTokens(dir, '8', `push ${T1}`)).toBe(`push ${T1}`);
    expect(maskJobTokens(dir, '../7', `push ${T1}`)).toBe(`push ${T1}`);
  });
});
