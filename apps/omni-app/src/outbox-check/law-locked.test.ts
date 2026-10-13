import { describe, expect, it } from 'vitest';
import type { Verdict } from '../evaluate/evaluate.ts';
import { approversOf, withLawGate, type LawGate } from './law-locked.ts';

const review = (login: string | null, state: string, commit = 'head1') => ({ user: login === null ? null : { login }, state, commit_id: commit });

describe('approversOf — each author’s latest standing review, approving the head', () => {
  it('keeps an approval of the head, and drops one of an older commit', () => {
    expect(approversOf([review('ann', 'APPROVED'), review('bob', 'APPROVED', 'head0')], 'head1')).toEqual(['ann']);
  });

  it('a later change request or dismissal withdraws it; a later comment leaves it standing', () => {
    expect(approversOf([review('ann', 'APPROVED'), review('ann', 'CHANGES_REQUESTED')], 'head1')).toEqual([]);
    expect(approversOf([review('ann', 'APPROVED'), review('ann', 'DISMISSED')], 'head1')).toEqual([]);
    expect(approversOf([review('ann', 'APPROVED'), review('ann', 'COMMENTED')], 'head1')).toEqual(['ann']);
    expect(approversOf([review('ann', 'CHANGES_REQUESTED'), review('ann', 'APPROVED')], 'head1')).toEqual(['ann']);
  });

  it('a review with no author, or a pending one, counts for no one', () => {
    expect(approversOf([review(null, 'APPROVED'), review('ann', 'PENDING')], 'head1')).toEqual([]);
  });
});

const verdict = (conclusion: Verdict['conclusion'], title = 'Outbox clear'): Verdict => ({ conclusion, title, summary: 'The kit said so.', comment: null });
const fired = (law: string, path: string) => ({ law, path, status: 'M', rule: 'law-locked' });

describe('withLawGate', () => {
  it('no locked law changed: the verdict as it was', () => {
    const was = verdict('neutral', 'Override in effect (omni:outbox-go)');
    expect(withLawGate(was, null)).toBe(was);
  });

  it('every law cleared: the verdict kept, its approvals said', () => {
    const gate: LawGate = { fired: [fired('N1', 'a.md'), fired('N1', 'a.test.ts'), fired('N2', 'b.md')], awaiting: [], approvedBy: ['ann', 'bob'], codeowners: '.github/CODEOWNERS' };
    expect(withLawGate(verdict('success'), gate)).toEqual({
      ...verdict('success'),
      summary: 'The kit said so.\n\nLocked laws changed (N1, N2): approved by their CODEOWNERS, @ann, @bob.',
    });
  });

  it('a law held: failure, whatever was concluded, each held law on its line, the kit’s report after', () => {
    const gate: LawGate = {
      fired: [fired('N1', 'a.md'), fired('N2', 'b.md')],
      awaiting: [
        { law: 'N1', reason: 'no-approval', paths: ['a.md', 'a.test.ts'], owners: ['@ann', '@bob'] },
        { law: 'N2', reason: 'no-codeowner', paths: ['b.md'], owners: [] },
      ],
      approvedBy: [],
      codeowners: 'CODEOWNERS',
    };
    expect(withLawGate(verdict('neutral', 'Override in effect (omni:outbox-go)'), gate)).toEqual({
      conclusion: 'failure',
      title: "Locked law changed without its CODEOWNER's approval — N1, N2",
      summary: [
        'This pull request changes a locked law. Only an approving review on GitHub from a CODEOWNER of each file it changed clears it: no outbox item, label or trailer does.',
        '  - N1: waiting for an approving review of the head commit from @ann or @bob, who own `a.md`, `a.test.ts`.',
        '  - N2: no person in `CODEOWNERS` owns `b.md` on the base branch, so nothing can clear it — add its owner there first.',
        '',
        'The kit said so.',
      ].join('\n'),
      comment: null,
    });
  });

  it('no CODEOWNERS file at all is said so; a failure already there keeps its title after the law’s', () => {
    const gate: LawGate = { fired: [fired('N1', 'a.md')], awaiting: [{ law: 'N1', reason: 'no-codeowner', paths: ['a.md'], owners: [] }], approvedBy: [], codeowners: null };
    const held = withLawGate(verdict('failure', '1 open outbox item'), gate);
    expect(held.title).toBe("Locked law changed without its CODEOWNER's approval — N1; 1 open outbox item");
    expect(held.summary).toContain('  - N1: no CODEOWNERS file owns `a.md` on the base branch');
  });
});
