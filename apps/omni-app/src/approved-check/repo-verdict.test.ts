import { describe, expect, it } from 'vitest';
import type { ApprovalReading } from 'omni-loop/kit/lib/approval/approval.ts';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { heldReading } from './repo-reading.ts';
import { dossierOf, repoApprovedVerdict } from './repo-verdict.ts';

const hash = (c: string) => c.repeat(64);
const DOSSIER = '0d5e0c6e-1612-4a1b-8c2d-3e4f5a6b7c8d';
const URL_ = `https://galaxy.test/prd/${DOSSIER}`;
const PRD = parsePrd(1612);
const files = [{ kind: 'plan', path: 'x/plan.md', sha256: hash('b'), versionId: 'v' }];
const approved = { approver: { login: 'pm', member: true }, approvedAt: 't', files };
const reading = (over: Partial<ApprovalReading>): ApprovalReading => ({ state: 'approved', lines: ['approved by pm · t'], url: URL_, approval: approved, drift: [], ...over });

describe('dossierOf', () => {
  it('reads the dossier from the PRD page’s link, and none from any other link', () => {
    expect(dossierOf(URL_)).toBe(DOSSIER);
    expect(dossierOf(`${URL_}/#approve`)).toBe(DOSSIER);
    expect(dossierOf('https://galaxy.test/prd/acme/widgets/1612')).toBeNull();
    expect(dossierOf(null)).toBeNull();
  });
});

describe('repoApprovedVerdict — a ◆ PRD of a repository, in PRD 1548’s states (PRD 1612)', () => {
  it('names each of PRD 1612’s states once, with PRD 1548’s names', () => {
    expect(repoApprovedVerdict(PRD, reading({}), 'head1')).toMatchObject({ state: 'building', conclusion: 'success', title: 'building · 1 of 1 pinned', dossierId: DOSSIER });
    expect(repoApprovedVerdict(PRD, reading({ state: 'pending', approval: null }), 'head1'))
      .toMatchObject({ state: 'pending', conclusion: 'failure', title: 'pending · PRD 1612 waits for approval' });
    expect(repoApprovedVerdict(PRD, heldReading('galaxy answered 500'), 'head1'))
      .toMatchObject({ state: 'held', conclusion: 'neutral', title: 'held · server unreachable · held, not failed', dossierId: null });
  });

  it('holds a reading refused by an error page, and refuses one whose approver left', () => {
    expect(repoApprovedVerdict(PRD, reading({ state: 'refused', lines: ['refused (500)'], url: null, approval: null }), 'head1'))
      .toMatchObject({ state: 'held', conclusion: 'neutral' });
    const gone = { ...approved, approver: { login: 'pm', member: false } };
    expect(repoApprovedVerdict(PRD, reading({ state: 'refused', approval: gone }), 'head1'))
      .toMatchObject({ state: 'refused', conclusion: 'failure', title: 'refused · approver pm is not a workspace member' });
  });

  it('names a changed pin by the head, a voided one by its push, and a missing one alone', () => {
    const changed = repoApprovedVerdict(PRD, reading({ state: 'drifted', drift: [{ kind: 'plan', file: 'x/plan.md', how: 'content' }] }), 'abcdef1234');
    expect(changed).toMatchObject({ state: 'drifted', conclusion: 'failure', title: 'drifted · ≠ plan.md in abcdef1 · content' });
    expect(changed.summary).toContain('Run `omni approval restore 1612`');
    expect(changed.summary).toContain('Read against abcdef1234.');
    const voided = { ...approved, voids: [{ pusher: 'bob', kind: 'plan', from: 'a', to: 'b', voidedAt: 't' }] };
    expect(repoApprovedVerdict(PRD, reading({ state: 'drifted', approval: voided, drift: [{ kind: 'plan', file: 'x/plan.md', how: 'voided' }] }), 'head1').title)
      .toBe('drifted · ≠ plan.md · voided by bob\'s push');
    expect(repoApprovedVerdict(PRD, reading({ state: 'drifted', drift: [{ kind: 'spec', file: 'x/spec.md', how: 'voided' }] }), 'head1').title)
      .toBe('drifted · ≠ spec.md · voided by a push');
    expect(repoApprovedVerdict(PRD, reading({ state: 'drifted', drift: [{ kind: 'plan', file: 'x/plan.md', how: 'missing' }] }), 'head1').title)
      .toBe('drifted · ≠ plan.md · missing');
  });
});
