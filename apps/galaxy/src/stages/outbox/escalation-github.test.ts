import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { renderRecord } from 'vertuo-omni-plan/kit/lib/escalation/comments.ts';
import { parsePr } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { settled } from '../settled';
import { escalationReader } from './escalation-github';

vi.mock('server-only', () => ({}));

// PRD 1794, s5: the escalation record's read, against a stubbed `fetch`: never GitHub itself.

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CREDS = { appId: '123456', privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() };
const NOW = Date.parse('2026-10-15T12:00:00Z');
const RECORD = renderRecord([{ thing: 'N-PRODUCT-4', kind: 'law', firstHeld: '2026-10-09T15:00:00Z', step: 1, asked: ['jdoe'], nextDue: '2026-10-15T15:00:00Z' }]);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function fakeGithub({ installed = true, comments = [] as unknown[], status = 200 } = {}) {
  const calls: string[] = [];
  const fetchImpl = vi.fn((href: string, init: RequestInit) => settled(() => {
    const url = new URL(href);
    calls.push(`${init.method ?? 'GET'} ${url.pathname}${url.search}`);
    if (url.pathname === '/repos/acme/widgets/installation') return installed ? json({ id: 11, account: { login: 'acme', type: 'Organization' } }) : json({}, 404);
    if (url.pathname === '/app/installations/11/access_tokens') return json({ token: 'ghs_1', expires_at: new Date(NOW + 3_600_000).toISOString() }, 201);
    if (url.pathname === '/repos/acme/widgets/issues/9/comments') {
      expect(new Headers(init.headers).get('authorization')).toBe('Bearer ghs_1');
      return status === 200 ? json(comments) : json({ message: 'boom' }, status);
    }
    throw new Error(`unexpected GitHub call ${href}`);
  }));
  return { fetchImpl, calls };
}

const read = (gh: ReturnType<typeof fakeGithub>) => escalationReader(CREDS, gh.fetchImpl, () => NOW);
const PR = { repository: 'acme/widgets', pr: parsePr(9) };

describe('the escalation record\'s read', () => {
  it('reads the record among the feature PR\'s comments, finding the installation and its token once', async () => {
    const gh = fakeGithub({ comments: [{ body: 'the outbox comment' }, { body: null }, { body: RECORD }] });
    const reader = read(gh);
    expect(await reader(PR)).toEqual([{ thing: 'N-PRODUCT-4', kind: 'law', firstHeld: '2026-10-09T15:00:00Z', step: 1, asked: ['jdoe'], nextDue: '2026-10-15T15:00:00Z' }]);
    await reader(PR);
    expect(gh.calls).toEqual([
      'GET /repos/acme/widgets/installation',
      'POST /app/installations/11/access_tokens',
      'GET /repos/acme/widgets/issues/9/comments?per_page=100',
      'GET /repos/acme/widgets/issues/9/comments?per_page=100',
    ]);
  });

  it('is null for a pull request with no record, one GitHub does not find, or a repository without the App', async () => {
    expect(await read(fakeGithub({ comments: [{ body: 'hello' }] }))(PR)).toBeNull();
    expect(await read(fakeGithub({ status: 404 }))(PR)).toBeNull();
    const absent = fakeGithub({ installed: false });
    expect(await read(absent)(PR)).toBeNull();
    expect(absent.calls).toEqual(['GET /repos/acme/widgets/installation']);
  });

  it('throws on any other answer, and on a name that is no repository', async () => {
    await expect(read(fakeGithub({ status: 502 }))(PR)).rejects.toThrow('GitHub answered 502');
    await expect(read(fakeGithub())({ repository: 'not a repo', pr: parsePr(9) })).rejects.toThrow('is not a repository name');
  });
});
