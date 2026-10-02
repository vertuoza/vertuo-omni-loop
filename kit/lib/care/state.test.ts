// PRD 790, slice s1: a feature PR's GraphQL read, parsed into its care state.
import { describe, expect, it } from 'vitest';
import { careState } from './state.ts';
import type { CareResponse } from './state.ts';
import { assertDefined } from '../../test/assert.ts';

const STATUS = '<!-- omni-outbox-status -->';
const OPTIONS = { statusMarker: STATUS, needsFixLabel: 'omni:needs-fix', gateContexts: ['outbox', 'inbox'] };

const comment = (login: string, body: string, at: string, extra: Record<string, unknown> = {}) => ({
  author: { login, avatarUrl: `https://avatars.example/${login}` },
  body,
  createdAt: at,
  url: `https://github.com/acme/widgets/pull/9#discussion_r${at.replace(/\D/g, '')}`,
  ...extra,
});

const thread = (id: string, comments: object[], { isResolved = false } = {}) => ({
  id,
  isResolved,
  path: 'src/a.mjs',
  line: 3,
  comments: { nodes: comments },
});

/** A recorded-shape GraphQL response for one pull request, with `over` merged into it. */
function response(over: Record<string, unknown> = {}): CareResponse {
  return {
    data: {
      repository: {
        pullRequest: {
          number: 9,
          url: 'https://github.com/acme/widgets/pull/9',
          state: 'OPEN',
          isDraft: false,
          baseRefName: 'main',
          headRefName: 'feat/widgets',
          mergeable: 'MERGEABLE',
          labels: { nodes: [] },
          commits: { nodes: [{ commit: { statusCheckRollup: { state: 'SUCCESS', contexts: { nodes: [] } } } }] },
          reviewThreads: { nodes: [] },
          comments: { nodes: [] },
          ...over,
        },
      },
    },
  };
}

const rollup = (state: string, contexts: object[]) => ({ nodes: [{ commit: { statusCheckRollup: { state, contexts: { nodes: contexts } } } }] });

describe('careState — checks', () => {
  it('reads a green rollup', () => {
    expect(careState(response(), OPTIONS).checks).toEqual({ state: 'green', failed: [], stuck: false, fixable: false });
  });

  it('reads a red rollup with the failed run and its link', () => {
    const commits = rollup('FAILURE', [
      { __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'FAILURE', detailsUrl: 'https://ci/run/1' },
      { __typename: 'CheckRun', name: 'lint', status: 'COMPLETED', conclusion: 'SUCCESS', detailsUrl: 'https://ci/run/2' },
      { __typename: 'StatusContext', context: 'vercel', state: 'ERROR', targetUrl: 'https://vercel/x' },
    ]);
    expect(careState(response({ commits }), OPTIONS).checks).toEqual({
      state: 'red',
      failed: [
        { name: 'test', url: 'https://ci/run/1' },
        { name: 'vercel', url: 'https://vercel/x' },
      ],
      stuck: false,
      fixable: true,
    });
  });

  it('reads a running rollup, and none when there is no rollup', () => {
    expect(careState(response({ commits: rollup('PENDING', []) }), OPTIONS).checks.state).toBe('running');
    expect(careState(response({ commits: rollup('EXPECTED', []) }), OPTIONS).checks.state).toBe('running');
    expect(careState(response({ commits: { nodes: [{ commit: { statusCheckRollup: null } }] } }), OPTIONS).checks.state).toBe('none');
  });

  it('does not call red fixable when only the outbox or inbox gate is red', () => {
    const commits = rollup('FAILURE', [{ __typename: 'StatusContext', context: 'outbox', state: 'FAILURE', targetUrl: null }]);
    expect(careState(response({ commits }), OPTIONS).checks).toMatchObject({ state: 'red', fixable: false });
  });

  it('reads the needs-fix label as stuck', () => {
    const commits = rollup('FAILURE', [{ __typename: 'CheckRun', name: 'test', conclusion: 'FAILURE', detailsUrl: 'u' }]);
    const labels = { nodes: [{ name: 'omni:needs-fix' }] };
    expect(careState(response({ commits, labels }), OPTIONS).checks).toMatchObject({ state: 'red', stuck: true });
  });
});

describe('careState — the pull request', () => {
  it('reads its number, state, branches and mergeable state', () => {
    const state = careState(response({ mergeable: 'CONFLICTING' }), OPTIONS);
    expect(state.pr).toEqual({
      number: 9,
      url: 'https://github.com/acme/widgets/pull/9',
      state: 'OPEN',
      isDraft: false,
      base: 'main',
      head: 'feat/widgets',
      labels: [],
    });
    expect(state.mergeable).toBe('CONFLICTING');
  });

  it('throws when the response holds no pull request', () => {
    expect(() => careState({ data: { repository: { pullRequest: null } } }, OPTIONS)).toThrow(/no pull request/);
  });
});

