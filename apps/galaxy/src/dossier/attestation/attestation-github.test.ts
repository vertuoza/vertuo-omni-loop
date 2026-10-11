import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { attestationGithub, isTargetOf } from './attestation-github';

vi.mock('server-only', () => ({}));

// What the Attestation page reads of GitHub (PRD 1612 s4), against a stubbed GitHub: the pinned files at
// a head through its tree and blobs, `unread` for a head GitHub does not know, a truncated tree, the App
// not installed or an error; and the target PRs whose body starts `Part of <home>#<n>`.

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const PRD = parsePrd(918);
const HEAD = '7d3e9a1c2b4f5e6d7c8b9a0f1e2d3c4b5a697887';

type Route = (url: string, init: RequestInit) => Response | undefined;

/** A GitHub that installs the App on `installed`, mints a token, and answers `route` for the rest. */
function stubGithub(route: Route, installed: readonly string[] = ['vertuoza/mobile-plan', 'vertuoza/vertuo-api']) {
  const calls: string[] = [];
  const fetch = vi.fn((url: string, init: RequestInit) => {
    calls.push(url);
    const installation = /\/repos\/([^/]+\/[^/]+)\/installation$/.exec(url);
    if (installation) {
      return Promise.resolve(installed.includes(installation[1] ?? '')
        ? Response.json({ id: 7, account: { login: 'vertuoza', type: 'Organization' } })
        : new Response('{}', { status: 404 }));
    }
    if (url.endsWith('/app/installations/7/access_tokens')) return Promise.resolve(Response.json({ token: 'ghs_t', expires_at: '2099-01-01T00:00:00Z' }));
    return Promise.resolve(route(url, init) ?? new Response('{}', { status: 404 }));
  });
  return { calls, github: attestationGithub({ creds: { appId: '1', privateKey }, fetch, store: null }) };
}

const tree = (entries: Array<{ path: string; sha: string }>, truncated = false) =>
  Response.json({ truncated, tree: entries.map((e) => ({ ...e, type: 'blob' })) });

describe('the pinned files at a head', () => {
  it('reads each path through the head\'s tree and its blob; a path the tree lacks is null', async () => {
    const { github, calls } = stubGithub((url) => {
      if (url.includes(`/git/trees/${HEAD}?recursive=1`)) return tree([{ path: 'spec.md', sha: 'b1' }]);
      if (url.endsWith('/git/blobs/b1')) return new Response('# Spec\n');
      return undefined;
    });
    const read = await github.headFiles('vertuoza/mobile-plan', HEAD, ['spec.md', 'plan.md']);
    expect(read).toEqual({ kind: 'read', files: new Map([['spec.md', '# Spec\n'], ['plan.md', null]]) });
    await github.headFiles('vertuoza/mobile-plan', HEAD, ['spec.md']);
    // The token is kept: one installation read for both.
    expect(calls.filter((u) => u.endsWith('/installation')).length).toBe(1);
  });

  it('is unread for a head GitHub does not know, a truncated tree, a failed blob or no App', async () => {
    const unknown = stubGithub(() => new Response('{}', { status: 422 }));
    expect(await unknown.github.headFiles('vertuoza/mobile-plan', HEAD, ['spec.md'])).toEqual({ kind: 'unread' });
    const truncated = stubGithub(() => tree([], true));
    expect(await truncated.github.headFiles('vertuoza/mobile-plan', HEAD, ['spec.md'])).toEqual({ kind: 'unread' });
    const blob = stubGithub((url) => (url.includes('/git/trees/') ? tree([{ path: 'spec.md', sha: 'b1' }]) : new Response('', { status: 500 })));
    expect(await blob.github.headFiles('vertuoza/mobile-plan', HEAD, ['spec.md'])).toEqual({ kind: 'unread' });
    const absent = stubGithub(() => undefined, []);
    expect(await absent.github.headFiles('vertuoza/mobile-plan', HEAD, ['spec.md'])).toEqual({ kind: 'unread' });
    const down = stubGithub(() => new Response('', { status: 502 }));
    expect(await down.github.headFiles('vertuoza/mobile-plan', HEAD, ['spec.md'])).toEqual({ kind: 'unread' });
  });
});

describe('the target PRs', () => {
  const pull = (number: number, body: string | null, over: Record<string, unknown> = {}) => ({
    number, html_url: `https://github.com/vertuoza/vertuo-api/pull/${number}`, state: 'open', draft: false, merged_at: null, body, ...over,
  });

  it('are the open or merged PRs whose body starts `Part of <home>#<n>`', async () => {
    const { github } = stubGithub((url) => (url.includes('/repos/vertuoza/vertuo-api/pulls?') ? Response.json([
      pull(446, 'Part of vertuoza/mobile-plan#918\n\nThe API side.'),
      pull(93, 'Part of vertuoza/mobile-plan#918', { state: 'closed', merged_at: '2026-10-09T00:00:00Z', draft: false }),
      pull(94, 'Part of vertuoza/mobile-plan#918', { state: 'closed' }),
      pull(95, 'Part of vertuoza/mobile-plan#9180'),
      pull(96, 'Closes #918'),
      pull(97, null),
    ]) : undefined));
    expect(await github.targets(['vertuoza/vertuo-api', 'vertuoza/elsewhere'], 'vertuoza/mobile-plan', PRD)).toEqual([
      { repo: 'vertuoza/vertuo-api', number: 446, url: 'https://github.com/vertuoza/vertuo-api/pull/446', state: 'open', draft: false },
      { repo: 'vertuoza/vertuo-api', number: 93, url: 'https://github.com/vertuoza/vertuo-api/pull/93', state: 'merged', draft: false },
    ]);
  });

  it('are unread when a repository\'s PRs cannot be read', async () => {
    const { github } = stubGithub(() => new Response('', { status: 500 }));
    expect(await github.targets(['vertuoza/vertuo-api'], 'vertuoza/mobile-plan', PRD)).toBeNull();
  });

  it('read a body case-insensitively, spaces before it allowed', () => {
    expect(isTargetOf('  part of Vertuoza/Mobile-Plan#918', 'vertuoza/mobile-plan', PRD)).toBe(true);
    expect(isTargetOf('See Part of vertuoza/mobile-plan#918', 'vertuoza/mobile-plan', PRD)).toBe(false);
  });
});
