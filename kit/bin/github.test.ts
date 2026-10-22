import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ghClient, githubClientFor, githubEnv } from './github.ts';
import type { ExecFileSyncOptions } from 'node:child_process';
import { parseCommentId, parsePr } from '../lib/ids.ts';
import { githubTokenFile, saveGithubToken } from '../lib/runner/github-token.ts';

// Upstream had no test for `ghClient` (it was exercised only through its callers' fake clients);
// these are new, against a fake `exec` that records every call.
function fakeExec(responses: Record<string, string> = {}) {
  const calls: { file: string; args: readonly string[]; options: ExecFileSyncOptions }[] = [];
  const exec = (file: string, args: readonly string[], options: ExecFileSyncOptions = {}) => {
    calls.push({ file, args, options });
    const key = args.join(' ');
    for (const [prefix, value] of Object.entries(responses)) {
      if (key.startsWith(prefix)) return value;
    }
    return '{}';
  };
  return { exec, calls };
}

describe('ghClient', () => {
  it('lists an issue’s comments through `gh api --paginate`', () => {
    const { exec, calls } = fakeExec({ 'api repos/acme/widgets/issues/7/comments': '[{"id":1}]' });
    const client = ghClient({ owner: 'acme', repo: 'widgets', issue: parsePr(7), exec });
    expect(client.listComments()).toEqual([{ id: 1 }]);
    expect(calls[0]?.file).toBe('gh');
    expect(calls[0]?.args).toEqual(['api', 'repos/acme/widgets/issues/7/comments', '--paginate']);
  });

  it('creates a comment with the body as JSON on stdin, never in argv', () => {
    const { exec, calls } = fakeExec({ 'api repos/acme/widgets/issues/7/comments --input': '{"id":2}' });
    const client = ghClient({ owner: 'acme', repo: 'widgets', issue: parsePr(7), exec });
    expect(client.createComment('hello\nworld')).toEqual({ id: 2 });
    expect(calls[0]?.args).toEqual(['api', 'repos/acme/widgets/issues/7/comments', '--input', '-']);
    expect(JSON.parse(calls[0]?.options.input as string)).toEqual({ body: 'hello\nworld' });
  });

  it('updates a comment by id with PATCH', () => {
    const { exec, calls } = fakeExec({ 'api -X PATCH': '{"id":3}' });
    const client = ghClient({ owner: 'acme', repo: 'widgets', issue: parsePr(7), exec });
    expect(client.updateComment(parseCommentId(3), 'b')).toEqual({ id: 3 });
    expect(calls[0]?.args).toEqual(['api', '-X', 'PATCH', 'repos/acme/widgets/issues/comments/3', '--input', '-']);
  });

  it('passes `env` to every call when given one', () => {
    const { exec, calls } = fakeExec({ 'api': '[]' });
    const env = { GH_TOKEN: 't' };
    ghClient({ owner: 'acme', repo: 'widgets', issue: parsePr(7), exec, env }).listComments();
    expect(calls[0]?.options.env).toBe(env);
  });
});

describe('githubClientFor', () => {
  const ctx = (user: string | null) => ({ config: { repo: { slug: 'acme/widgets' }, github: { user } } });

  it('uses the ambient gh login when no github.user is configured', () => {
    const { exec, calls } = fakeExec({ 'api': '[]' });
    githubClientFor(ctx(null), { issue: parsePr(9), exec }).listComments();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[1]).toBe('repos/acme/widgets/issues/9/comments');
    expect(calls[0]?.options.env).toBeUndefined();
  });

  it('fetches the configured user’s token once and passes it as GH_TOKEN in env', () => {
    const { exec, calls } = fakeExec({ 'auth token --user bot': 'sekret\n', 'api': '[]' });
    const client = githubClientFor(ctx('bot'), { issue: parsePr(9), exec, env: { PATH: '/bin' } });
    client.listComments();
    client.listComments();
    expect(calls.map((call) => call.args.slice(0, 2).join(' '))).toEqual(['auth token', 'api repos/acme/widgets/issues/9/comments', 'api repos/acme/widgets/issues/9/comments']);
    expect(calls[1]?.options.env).toEqual({ PATH: '/bin', GH_TOKEN: 'sekret' });
    expect(calls[1]?.args.join(' ')).not.toMatch(/sekret/);
  });

  it('takes the slug from --repo when given one', () => {
    const { exec, calls } = fakeExec({ 'api': '[]' });
    githubClientFor(ctx(null), { repo: 'other/thing', issue: parsePr(1), exec }).listComments();
    expect(calls[0]?.args[1]).toBe('repos/other/thing/issues/1/comments');
  });
});