describe('careState — review threads', () => {
  const ask = comment('rev', 'Please remove the duplicated block.', '2026-09-30T10:00:00Z');

  it('lists an unresolved thread with no care reply as unhandled, to judge', () => {
    const [t] = careState(response({ reviewThreads: { nodes: [thread('T1', [ask])] } }), OPTIONS).threads;
    expect(t).toMatchObject({ id: 'T1', resolved: false, verdict: null, reason: null, needs: 'judge', path: 'src/a.mjs', line: 3 });
    assertDefined(t, 't');
    expect(t.url).toBe(ask.url);
    assertDefined(t, 't');
    expect(t.comments).toEqual([
      { author: 'rev', avatarUrl: 'https://avatars.example/rev', body: ask.body, createdAt: ask.createdAt, url: ask.url, verdict: null },
    ]);
  });

  it('leaves out a thread a person resolved without care', () => {
    const threads = careState(response({ reviewThreads: { nodes: [thread('T1', [ask], { isResolved: true })] } }), OPTIONS).threads;
    expect(threads).toEqual([]);
  });

  it.each(['fixed', 'pushed-back'])('reads a resolved thread with a %s reply as handled, with its reason', (verdict) => {
    const reply = comment('bot', `Because.\n\n<!-- omni-care: ${verdict} -->`, '2026-09-30T10:05:00Z');
    const [t] = careState(response({ reviewThreads: { nodes: [thread('T1', [ask, reply], { isResolved: true })] } }), OPTIONS).threads;
    expect(t).toMatchObject({ resolved: true, verdict, reason: 'Because.', needs: null });
  });

  it('reads an asked thread as asked and handled, even when more is said after', () => {
    const reply = comment('bot', 'The PM will decide.\n\n<!-- omni-care: asked -->', '2026-09-30T10:05:00Z');
    const more = comment('rev', 'ok', '2026-09-30T10:07:00Z');
    const [t] = careState(response({ reviewThreads: { nodes: [thread('T1', [ask, reply, more])] } }), OPTIONS).threads;
    expect(t).toMatchObject({ verdict: 'asked', needs: null, reason: 'The PM will decide.' });
  });

  it('makes a thread asked when a person writes after a care reply: the reviewer keeps the last word', () => {
    const reply = comment('bot', 'Low value.\n\n<!-- omni-care: pushed-back -->', '2026-09-30T10:05:00Z');
    const again = comment('rev', 'I still want it.', '2026-09-30T10:07:00Z');
    const [t] = careState(response({ reviewThreads: { nodes: [thread('T1', [ask, reply, again], { isResolved: true })] } }), OPTIONS).threads;
    expect(t).toMatchObject({ verdict: 'asked', needs: 'mark-asked' });
  });

  it('makes a thread asked when a person reopens a thread care resolved', () => {
    const reply = comment('bot', 'Fixed in abc123: dedupe.\n\n<!-- omni-care: fixed -->', '2026-09-30T10:05:00Z');
    const [t] = careState(response({ reviewThreads: { nodes: [thread('T1', [ask, reply], { isResolved: false })] } }), OPTIONS).threads;
    expect(t).toMatchObject({ verdict: 'asked', needs: 'mark-asked' });
  });
});

describe('careState — the status comment', () => {
  it('reads the care line of the status comment', () => {
    const comments = {
      nodes: [
        { databaseId: 1, body: 'hello' },
        {
          databaseId: 42,
          body: `${STATUS}\n**Agent status** · updated x\n\n- PR care: watching since 2026-09-30 10:00 UTC · last round 2026-09-30 10:25 UTC\n`,
        },
      ],
    };
    expect(careState(response({ comments }), OPTIONS).status).toEqual({
      commentId: 42,
      watchingSince: '2026-09-30 10:00 UTC',
      lastRound: '2026-09-30 10:25 UTC',
    });
  });

  it('reads a status comment with no care line, and none at all', () => {
    const comments = { nodes: [{ databaseId: 7, body: `${STATUS}\n- state: done` }] };
    expect(careState(response({ comments }), OPTIONS).status).toEqual({ commentId: 7, watchingSince: null, lastRound: null });
    expect(careState(response(), OPTIONS).status).toBeNull();
  });
});
