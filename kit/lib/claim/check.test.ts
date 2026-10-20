// PRD 2175, s3: `checkClaim` decides whether a takeover reuses a stale claim's branch or rebuilds the
// slice, on fixture git reads: each of the six lines `omni claim check` prints.
import { describe, expect, it } from 'vitest';
import { parseSliceId } from '../ids.ts';
import { checkClaim } from './check.ts';
import type { ClaimCommit, ClaimGit } from './check.ts';

const PLAN_PATH = '.omni-loop/delivery/inbox/0007-widgets/plan.md';
const FEATURE = 'origin/feat/widgets';
const CLAIM_SHA = 'c1a1m';

/** A plan whose slice table holds these rows, `[id, title, territory]`. */
function plan(rows: readonly (readonly [string, string, string])[]): string {
  return [
    '# A plan',
    '',
    '| id | slice | territory | blocked by | wave |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map(([id, title, territory]) => `| ${id} | ${title} | ${territory} | — | 1 |`),
    '',
  ].join('\n');
}

const TODAY = plan([
  ['s1', 'Alpha', '`a/` `docs/a.md`'],
  ['s2', 'Beta', '`b/`'],
]);

/** Git reads: the plan at the claim and on the feature branch, the slice branch's own commits and
 * the files it changed. */
function fakeGit({
  atClaim = TODAY,
  now = TODAY,
  commits = [
    { sha: 'w0rk', subject: 'feat(a): more' },
    { sha: CLAIM_SHA, subject: 'chore(s1): claim' },
  ],
  changed = ['a/one.ts', 'docs/a.md'],
}: { atClaim?: string | null; now?: string | null; commits?: readonly ClaimCommit[]; changed?: readonly string[] } = {}): ClaimGit {
  return {
    ownCommits: () => commits,
    fileAt: (ref, path) => {
      if (path !== PLAN_PATH) return null;
      if (ref === CLAIM_SHA) return atClaim;
      return ref === FEATURE ? now : null;
    },
    changedFiles: () => changed,
  };
}

const input = {
  slice: parseSliceId('s1'),
  planPath: PLAN_PATH,
  featureRef: FEATURE,
  outboxDir: '.omni-loop/delivery/outbox/0007-widgets',
  generated: [{ path: 'kit/dist/' }],
};

