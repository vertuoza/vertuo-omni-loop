import { describe, expect, it } from 'vitest';
import { careVerdictOf, isWatching, openThreads, parseCare, type CareState } from './care';

// The feature PR's care state (PRD 790, s2), parsed from recorded GraphQL answers: never GitHub itself.

const STATUS = '<!-- omni-outbox-status -->';
const at = (n: number) => `https://github.com/acme/widgets/pull/433#discussion_r${n}`;
const comment = (n: number, login: string, body: string) => ({ body, url: at(n), author: { login, avatarUrl: `https://avatars.githubusercontent.com/${login}` } });
const care = (n: number, verdict: string, words: string) => comment(n, 'pm', `${words}\n\n<!-- omni-care: ${verdict} -->`);
const thread = (isResolved: boolean, ...comments: ReturnType<typeof comment>[]) => ({ isResolved, comments: { nodes: comments } });

/** A GraphQL answer to CARE_QUERY, as GitHub gives it. */
function answer(more: {
  mergeable?: string; rollup?: unknown; threads?: ReturnType<typeof thread>[]; comments?: string[];
} = {}) {
  return {
    repository: {
      pullRequest: {
        mergeable: more.mergeable ?? 'MERGEABLE',
        baseRefName: 'main',
        commits: { nodes: [{ commit: { statusCheckRollup: more.rollup === undefined ? { state: 'SUCCESS', contexts: { nodes: [] } } : more.rollup } }] },
        reviewThreads: { nodes: more.threads ?? [] },
        comments: { nodes: (more.comments ?? []).map((body) => ({ body })) },
      },
    },
  };
}
const parse = (more: Parameters<typeof answer>[0] = {}) => parseCare(answer(more), STATUS) as CareState;

describe('the care state of a feature PR', () => {
  it('reads a green, conflict-free PR with no thread', () => {
    expect(parse()).toEqual({ ci: 'green', failedUrl: null, conflict: false, base: 'main', threads: [], watchingSince: null, lastRound: null });
  });

  it('reads a red CI with the failed run\'s link, a running one, and a PR with no checks', () => {
    const red = parse({ rollup: { state: 'FAILURE', contexts: { nodes: [
      { __typename: 'CheckRun', conclusion: 'SUCCESS', detailsUrl: 'https://github.com/acme/widgets/actions/runs/1' },
      { __typename: 'CheckRun', conclusion: 'FAILURE', detailsUrl: 'https://github.com/acme/widgets/actions/runs/2' },
    ] } } });
    expect(red).toMatchObject({ ci: 'red', failedUrl: 'https://github.com/acme/widgets/actions/runs/2' });
    const status = parse({ rollup: { state: 'ERROR', contexts: { nodes: [{ __typename: 'StatusContext', state: 'ERROR', targetUrl: 'https://ci.example/9' }] } } });
    expect(status).toMatchObject({ ci: 'red', failedUrl: 'https://ci.example/9' });
    expect(parse({ rollup: { state: 'PENDING' } })).toMatchObject({ ci: 'running', failedUrl: null });
    expect(parse({ rollup: null })).toMatchObject({ ci: 'none' });
  });

  it('reads a conflict, and an unknown mergeable state as not known yet', () => {
    expect(parse({ mergeable: 'CONFLICTING' }).conflict).toBe(true);
    expect(parse({ mergeable: 'UNKNOWN' }).conflict).toBeNull();
  });

  it('reads each thread\'s verdict from the care reply\'s marker, asked threads first', () => {
    const state = parse({ threads: [
      thread(false, comment(1, 'rev', 'Please rename x\nit reads badly')),
      thread(true, comment(2, 'rev', 'Duplicated code here'), care(3, 'fixed', 'Fixed in abc123: shared helper.')),
      thread(true, comment(4, 'rev', 'Use a class'), care(5, 'pushed-back', 'Low value for this PR: preferred pattern, no defect named.')),
      thread(false, comment(6, 'rev', 'Should guests see this?'), care(7, 'asked', 'The PM will decide.')),
      thread(true, comment(8, 'rev', 'nit'), comment(9, 'dev', 'done')),
    ] });
    expect(state.threads.map((t) => [t.url, t.verdict, t.reason])).toEqual([
      [at(6), 'asked', 'The PM will decide.'],
      [at(1), 'open', null],
      [at(2), 'fixed', 'Fixed in abc123: shared helper.'],
      [at(4), 'pushed-back', 'Low value for this PR: preferred pattern, no defect named.'],
    ]);
    expect(state.threads[1]).toEqual({
      url: at(1), login: 'rev', avatar: 'https://avatars.githubusercontent.com/rev', firstLine: 'Please rename x', verdict: 'open', reason: null, resolved: false,
    });
    expect(openThreads(state)).toBe(2);
  });

  it('makes a thread asked when the reviewer writes after a care reply, or reopens it', () => {
    const state = parse({ threads: [
      thread(true, comment(1, 'rev', 'Rename it'), care(2, 'pushed-back', 'Naming taste.'), comment(3, 'rev', 'No, it is misleading')),
      thread(false, comment(4, 'rev', 'Dup'), care(5, 'fixed', 'Fixed in abc.')),
    ] });
    expect(state.threads.map((t) => t.verdict)).toEqual(['asked', 'asked']);
  });

  it('reads the watch from a fresh and a stale status comment, and none without its care line', () => {
    const now = Date.parse('2026-09-30T10:00:00Z');
    const line = (round: string) => `${STATUS}\n**Status:** green\nPR care: watching since 2026-09-30T08:00:00Z · last round ${round}`;
    const fresh = parse({ comments: ['unrelated', line('2026-09-30T09:57:00Z')] });
    expect(fresh).toMatchObject({ watchingSince: '2026-09-30T08:00:00.000Z', lastRound: '2026-09-30T09:57:00.000Z' });
    expect(isWatching(fresh, now)).toBe(true);
    const stale = parse({ comments: [line('2026-09-30T09:45:00Z')] });
    expect(isWatching(stale, now)).toBe(false);
    expect(parse({ comments: [`${STATUS}\n**Status:** green`] })).toMatchObject({ watchingSince: null, lastRound: null });
    expect(isWatching(parse(), now)).toBe(false);
  });

  it('is null when the pull request is not there, and throws on an answer of another shape', () => {
    expect(parseCare({ repository: { pullRequest: null } }, STATUS)).toBeNull();
    expect(() => parseCare({ nope: true }, STATUS)).toThrow();
  });
});

describe('the care marker', () => {
  it('reads the three verdicts, and anything else as a person\'s comment', () => {
    for (const v of ['fixed', 'pushed-back', 'asked']) expect(careVerdictOf(`x\n<!-- omni-care: ${v} -->`)).toBe(v);
    expect(careVerdictOf('plain words')).toBeNull();
    expect(careVerdictOf('<!-- omni-care: maybe -->')).toBeNull();
    expect(careVerdictOf(null)).toBeNull();
  });
});
