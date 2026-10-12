import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TokenStore } from '../ask/client.ts';
import { parseIssue, parsePr } from '../ids.ts';
import { omniLoopReads } from './omni.ts';
import { LoopReadError } from './port.ts';

// The Omni page's `LoopReads` (PRD 1665, s3): each read is one GET under `<ask.url>/api/loop/`, signed
// in, and every refusal is the spec's one line. The answers are the page's own examples.

const EXAMPLES = JSON.parse(readFileSync(new URL('../../../apps/galaxy/src/loop/fixtures/contract.json', import.meta.url), 'utf8')) as Record<string, unknown>;

const PAGE = 'https://omni.example.test';

/** A store signed in to the page's host. */
const signedIn = (): TokenStore => ({ read: () => ({ access_token: 'at-1', refresh_token: 'rt-1', expires_at: null }), write: () => undefined });

type Call = { url: string; init: RequestInit };

/** A `fetch` answering every call with `status` and `body` (text as it is, anything else as JSON). */
function answering(status: number, body: unknown) {
  const calls: Call[] = [];
  const fetch = (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
  };
  return { fetch, calls };
}

const readsOf = (fetch: (url: string, init: RequestInit) => Promise<Response>, more: { askUrl?: string | null; tokens?: TokenStore } = {}) =>
  omniLoopReads({ askUrl: PAGE, tokens: signedIn(), fetch, ...more });

/** The line a read stops on, and what it holds. */
async function refusal(read: Promise<unknown>): Promise<{ line: string; scope: string }> {
  const error = await read.then(() => null, (thrown: unknown) => thrown);
  if (!(error instanceof LoopReadError)) throw new Error(`expected a LoopReadError, got ${String(error)}`);
  return { line: error.line, scope: error.scope };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the Omni page\'s loop reads', () => {
  it('lists changes with only the filters given, signed in, and reads the page\'s example', async () => {
    const { fetch, calls } = answering(200, EXAMPLES.changes);
    const changes = await readsOf(fetch).changes({ repo: 'acme/widgets', base: 'feat/widgets', state: 'all' });

    expect(changes).toEqual((EXAMPLES.changes as { changes: unknown }).changes);
    expect(calls.map((call) => call.url)).toEqual([`${PAGE}/api/loop/changes?repo=acme%2Fwidgets&base=feat%2Fwidgets&state=all`]);
    expect(calls[0]?.init.method).toBe('GET');
    expect(calls[0]?.init.headers).toMatchObject({ authorization: 'Bearer at-1' });
  });

  it('reads one change, a conversation, issues and one issue at their own paths', async () => {
    const answers: Record<string, unknown> = {
      'changes/9': EXAMPLES.change,
      comments: EXAMPLES.comments,
      issues: EXAMPLES.issues,
      'issues/21': EXAMPLES.issue,
    };
    const urls: string[] = [];
    const fetch = (url: string) => {
      urls.push(url);
      const path = new URL(url).pathname.replace('/api/loop/', '');
      return Promise.resolve(new Response(JSON.stringify(answers[path]), { status: 200 }));
    };
    const reads = readsOf(fetch);

    expect((await reads.change('acme/widgets', parsePr(9))).lastCommitAt).toBe('2026-10-11T09:30:00Z');
    expect((await reads.comments('acme/widgets', parsePr(9))).map((comment) => comment.id)).toEqual([501, 502]);
    expect((await reads.issues({ repo: 'acme/widgets', label: 'omni:bug' })).map((issue) => issue.number)).toEqual([21, 7]);
    expect((await reads.issue('acme/widgets', parseIssue(21))).closedBy).toEqual([31]);
    expect(urls).toEqual([
      `${PAGE}/api/loop/changes/9?repo=acme%2Fwidgets`,
      `${PAGE}/api/loop/comments?repo=acme%2Fwidgets&on=9`,
      `${PAGE}/api/loop/issues?repo=acme%2Fwidgets&label=omni%3Abug`,
      `${PAGE}/api/loop/issues/21?repo=acme%2Fwidgets`,
    ]);
  });

  it('gives each read 15 seconds', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    await readsOf(answering(200, { changes: [] }).fetch).changes({ repo: 'acme/widgets' });
    expect(timeout).toHaveBeenCalledWith(15_000);
  });

  it('keeps a field the contract does not name out of what it hands on', async () => {
    const [first] = (EXAMPLES.changes as { changes: Record<string, unknown>[] }).changes;
    const { fetch } = answering(200, { changes: [{ ...first, reviewers: ['grace'] }] });
    const [change] = await readsOf(fetch).changes({ repo: 'acme/widgets' });
    expect(change).not.toHaveProperty('reviewers');
  });
});

