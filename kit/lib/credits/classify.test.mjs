// PRD #99, slice s3: the credits classifier — whose pull request it is, its kind, its state and its
// signature — a pure unit over fixture pull requests and commits (AC 7, AC 9 first half).
import { describe, expect, it } from 'vitest';
import { ConfigSchema } from '../config.mjs';
import { creditPullRequests, mergedPullRequest, summarize } from './classify.mjs';

const { labels, signature } = ConfigSchema.parse({ kit: 1 });
const TRAILER = 'Co-authored-by: OmniMan <333776611+omni-loop-invader[bot]@users.noreply.github.com>';
const SIGNED_BODY = 'Part of #7\n\n🦸 Delivered by OmniMan, with Omni Loop <!-- omni-loop:signed -->';

/** One pull request as the reader hands it over; unlabelled, unsigned and merged unless told otherwise. */
function pr(number, overrides = {}) {
  return {
    repo: 'acme/widgets',
    number,
    title: `PR ${number}`,
    state: 'merged',
    createdAt: '2026-08-10T09:00:00Z',
    labels: [],
    body: 'A plain body.',
    author: 'someone',
    ...overrides,
  };
}

/** One default-branch commit, carrying OmniMan's trailer unless another message is given. */
function commit(subject, { repo = 'acme/widgets', trailer = TRAILER } = {}) {
  return { repo, sha: `sha-${subject}`, message: `${subject}\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n${trailer}\n`, date: '2026-08-11T09:00:00Z' };
}

const credit = (prs, { commits = [], since = null, sig = signature } = {}) =>
  creditPullRequests({ prs, commits, labels, signature: sig, since });
const numbers = (items) => items.map((item) => item.number);

describe('mergedPullRequest', () => {
  it('reads the (#<n>) at the end of the subject, and nothing else', () => {
    expect(mergedPullRequest('feat(kit): omni sign (#106)')).toBe(106);
    expect(mergedPullRequest('feat(kit): omni sign (#106)  \n\nbody (#7)')).toBe(106);
    expect(mergedPullRequest('fix: see (#12) for why')).toBeNull();
    expect(mergedPullRequest('chore: tidy\n\nfollows (#12)')).toBeNull();
    expect(mergedPullRequest('Merge pull request #12 from acme/topic')).toBeNull();
    expect(mergedPullRequest(undefined)).toBeNull();
  });
});

describe('whose pull request it is (AC 7)', () => {
  it('a loop label alone, the marker alone, or a co-authored merge commit alone is enough', () => {
    const items = credit(
      [
        pr(1, { labels: ['omni:sub'] }),
        pr(2, { body: SIGNED_BODY }),
        pr(3),
        pr(4, { labels: ['bug'] }),
      ],
      { commits: [commit('feat: three (#3)')] },
    );
    expect(items.map(({ number, reasons }) => ({ number, reasons }))).toEqual([
      { number: 1, reasons: ['label'] },
      { number: 2, reasons: ['marker'] },
      { number: 3, reasons: ['commit'] },
    ]);
  });

  it('names every reason that holds', () => {
    const [item] = credit([pr(5, { labels: ['omni:feature'], body: SIGNED_BODY })], { commits: [commit('feat: five (#5)')] });
    expect(item.reasons).toEqual(['label', 'marker', 'commit']);
  });

  it('a commit whose trailer names another name or another address, or merged another repository\'s number, is not his', () => {
    const commits = [
      commit('feat: one (#1)', { trailer: 'Co-authored-by: Someone <333776611+omni-loop-invader[bot]@users.noreply.github.com>' }),
      commit('feat: two (#2)', { trailer: 'Co-authored-by: OmniMan <omniman@example.com>' }),
      commit('feat: three (#3)', { repo: 'acme/other' }),
    ];
    expect(credit([pr(1), pr(2), pr(3)], { commits })).toEqual([]);
  });

  it('counts a pull request read twice only once', () => {
    expect(numbers(credit([pr(1, { labels: ['omni:sub'] }), pr(1, { labels: ['omni:sub'] })]))).toEqual([1]);
  });

  it('counts the same number in two repositories as two pull requests', () => {
    const items = credit([pr(1, { labels: ['omni:sub'] }), pr(1, { repo: 'acme/other', labels: ['omni:sub'] })]);
    expect(items.map((item) => item.repo)).toEqual(['acme/other', 'acme/widgets']);
  });
});

describe('state and kind (AC 7)', () => {
  it('counts merged and open pull requests, and ignores one closed without merging', () => {
    const items = credit([
      pr(1, { labels: ['omni:sub'], state: 'merged' }),
      pr(2, { labels: ['omni:sub'], state: 'open' }),
      pr(3, { labels: ['omni:sub'], state: 'closed' }),
    ]);
    expect(items.map(({ number, state }) => ({ number, state }))).toEqual([
      { number: 1, state: 'merged' },
      { number: 2, state: 'open' },
    ]);
  });

  it('sorts each as phase-0, feature, slice or other, from the configured labels', () => {
    const items = credit([
      pr(1, { labels: ['omni:phase-0'] }),
      pr(2, { labels: ['omni:feature', 'omni:in-progress'] }),
      pr(3, { labels: ['omni:sub'] }),
      pr(4, { body: SIGNED_BODY }),
    ]);
    expect(items.map((item) => item.kind)).toEqual(['phase-0', 'feature', 'slice', 'other']);

    const renamed = { ...labels, sub: 'loop:slice' };
    const [item] = creditPullRequests({ prs: [pr(1, { labels: ['loop:slice'] })], commits: [], labels: renamed, signature, since: null });
    expect(item).toMatchObject({ kind: 'slice', reasons: ['label'] });
  });
});

