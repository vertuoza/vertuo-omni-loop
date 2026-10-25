import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { settingsPullRequests } from './omni-settings.pull-request';
import type { PlaybookChange } from './omni-settings.service';

vi.mock('server-only', () => ({}));

// The settings repository's pull-request writer (PRD 2417, s7) against a fake GitHub, never GitHub
// itself: a branch cut from the default branch's head, the page's file changed (or added) on it, then a
// pull request into the default branch; no branch when the page already reads so; null-like answers
// for a repository the App cannot reach; a throw on any other failure.

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CREDS = { appId: '123456', privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() };
const NOW = Date.parse('2026-10-23T12:00:00Z');
const HEAD = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
const FILE_SHA = 'aa11bb22cc33dd44ee55ff6677889900aabbccdd';
const PATH = '.omni-loop/settings/playbook/review.md';
const CHANGE: PlaybookChange = {
  path: PATH,
  text: '---\nform: review\n---\n\n# Review\n\n## Fix\nNew words.\n',
  branch: 'omni-settings/review-20261023-120000',
  message: 'docs(settings): the review page, proposed on the Omni page by @ada',
  title: 'Playbook: a new review page',
  body: '@ada proposed it.',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

type Call = { method: string; path: string; body: unknown };

function github(answers: Record<string, () => Response>) {
  const calls: Call[] = [];
  const fetch = (raw: string, init: RequestInit) => {
    const url = new URL(raw);
    const method = init.method ?? 'GET';
    if (url.pathname === '/app/installations/11/access_tokens' && method === 'POST') {
      return Promise.resolve(json({ token: 'ghs_1', expires_at: new Date(NOW + 3_600_000).toISOString() }, 201));
    }
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer ghs_1');
    const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ method, path: `${url.pathname}${url.search}`, body });
    const answer = answers[`${method} ${url.pathname}`];
    return Promise.resolve(answer ? answer() : json({ message: 'Not Found' }, 404));
  };
  return { writer: settingsPullRequests(CREDS, fetch, () => NOW), calls };
}

const REPOSITORY = { 'GET /repos/acme/plan': () => json({ default_branch: 'main' }) };
const BRANCH_HEAD = { 'GET /repos/acme/plan/git/ref/heads/main': () => json({ object: { sha: HEAD } }) };
const OPENS = {
  'POST /repos/acme/plan/git/refs': () => json({ ref: `refs/heads/${CHANGE.branch}` }, 201),
  'PUT /repos/acme/plan/contents/.omni-loop/settings/playbook/review.md': () => json({ content: { sha: 'new' } }, 200),
  'POST /repos/acme/plan/pulls': () => json({ number: 42, html_url: 'https://github.com/acme/plan/pull/42' }, 201),
};

describe('settingsPullRequests', () => {
  it('cuts a branch from the default branch, changes the page on it and opens a pull request into it', async () => {
    const { writer, calls } = github({
      ...REPOSITORY, ...BRANCH_HEAD, ...OPENS,
      [`GET /repos/acme/plan/contents/${PATH}`]: () => json({ sha: FILE_SHA, encoding: 'base64', content: b64('# Old review\n') }),
    });
    expect(await writer.propose(11, 'acme/plan', CHANGE)).toEqual({ kind: 'opened', pullRequest: { number: 42, url: 'https://github.com/acme/plan/pull/42' } });
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'GET /repos/acme/plan',
      'GET /repos/acme/plan/git/ref/heads/main',
      `GET /repos/acme/plan/contents/${PATH}?ref=${HEAD}`,
      'POST /repos/acme/plan/git/refs',
      `PUT /repos/acme/plan/contents/${PATH}`,
      'POST /repos/acme/plan/pulls',
    ]);
    expect(calls[3]?.body).toEqual({ ref: `refs/heads/${CHANGE.branch}`, sha: HEAD });
    expect(calls[4]?.body).toEqual({ message: CHANGE.message, content: b64(CHANGE.text), branch: CHANGE.branch, sha: FILE_SHA });
    expect(calls[5]?.body).toEqual({ title: CHANGE.title, head: CHANGE.branch, base: 'main', body: CHANGE.body });
  });

  it('adds the file when the settings repository does not hold the page yet', async () => {
    const { writer, calls } = github({ ...REPOSITORY, ...BRANCH_HEAD, ...OPENS });
    expect((await writer.propose(11, 'acme/plan', CHANGE)).kind).toBe('opened');
    const put = calls.find((call) => call.method === 'PUT');
    expect(put?.body).toEqual({ message: CHANGE.message, content: b64(CHANGE.text), branch: CHANGE.branch });
  });

  it('opens nothing, not even a branch, when the page already reads so', async () => {
    const { writer, calls } = github({
      ...REPOSITORY, ...BRANCH_HEAD, ...OPENS,
      [`GET /repos/acme/plan/contents/${PATH}`]: () => json({ sha: FILE_SHA, encoding: 'base64', content: b64(CHANGE.text).replace(/(.{20})/g, '$1\n') }),
    });
    expect(await writer.propose(11, 'acme/plan', CHANGE)).toEqual({ kind: 'unchanged' });
    expect(calls.filter((call) => call.method !== 'GET')).toEqual([]);
  });

  it('answers unreachable for a repository the App cannot see, or one with no commit', async () => {
    expect(await github({}).writer.propose(11, 'acme/plan', CHANGE)).toEqual({ kind: 'unreachable' });
    const empty = github({ ...REPOSITORY, 'GET /repos/acme/plan/git/ref/heads/main': () => json({ message: 'Git Repository is empty.' }, 409) });
    expect(await empty.writer.propose(11, 'acme/plan', CHANGE)).toEqual({ kind: 'unreachable' });
    expect(empty.calls.filter((call) => call.method !== 'GET')).toEqual([]);
  });

  it('throws when GitHub refuses a write, naming the step, and on a name that is not a repository', async () => {
    const refused = github({ ...REPOSITORY, ...BRANCH_HEAD, ...OPENS, 'POST /repos/acme/plan/pulls': () => json({ message: 'Validation Failed' }, 422) });
    await expect(refused.writer.propose(11, 'acme/plan', CHANGE)).rejects.toThrow('GitHub answered 422 to opening the pull request on acme/plan');
    const noBranch = github({ ...REPOSITORY, ...BRANCH_HEAD, 'POST /repos/acme/plan/git/refs': () => json({ message: 'Reference already exists' }, 422) });
    await expect(noBranch.writer.propose(11, 'acme/plan', CHANGE)).rejects.toThrow('GitHub answered 422 to cutting the branch on acme/plan');
    await expect(github({}).writer.propose(11, '../etc', CHANGE)).rejects.toThrow('is not a repository name');
  });
});