describe('a loop read that cannot be made', () => {
  const read = (fetch: (url: string, init: RequestInit) => Promise<Response>, more: { askUrl?: string | null; tokens?: TokenStore } = {}) =>
    refusal(readsOf(fetch, more).changes({ repo: 'acme/widgets' }));

  it('says no sign-in, calling nothing, when the terminal has none', async () => {
    const { fetch, calls } = answering(200, { changes: [] });
    expect(await read(fetch, { tokens: { read: () => null, write: () => undefined } })).toEqual({ line: 'no sign-in (omni signin)', scope: 'everything' });
    expect(calls).toEqual([]);
  });

  it('says no sign-in when the page refuses it and it cannot be renewed', async () => {
    expect(await read(answering(401, { error: 'expired' }).fetch)).toEqual({ line: 'no sign-in (omni signin)', scope: 'everything' });
  });

  it('says no Omni page is set when ask.url is empty', async () => {
    const { fetch, calls } = answering(200, { changes: [] });
    expect(await read(fetch, { askUrl: null })).toEqual({ line: 'no Omni page is set here (ask.url)', scope: 'everything' });
    expect(calls).toEqual([]);
  });

  it.each([
    ['a timeout', Object.assign(new Error('timed out'), { name: 'TimeoutError' })],
    ['no network', new TypeError('fetch failed')],
  ])('says unreachable on %s', async (_, thrown) => {
    expect(await read(() => Promise.reject(thrown))).toEqual({ line: 'unreachable', scope: 'everything' });
  });

  it.each([
    [403, 'acme/widgets is not in your workspace: No workspace you belong to lists it.', 'refused (403): acme/widgets is not in your workspace: No workspace you belong to lists it'],
    [424, 'The Omni app cannot read acme/widgets: https://example.test/install', 'refused (424): The Omni app cannot read acme/widgets: https://example.test/install'],
    [429, "GitHub's budget for acme/widgets is spent until 2026-10-12T10:00:00.000Z.", "refused (429): GitHub's budget for acme/widgets is spent until 2026-10-12T10:00:00.000Z"],
    [404, 'No change 9 in acme/widgets.', 'refused (404): No change 9 in acme/widgets'],
  ])('holds the repository alone on a %i, in the page\'s words', async (status, error, line) => {
    expect(await read(answering(status, { error }).fetch)).toEqual({ line, scope: 'repository' });
  });

  it.each([
    [403, 'refused (403): acme/widgets is not in your workspace'],
    [424, 'refused (424): the Omni app cannot read acme/widgets'],
    [429, "refused (429): the code host's budget for acme/widgets is spent"],
  ])('says the spec\'s words when a %i carries none', async (status, line) => {
    expect(await read(answering(status, '').fetch)).toEqual({ line, scope: 'repository' });
  });

  it('tells a page without the loop\'s routes by its bare 404', async () => {
    expect(await read(answering(404, '<!doctype html><title>404</title>').fetch)).toEqual({
      line: 'refused (404): this Omni page cannot read the loop yet',
      scope: 'everything',
    });
  });

  it('holds everything on any other refusal, in the page\'s words or its status', async () => {
    expect(await read(answering(500, { error: 'The host failed.' }).fetch)).toEqual({ line: 'refused (500): The host failed', scope: 'everything' });
    expect(await read(answering(503, '').fetch)).toEqual({ line: 'refused (503): the Omni page answered 503', scope: 'everything' });
  });

  it('refuses an answer outside the contract', async () => {
    expect(await read(answering(200, { changes: [{ number: 'one' }] }).fetch)).toEqual({
      line: "the Omni page answered outside the loop's contract (changes)",
      scope: 'everything',
    });
  });
});