describe('signed, before signing, missed (AC 7)', () => {
  it('splits the unsigned around each repository\'s first signed item, one repository at a time', () => {
    const items = credit(
      [
        pr(1, { labels: ['omni:sub'], createdAt: '2026-07-01T09:00:00Z' }),
        pr(2, { labels: ['omni:sub'], createdAt: '2026-08-01T09:00:00Z', body: SIGNED_BODY }),
        pr(3, { labels: ['omni:sub'], createdAt: '2026-08-02T09:00:00Z' }),
        pr(4, { labels: ['omni:sub'], createdAt: '2026-08-03T09:00:00Z' }),
        pr(5, { labels: ['omni:feature'], createdAt: '2026-06-01T09:00:00Z' }),
        pr(9, { repo: 'acme/other', labels: ['omni:sub'], createdAt: '2026-09-01T09:00:00Z' }),
      ],
      { commits: [commit('feat: four (#4)')] },
    );
    expect(items.map(({ repo, number, signature: s }) => `${repo}#${number} ${s}`)).toEqual([
      'acme/widgets#5 before signing',
      'acme/widgets#1 before signing',
      'acme/widgets#2 signed',
      'acme/widgets#3 missed',
      'acme/widgets#4 signed',
      'acme/other#9 before signing',
    ]);
  });

  it('lists the items oldest first', () => {
    const items = credit([
      pr(2, { labels: ['omni:sub'], createdAt: '2026-08-02T09:00:00Z' }),
      pr(1, { labels: ['omni:sub'], createdAt: '2026-08-01T09:00:00Z' }),
    ]);
    expect(numbers(items)).toEqual([1, 2]);
  });
});

describe('--since (AC 9)', () => {
  it('keeps only what was created from that month on', () => {
    const items = credit(
      [
        pr(1, { labels: ['omni:sub'], createdAt: '2026-06-30T23:59:59Z' }),
        pr(2, { labels: ['omni:sub'], createdAt: '2026-07-01T00:00:00Z' }),
        pr(3, { createdAt: '2026-05-01T09:00:00Z' }),
      ],
      { since: '2026-07', commits: [commit('feat: three (#3)')] },
    );
    expect(numbers(items)).toEqual([2]);
  });
});

describe('signature: null', () => {
  it('still counts what a label says is his; the marker and the commit say nothing; no signature', () => {
    const items = credit(
      [pr(1, { labels: ['omni:sub'], body: SIGNED_BODY }), pr(2, { body: SIGNED_BODY }), pr(3)],
      { sig: null, commits: [commit('feat: three (#3)')] },
    );
    expect(items.map(({ number, reasons, signature: s }) => ({ number, reasons, signature: s }))).toEqual([
      { number: 1, reasons: ['label'], signature: null },
    ]);
  });
});

describe('summarize', () => {
  it('totals the pull requests by state, kind, signature, repository and month', () => {
    const items = credit(
      [
        pr(1, { labels: ['omni:phase-0'], createdAt: '2026-07-03T09:00:00Z' }),
        pr(2, { labels: ['omni:feature'], createdAt: '2026-08-03T09:00:00Z', state: 'open', body: SIGNED_BODY }),
        pr(3, { labels: ['omni:sub'], createdAt: '2026-08-04T09:00:00Z' }),
        pr(4, { repo: 'acme/other', labels: ['omni:sub'], createdAt: '2026-09-04T09:00:00Z' }),
        pr(5, { repo: 'acme/other', body: SIGNED_BODY, createdAt: '2026-09-05T09:00:00Z' }),
        pr(6, { repo: 'acme/zeta', labels: ['omni:sub'], createdAt: '2026-09-06T09:00:00Z' }),
      ],
    );
    expect(summarize(items)).toEqual({
      total: 6,
      states: { merged: 5, open: 1 },
      kinds: { 'phase-0': 1, feature: 1, slice: 3, other: 1 },
      signatures: { signed: 2, 'before signing': 3, missed: 1 },
      byRepo: [
        { repo: 'acme/widgets', count: 3 },
        { repo: 'acme/other', count: 2 },
        { repo: 'acme/zeta', count: 1 },
      ],
      byMonth: [
        { month: '2026-07', count: 1 },
        { month: '2026-08', count: 2 },
        { month: '2026-09', count: 3 },
      ],
    });
  });

  it('is all zeros on nothing', () => {
    expect(summarize([])).toEqual({
      total: 0,
      states: { merged: 0, open: 0 },
      kinds: { 'phase-0': 0, feature: 0, slice: 0, other: 0 },
      signatures: { signed: 0, 'before signing': 0, missed: 0 },
      byRepo: [],
      byMonth: [],
    });
  });
});
