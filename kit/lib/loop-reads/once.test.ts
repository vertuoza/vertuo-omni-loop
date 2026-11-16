import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr } from '../ids.ts';
import { aChange, fakeLoopReads } from './fake.ts';
import { readOnce } from './once.ts';
import { LoopReadError } from './port.ts';
import type { LoopReads } from './port.ts';

const REPO = 'acme/widgets';
const fake = () => fakeLoopReads({ changes: { [REPO]: [aChange({ number: parsePr(9), head: 'feat/widgets' })] }, issues: { [REPO]: [] } });

describe('readOnce', () => {
  it('sends each distinct read once, the same answer to every ask, even asked while the first waits', async () => {
    const reads = fake();
    const once = readOnce(reads);
    const [first, second] = await Promise.all([once.changes({ repo: REPO, label: 'omni:phase-0', state: 'open' }), once.changes({ repo: REPO, label: 'omni:phase-0', state: 'open' })]);
    await once.changes({ repo: REPO, state: 'open', label: 'omni:phase-0', head: undefined });
    expect(second).toBe(first);
    expect(reads.reads).toEqual([{ read: 'changes', query: { repo: REPO, label: 'omni:phase-0', state: 'open' } }]);
  });

  it('sends a read again when anything it was given differs', async () => {
    const reads = fake();
    const once = readOnce(reads);
    await once.changes({ repo: REPO, head: 'feat/widgets', state: 'all' });
    await once.changes({ repo: REPO, base: 'feat/widgets', state: 'all' });
    await once.changes({ repo: REPO, head: 'feat/widgets' });
    await once.change(REPO, parsePr(9));
    await once.change(REPO, parsePr(9));
    await once.comments(REPO, parsePr(9));
    await once.comments(REPO, parseIssue(10));
    await once.issues({ repo: REPO, label: 'x' });
    await once.issues({ repo: REPO, label: 'x' });
    await once.issues({ repo: REPO, label: 'y' });
    expect(reads.reads.map((read) => read.read)).toEqual(['changes', 'changes', 'changes', 'change', 'comments', 'comments', 'issues', 'issues']);
  });

  it('keeps one issue read per number', async () => {
    const reads = fakeLoopReads({ issues: { [REPO]: [{ number: parseIssue(3), title: 't', state: 'open', labels: [], body: '' }] } });
    const once = readOnce(reads);
    await once.issue(REPO, parseIssue(3));
    await once.issue(REPO, parseIssue(3));
    await expect(once.issue(REPO, parseIssue(4))).rejects.toThrow('No issue 4');
    expect(reads.reads).toHaveLength(2);
  });

  it('a read that failed throws the same error, and is sent again when asked again', async () => {
    let calls = 0;
    const refused = new LoopReadError('unreachable', 'everything');
    const reads: LoopReads = {
      ...fake(),
      changes: () => {
        calls += 1;
        return calls === 1 ? Promise.reject(refused) : Promise.resolve([]);
      },
    };
    const once = readOnce(reads);
    await expect(once.changes({ repo: REPO })).rejects.toBe(refused);
    expect(await once.changes({ repo: REPO })).toEqual([]);
    expect(calls).toBe(2);
  });
});
