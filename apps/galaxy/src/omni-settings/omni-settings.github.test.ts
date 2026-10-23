import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { settingsGithub } from './omni-settings.github';

vi.mock('server-only', () => ({}));

// The settings repository's GitHub reader against a stubbed fetch, never GitHub itself: the commit
// the default branch is at, a file at that commit, and null for what is not there.

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CREDS = { appId: '123456', privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() };
const NOW = Date.parse('2026-10-23T12:00:00Z');
const SHA = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
const PATH = '.omni-loop/settings/playbook/review.md';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function github(answers: Record<string, () => Response>) {
  const asked: string[] = [];
  const fetch = (raw: string, init: RequestInit) => {
    const url = new URL(raw);
    if (url.pathname === '/app/installations/11/access_tokens' && init.method === 'POST') {
      return Promise.resolve(json({ token: 'ghs_1', expires_at: new Date(NOW + 3_600_000).toISOString() }, 201));
    }
    asked.push(`${url.pathname}${url.search}`);
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer ghs_1');
    const answer = answers[url.pathname];
    return Promise.resolve(answer ? answer() : json({ message: 'Not Found' }, 404));
  };
  return { reader: settingsGithub(CREDS, fetch, () => NOW), asked };
}

describe('settingsGithub', () => {
  it('reads the commit the default branch is at, or null when the repository is not there', async () => {
    const { reader } = github({ '/repos/acme/plan/commits/HEAD': () => json({ sha: SHA }) });
    expect(await reader.head(11, 'acme/plan')).toBe(SHA);
    expect(await reader.head(11, 'acme/none')).toBeNull();
  });

  it('reads a file at that commit, or null when it is not there or the repository is empty', async () => {
    const { reader, asked } = github({
      [`/repos/acme/plan/contents/${PATH}`]: () => new Response('# Review\n'),
      '/repos/acme/empty/commits/HEAD': () => json({ message: 'Git Repository is empty.' }, 409),
    });
    expect(await reader.file(11, 'acme/plan', SHA, PATH)).toBe('# Review\n');
    expect(asked).toContain(`/repos/acme/plan/contents/${PATH}?ref=${SHA}`);
    expect(await reader.file(11, 'acme/plan', SHA, '.omni-loop/settings/playbook/none.md')).toBeNull();
    expect(await reader.head(11, 'acme/empty')).toBeNull();
  });

  it('throws on any other failure, and on a name that is not a repository', async () => {
    const { reader } = github({ '/repos/acme/plan/commits/HEAD': () => json({ message: 'boom' }, 500) });
    await expect(reader.head(11, 'acme/plan')).rejects.toThrow();
    await expect(reader.head(11, '../etc')).rejects.toThrow('is not a repository name');
  });
});