describe('checkClaim — reuse or rebuild a stale claim (PRD 2175)', () => {
  it('reuses a branch whose plan row is unchanged and whose changes stay in the territory', () => {
    expect(checkClaim(input, fakeGit())).toEqual({ reuse: true, line: 'reuse' });
  });

  it('reuses a branch with no change beyond its claim', () => {
    expect(checkClaim(input, fakeGit({ commits: [{ sha: CLAIM_SHA, subject: 'chore(s1): claim' }], changed: [] })).line).toBe('reuse');
  });

  it('never counts the outbox dir or a generated path as outside the territory', () => {
    const changed = ['a/one.ts', '.omni-loop/delivery/outbox/0007-widgets/s1-01-x.md', '.omni-loop/delivery/outbox/0007-widgets/accounts/s1.md', 'kit/dist/omni.mjs'];
    expect(checkClaim(input, fakeGit({ changed })).line).toBe('reuse');
  });

  it('reads the territory as a set: the same prefixes in another order are no change', () => {
    const now = plan([['s1', 'Alpha', '`docs/a.md` `a/`']]);
    expect(checkClaim(input, fakeGit({ now })).line).toBe('reuse');
  });

  it('rebuilds when the row has gone from the plan on the feature branch', () => {
    const now = plan([['s2', 'Beta', '`b/`']]);
    expect(checkClaim(input, fakeGit({ now }))).toEqual({ reuse: false, line: 'rebuild: slice not in the plan' });
  });

  it('reads a plan the feature branch does not hold, or cannot be parsed, as no row', () => {
    expect(checkClaim(input, fakeGit({ now: null })).line).toBe('rebuild: slice not in the plan');
    expect(checkClaim(input, fakeGit({ now: '# no table here\n' })).line).toBe('rebuild: slice not in the plan');
  });

  it('rebuilds when the branch has no claim commit of this slice', () => {
    const commits = [
      { sha: 'w0rk', subject: 'feat(a): more' },
      { sha: 'other', subject: 'chore(s2): claim' },
      { sha: 'near', subject: 'chore(s1): claimed by hand' },
    ];
    expect(checkClaim(input, fakeGit({ commits })).line).toBe('rebuild: no claim commit');
    expect(checkClaim(input, fakeGit({ commits: [] })).line).toBe('rebuild: no claim commit');
  });

  it('reads the plan at the newest claim commit of the slice', () => {
    const commits = [
      { sha: CLAIM_SHA, subject: 'chore(s1): claim' },
      { sha: 'older', subject: 'chore(s1): claim' },
    ];
    const reads: string[] = [];
    const git = fakeGit({ commits });
    checkClaim(input, { ...git, fileAt: (ref, path) => (reads.push(ref), git.fileAt(ref, path)) });
    expect(reads).toContain(CLAIM_SHA);
    expect(reads).not.toContain('older');
  });

  it('rebuilds when the row\'s territory changed since the claim', () => {
    const now = plan([['s1', 'Alpha', '`a/`']]);
    expect(checkClaim(input, fakeGit({ now, changed: ['a/one.ts'] })).line).toBe('rebuild: plan row changed: territory');
  });

  it('names the territory first when both the title and the territory changed', () => {
    const now = plan([['s1', 'Alpha, renamed', '`a/` `c/`']]);
    expect(checkClaim(input, fakeGit({ now })).line).toBe('rebuild: plan row changed: territory');
  });

  it('reads a row the claim\'s plan did not hold as a changed territory', () => {
    expect(checkClaim(input, fakeGit({ atClaim: null })).line).toBe('rebuild: plan row changed: territory');
    expect(checkClaim(input, fakeGit({ atClaim: plan([['s2', 'Beta', '`b/`']]) })).line).toBe('rebuild: plan row changed: territory');
  });

  it('rebuilds when the row\'s title changed since the claim', () => {
    const now = plan([['s1', 'Alpha, renamed', '`a/` `docs/a.md`']]);
    expect(checkClaim(input, fakeGit({ now })).line).toBe('rebuild: plan row changed: title');
  });

  it('rebuilds on the first changed file outside the territory, naming it', () => {
    const changed = ['a/one.ts', 'b/two.ts', 'c/three.ts'];
    expect(checkClaim(input, fakeGit({ changed }))).toEqual({ reuse: false, line: 'rebuild: outside territory: b/two.ts' });
  });

  it('reads a path as inside only when it starts with a territory entry', () => {
    expect(checkClaim(input, fakeGit({ changed: ['docs/a.md.bak'] })).line).toBe('reuse');
    expect(checkClaim(input, fakeGit({ changed: ['docs/ab.md'] })).line).toBe('rebuild: outside territory: docs/ab.md');
    expect(checkClaim(input, fakeGit({ changed: ['.omni-loop/delivery/outbox/0007-widgets-old/x.md'] })).line).toBe(
      'rebuild: outside territory: .omni-loop/delivery/outbox/0007-widgets-old/x.md',
    );
  });

  it('counts no outbox dir when the PRD has none', () => {
    const changed = ['.omni-loop/delivery/outbox/0007-widgets/s1-01-x.md'];
    expect(checkClaim({ ...input, outboxDir: null }, fakeGit({ changed })).line).toBe(
      'rebuild: outside territory: .omni-loop/delivery/outbox/0007-widgets/s1-01-x.md',
    );
  });

  it('checks the row before the claim, and the claim before the changed files', () => {
    let changedRead = false;
    const git = fakeGit({ now: plan([['s2', 'Beta', '`b/`']]), commits: [] });
    const verdict = checkClaim(input, { ...git, changedFiles: () => ((changedRead = true), []) });
    expect(verdict.line).toBe('rebuild: slice not in the plan');
    expect(checkClaim(input, { ...fakeGit({ commits: [] }), changedFiles: () => ((changedRead = true), []) }).line).toBe('rebuild: no claim commit');
    expect(changedRead).toBe(false);
  });
});
