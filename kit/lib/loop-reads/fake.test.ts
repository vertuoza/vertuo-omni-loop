import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr } from '../ids.ts';
import { aChange, fakeLoopReads } from './fake.ts';
import { boardReads, LoopReadError } from './port.ts';

// The shared fake `LoopReads` (PRD 1665, s3): it answers as the page does, so each command's tests can
// build their facts from it.

const REPO = 'acme/widgets';
const changes = [
  aChange({ number: parsePr(1), head: 'feat/w--s1', base: 'feat/w', state: 'merged', createdAt: '2026-10-10T00:00:00Z', labels: ['omni:sub'] }),
  aChange({ number: parsePr(2), head: 'feat/w--s2', base: 'feat/w', state: 'draft', createdAt: '2026-10-12T00:00:00Z' }),
  aChange({ number: parsePr(3), head: 'feat/w', base: 'main', state: 'closed', createdAt: '2026-10-11T00:00:00Z', labels: ['omni:sub'] }),
];

describe('the fake loop reads', () => {
  it('lists open changes and drafts unless asked for all, newest first, filtered by base, head and label', async () => {
    const reads = fakeLoopReads({ changes: { [REPO]: changes } });
    const numbers = async (query: Parameters<typeof reads.changes>[0]) => (await reads.changes(query)).map((change) => change.number);

    expect(await numbers({ repo: REPO })).toEqual([2]);
    expect(await numbers({ repo: REPO, state: 'all' })).toEqual([2, 3, 1]);
    expect(await numbers({ repo: REPO, state: 'all', base: 'feat/w' })).toEqual([2, 1]);
    expect(await numbers({ repo: REPO, state: 'all', head: 'feat/w' })).toEqual([3]);
    expect(await numbers({ repo: REPO, state: 'all', label: 'omni:sub' })).toEqual([3, 1]);
    expect(await numbers({ repo: 'acme/other', state: 'all' })).toEqual([]);
    expect(reads.reads[0]).toEqual({ read: 'changes', query: { repo: REPO } });
  });

  it('reads one change with its details, and refuses one it does not hold', async () => {
    const reads = fakeLoopReads({ changes: { [REPO]: changes }, details: { [`${REPO}#2`]: { lastCommitAt: '2026-10-12T01:00:00Z' } } });
    expect(await reads.change(REPO, parsePr(2))).toMatchObject({ number: 2, lastCommitAt: '2026-10-12T01:00:00Z', files: [], review: { mergeable: null } });
    expect(await boardReads(reads).lastCommitAt(REPO, parsePr(1))).toBeNull();
    await expect(reads.change(REPO, parsePr(9))).rejects.toMatchObject({ line: 'refused (404): No change 9 in acme/widgets', scope: 'repository' });
  });

  it('reads comments, issues and one issue', async () => {
    const issue = { number: parseIssue(21), title: 'Bug', state: 'open' as const, labels: ['omni:bug'], body: 'PRD #7' };
    const closed = { ...issue, number: parseIssue(5), state: 'closed' as const };
    const comment = { id: 1, author: null, body: 'hi', createdAt: '2026-10-12T00:00:00Z', updatedAt: '2026-10-12T00:00:00Z' };
    const reads = fakeLoopReads({
      issues: { [REPO]: [closed, issue] },
      comments: { [`${REPO}#21`]: [comment as never] },
      issueDetails: { [`${REPO}#21`]: { closedBy: [parsePr(31)] } },
    });

    expect((await reads.issues({ repo: REPO, label: 'omni:bug' })).map((found) => found.number)).toEqual([21]);
    expect((await reads.issues({ repo: REPO, state: 'all' })).map((found) => found.number)).toEqual([21, 5]);
    expect((await reads.issues({ repo: REPO, state: 'closed' })).map((found) => found.number)).toEqual([5]);
    expect(await reads.comments(REPO, parseIssue(21))).toEqual([comment]);
    expect(await reads.issue(REPO, parseIssue(21))).toMatchObject({ number: 21, comments: [], closedBy: [31] });
    await expect(reads.issue(REPO, parseIssue(99))).rejects.toBeInstanceOf(LoopReadError);
  });

  it('throws a failing repository\'s error on its reads only, and everything\'s on every read', async () => {
    const refused = new LoopReadError('refused (403): acme/other is not in your workspace', 'repository');
    const reads = fakeLoopReads({ changes: { [REPO]: changes }, failing: { 'acme/other': refused } });
    await expect(reads.changes({ repo: 'acme/other' })).rejects.toBe(refused);
    await expect(reads.changes({ repo: REPO })).resolves.toHaveLength(1);

    const down = new LoopReadError('unreachable', 'everything');
    await expect(fakeLoopReads({ everything: down }).issues({ repo: REPO })).rejects.toBe(down);
  });
});
