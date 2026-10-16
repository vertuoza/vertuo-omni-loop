import { describe, expect, it } from 'vitest';
import type { ApprovalRow, ApprovalVoid } from './approval';
import {
  roadmapApprovalView, roadmapStatus, shownVersion, versionPickOf, versionsView, type RoadmapRecordRead, type RoadmapVersion,
} from './RoadmapRecord';

// A product roadmap's approval, status and versions (PRD 2011, s3), pure: waiting for approval, approved
// with its seal, drifted once a newer roadmap.md was pushed (a newer set of rows never drifts it), voided,
// and the Approve button only for a member the product asks.

const DOSSIER = '00000000-0000-4000-8000-0000000000e1';
const version = (id: string, kind: RoadmapVersion['kind'], at: string): RoadmapVersion => ({ id, kind, bytes: 10, source: 'kit', created_at: at });
const DOC_1 = version('d1', 'roadmap', '2026-10-15T08:00:00Z');
const ROWS_1 = version('r1', 'roadmap-prds', '2026-10-15T08:00:00Z');
const APPROVED: ApprovalRow = {
  id: 'a-1', approver_login: 'ada', approved_at: '2026-10-15T09:12:00Z',
  files: [{ kind: 'roadmap', path: 'roadmap.md', version_id: 'd1', sha256: '9c41aa00e07b' }],
};
const read = (over: Partial<RoadmapRecordRead> = {}): RoadmapRecordRead => ({
  dossier: DOSSIER, versions: [DOC_1, ROWS_1], approval: null, voids: [], asked: [], text: null, ...over,
});
const view = (over: Partial<RoadmapRecordRead> = {}, me: string | null = 'u-ada') => roadmapApprovalView(read(over), me, 'mobile-R3');

describe('a product roadmap\'s approval', () => {
  it('waits for approval, and a member gets Approve', () => {
    expect(view()).toMatchObject({ state: 'waiting', words: 'waiting for approval', canApprove: true, dossier: DOSSIER, seal: null });
  });

  it('is approved by whom and when, with a seal naming roadmap.md and no Approve button', () => {
    const approved = view({ approval: APPROVED });
    expect(approved).toMatchObject({ state: 'approved', detail: 'by ada · 15 Oct 2026, 09:12 UTC', canApprove: false });
    expect(approved.seal).toEqual({ roadmap: 'mobile-R3', approver: 'ada', at: '15 Oct 2026, 09:12 UTC', files: [{ path: 'roadmap.md', hash: '9c41aa0' }] });
  });

  it('drifts, naming roadmap.md, once a newer document was pushed, and offers Approve again', () => {
    const drifted = view({ approval: APPROVED, versions: [DOC_1, ROWS_1, version('d2', 'roadmap', '2026-10-15T10:00:00Z')] });
    expect(drifted).toMatchObject({ state: 'drifted', words: 'drifted · approve again', changed: ['roadmap.md'], canApprove: true });
    expect(drifted.detail).toBe('roadmap.md changed since ada approved it · 15 Oct 2026, 09:12 UTC');
  });

  it('stays approved when only the PRD rows changed: the approval pins roadmap.md alone', () => {
    expect(view({ approval: APPROVED, versions: [DOC_1, ROWS_1, version('r2', 'roadmap-prds', '2026-10-15T10:00:00Z')] }).state).toBe('approved');
  });

  it('reads a void as voided · approve again, naming who pushed', () => {
    const voided: ApprovalVoid = {
      approval_id: 'a-1', kind: 'roadmap', from_sha256: '9c41aa00e07b', to_sha256: 'b7d2cc00117e', pusher_login: 'bob', voided_at: '2026-10-15T10:00:00Z',
    };
    const v = view({ approval: APPROVED, voids: [voided] });
    expect(v).toMatchObject({ state: 'voided', canApprove: true });
    expect(v.detail).toContain('voided by bob\'s push 9c41aa0→b7d2cc0');
  });

  it('says it could not be read, with no button, when the approval or its voids could not be', () => {
    expect(view({ approval: 'unread' })).toMatchObject({ state: 'unread', canApprove: false });
    expect(view({ voids: null })).toMatchObject({ state: 'unread', canApprove: false });
  });

  it('gives Approve only to the members its product asks, when it asks some', () => {
    expect(view({ asked: ['u-bob'] }).canApprove).toBe(false);
    expect(view({ asked: ['u-ada'] }).canApprove).toBe(true);
    expect(view({ asked: 'unread' }).canApprove).toBe(true);
    expect(view({}, null).canApprove).toBe(false);
  });
});

describe('a product roadmap\'s status', () => {
  it('is held until approved, building once a PRD of it is under way, drifted once its approval no longer holds', () => {
    expect(roadmapStatus('waiting', ['building'])).toBe('held');
    expect(roadmapStatus('unread', [])).toBe('held');
    expect(roadmapStatus('approved', ['waiting', 'waiting'])).toBe('approved');
    expect(roadmapStatus('approved', ['waiting', 'building'])).toBe('building');
    expect(roadmapStatus('approved', ['ready'])).toBe('building');
    expect(roadmapStatus('drifted', ['building'])).toBe('drifted');
    expect(roadmapStatus('voided', [])).toBe('drifted');
  });
});

describe('a product roadmap\'s versions', () => {
  const versions = [DOC_1, ROWS_1, version('d2', 'roadmap', '2026-10-16T08:00:00Z')];
  const href = (part: string, v: number | null) => `/x?${part}:${v}`;

  it('lists each part\'s versions newest first, the one picked current, the latest when none is picked', () => {
    const parts = versionsView(versions, versionPickOf(null, null), href);
    expect(parts.map((p) => [p.label, p.count])).toEqual([['Document', 2], ['PRD rows', 1], ['Human work', 0], ['Prerequisites', 0]]);
    expect(parts[0]?.lines.map((l) => [l.number, l.current, l.href])).toEqual([[2, true, '/x?roadmap:2'], [1, false, '/x?roadmap:1']]);
    expect(parts[0]?.lines[1]?.label).toBe('v1 · 15 Oct 2026, 08:00 UTC · kit');
    expect(parts[1]?.lines.map((l) => l.current)).toEqual([false]);
  });

  it('shows the version asked for, a part\'s latest otherwise, and none when the number is beyond them', () => {
    expect(shownVersion(versions, versionPickOf('roadmap', '1'))?.id).toBe('d1');
    expect(shownVersion(versions, versionPickOf('roadmap', null))?.id).toBe('d2');
    expect(shownVersion(versions, versionPickOf('roadmap-prds', null))?.id).toBe('r1');
    expect(shownVersion(versions, versionPickOf('roadmap-prds', '4'))).toBeNull();
    expect(shownVersion(versions, versionPickOf('roadmap-human-work', null))).toBeNull();
  });

  it('reads the part and the number only as a part and a number', () => {
    expect(versionPickOf('nope', '0')).toEqual({ part: 'roadmap', version: null });
    expect(versionPickOf('roadmap-prerequisites', '12')).toEqual({ part: 'roadmap-prerequisites', version: 12 });
  });
});
