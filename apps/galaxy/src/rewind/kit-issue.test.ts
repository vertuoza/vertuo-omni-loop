import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { kitIssueOpener } from './kit-issue';

vi.mock('server-only', () => ({}));

// The issue an approved Omni-setup finding opens (PRD 2410, s7), against a stubbed GitHub: one issue on the
// kit's repository, as the App's installation there, holding exactly the title and body it was given.

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CREDS = { appId: '42', privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() };
const NOW = Date.parse('2026-10-23T10:00:00Z');

type Call = { method: string; url: string; body: unknown; authorization: string | null };

function github({ installed = true, opened = 201 } = {}) {
  const calls: Call[] = [];
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const fetch = (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    calls.push({ method: init.method ?? 'GET', url, body: typeof init.body === 'string' ? JSON.parse(init.body) as unknown : null, authorization: headers.get('authorization') });
    if (url.endsWith('/installation')) return Promise.resolve(installed ? json(200, { id: 7, account: { login: 'vertuoza', type: 'Organization' } }) : json(404, {}));
    if (url.endsWith('/access_tokens')) return Promise.resolve(json(201, { token: 'inst-token', expires_at: '2026-10-23T11:00:00Z' }));
    if (url.endsWith('/issues')) return Promise.resolve(json(opened, opened === 201 ? { html_url: 'https://github.com/vertuoza/vertuo-omni-loop/issues/9' } : { message: 'nope' }));
    return Promise.resolve(json(500, {}));
  };
  return { calls, open: kitIssueOpener({ creds: CREDS, fetch, store: null, clock: () => NOW }) };
}

describe('the kit\'s issue', () => {
  it('opens one issue on the kit\'s repository with the card\'s words, as the App\'s installation there', async () => {
    const g = github();
    expect(await g.open('Rewind: the form never asked', 'CI · Started in: The Omni setup\n\nIt never asked.\n\nFix: Ask.\n')).toEqual({
      ok: true, link: 'https://github.com/vertuoza/vertuo-omni-loop/issues/9',
    });
    expect(g.calls.map((c) => [c.method, c.url])).toEqual([
      ['GET', 'https://api.github.com/repos/vertuoza/vertuo-omni-loop/installation'],
      ['POST', 'https://api.github.com/app/installations/7/access_tokens'],
      ['POST', 'https://api.github.com/repos/vertuoza/vertuo-omni-loop/issues'],
    ]);
    expect(g.calls.at(-1)).toMatchObject({
      body: { title: 'Rewind: the form never asked', body: 'CI · Started in: The Omni setup\n\nIt never asked.\n\nFix: Ask.\n' }, authorization: 'Bearer inst-token',
    });
  });

  it('opens nothing where the App is not installed on the kit\'s repository, and says so', async () => {
    const g = github({ installed: false });
    expect(await g.open('t', 'b')).toEqual({ ok: false, error: 'The Omni app is not installed on the kit\'s repository.' });
    expect(g.calls.map((c) => c.method)).toEqual(['GET']);
  });

  it('says what GitHub answered when it refuses the issue', async () => {
    expect(await github({ opened: 410 }).open('t', 'b')).toEqual({ ok: false, error: 'GitHub answered 410.' });
  });
});