// PRD 2433, s2: under `OMNI_GITHUB_APP` every `gh` call a kit command makes runs as the job's app, with the job's
// token, and `gh auth token` (the person's own login) is never asked.
describe('githubEnv under a GitHub App', () => {
  const ctx = (user: string | null) => ({ config: { repo: { slug: 'acme/widgets' }, github: { user } } });
  const TOKEN = 'ghs_fakeTokenOfTheJobRunningAsTheApp0123456789';
  const APP = { OMNI_GITHUB_APP: 'omni-acme[bot]', PATH: '/bin' };

  it('uses the job’s token as GH_TOKEN, and never runs gh auth token, whatever github.user says', () => {
    for (const user of [null, 'ada']) {
      const { exec, calls } = fakeExec();
      expect(githubEnv(ctx(user), { exec, env: APP, githubToken: () => TOKEN })).toEqual({ ...APP, GH_TOKEN: TOKEN });
      expect(calls).toEqual([]);
    }
  });

  it('reads the token the runner keeps for the job when none is handed in, inside a job of that runner', () => {
    const home = mkdtempSync(join(tmpdir(), 'omni-github-env-'));
    const file = githubTokenFile(home, '7');
    if (file === null) throw new Error('no file');
    saveGithubToken(file, 'box-1', { token: TOKEN, expiresAt: '2026-10-22T13:00:00Z' });
    const { exec, calls } = fakeExec();
    const env = { ...APP, OMNI_JOB: '7', OMNI_RUNNER: 'box-1' };
    expect(githubEnv(ctx('ada'), { exec, env, home })).toEqual({ ...env, GH_TOKEN: TOKEN });
    expect(calls).toEqual([]);
  });

  it('refuses, in words that hold no token, when the job’s token cannot be read: it never falls back to another login', () => {
    const home = mkdtempSync(join(tmpdir(), 'omni-github-env-'));
    const { exec, calls } = fakeExec({ 'auth token': 'the-persons-own-token\n' });
    const run = () => githubEnv(ctx('ada'), { exec, env: { ...APP, OMNI_JOB: '7', OMNI_RUNNER: 'box-1' }, home });
    expect(run).toThrow(/runs as the GitHub App omni-acme\[bot\].*job 7 does not run as a GitHub App/);
    expect(githubEnv.bind(null, ctx(null), { exec, env: APP, githubToken: () => null })).toThrow(/omni-acme\[bot\]/);
    expect(calls).toEqual([]);
  });

  it('is what it always was outside an app: the ambient login, or the configured user’s own token', () => {
    const { exec, calls } = fakeExec({ 'auth token --user ada': 'sekret\n' });
    expect(githubEnv(ctx(null), { exec, env: { PATH: '/bin' }, githubToken: () => TOKEN })).toBeUndefined();
    expect(githubEnv(ctx('ada'), { exec, env: { PATH: '/bin', OMNI_GITHUB_APP: '  ' }, githubToken: () => TOKEN })).toEqual({ PATH: '/bin', OMNI_GITHUB_APP: '  ', GH_TOKEN: 'sekret' });
    expect(calls).toHaveLength(1);
  });
});
