import { describe, expect, it, vi } from 'vitest';
import { joinLogins, readGithubAccount, workspacesToJoin } from './github-orgs';

const ws = (slug: string, github_org: string | null, github_installation_id: number | null) => ({ id: `id-${slug}`, slug, github_org, github_installation_id });
const VERTUOZA = ws('vertuoza', 'vertuoza', 91001);
const ACME = ws('acme', 'Acme', 91002);
const WAITING = ws('waiting', 'waiting-org', null);
const BARE = ws('bare', null, null);
const SOLO = ws('ada-gh', 'ada-gh', 91003);
const ALL = [VERTUOZA, ACME, WAITING, BARE, SOLO];

describe('the logins a person joins by', () => {
  it('are their own login and their orgs\', each once whatever its case', () => {
    expect(joinLogins({ login: 'Ada-GH', orgs: ['vertuoza', 'ACME', 'acme', 'Vertuoza'] })).toEqual(['Ada-GH', 'vertuoza', 'ACME']);
  });

  it('are their own login alone when they belong to no org', () => {
    expect(joinLogins({ login: 'ada-gh', orgs: [] })).toEqual(['ada-gh']);
  });
});

describe('the workspaces those logins join', () => {
  it('are the ones whose GitHub org is among them and that have an installation', () => {
    expect(workspacesToJoin(['ada-gh', 'vertuoza', 'waiting-org'], ALL)).toEqual([VERTUOZA, SOLO]);
  });

  it('match a login whatever its case', () => {
    expect(workspacesToJoin(['ACME', 'VerTuoza'], ALL)).toEqual([VERTUOZA, ACME]);
  });

  it('never include a workspace without an installation, even when its org matches', () => {
    expect(workspacesToJoin(['waiting-org'], ALL)).toEqual([]);
  });

  it('are none for a person in no org whose own login has no workspace', () => {
    expect(workspacesToJoin(['eve-gh'], ALL)).toEqual([]);
    expect(workspacesToJoin([], ALL)).toEqual([]);
  });
});

describe('reading the GitHub account with the provider token', () => {
  const hrefOf = (url: string | URL | Request) => (url instanceof Request ? url.url : url.toString());
  const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('asks GitHub for the login and the orgs, with the token, and nothing else', async () => {
    const fetch = vi.fn((url: string | URL | Request) => Promise.resolve(hrefOf(url).endsWith('/user')
      ? answer(200, { login: 'ada-gh', id: 11 })
      : answer(200, [{ login: 'vertuoza', id: 1 }, { login: 'acme', id: 2 }])));
    expect(await readGithubAccount('gho_token', fetch)).toEqual({ login: 'ada-gh', orgs: ['vertuoza', 'acme'] });
    expect(fetch.mock.calls.map(([url]) => hrefOf(url))).toEqual(['https://api.github.com/user', 'https://api.github.com/user/orgs?per_page=100']);
    for (const [, init] of fetch.mock.calls as unknown as [string, RequestInit][]) {
      expect(new Headers(init.headers).get('authorization')).toBe('Bearer gho_token');
    }
  });

  it('throws, naming GitHub\'s status, when GitHub refuses', async () => {
    const fetch = vi.fn(() => Promise.resolve(answer(401, { message: 'Bad credentials' })));
    await expect(readGithubAccount('expired', fetch)).rejects.toThrow(/GitHub.*401/);
  });

  it('throws on an answer that is not the shape GitHub documents', async () => {
    const fetch = vi.fn((url: string | URL | Request) => Promise.resolve(hrefOf(url).endsWith('/user') ? answer(200, { login: 'ada-gh' }) : answer(200, { orgs: [] })));
    await expect(readGithubAccount('gho_token', fetch)).rejects.toThrow(/GitHub/);
  });
});
