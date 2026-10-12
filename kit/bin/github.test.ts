import { describe, expect, it } from 'vitest';
import { ghClient, githubClientFor } from './github.ts';
import type { ExecFileSyncOptions } from 'node:child_process';
import { parseCommentId, parsePr } from '../lib/ids.ts';

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
