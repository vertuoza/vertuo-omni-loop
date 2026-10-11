import { describe, expect, it } from 'vitest';
import { approvedVerdict, productPrdOf, type ApprovalInForce, type ApprovalRecord, type LatestVersion, type PinnedFile } from './state.ts';

const hash = (c: string) => c.repeat(64);
const MOBILE_12 = { key: 'mobile', seq: 12, id: 'mobile-12' };

const pin = (kind: string, path: string, sha: string, content: string | null = `${kind} text`): PinnedFile =>
  ({ kind, path, sha256: hash(sha), versionId: `${sha}0000000-v`, content });
const PINS = [pin('spec', 'spec.md', 'a'), pin('plan', 'plan.md', 'b', 'Slice one.\nSlice two.\n'), pin('before-after', 'before-after.html', 'c'), pin('voice', 'voice.json', 'd')];
const latestOf = (pins: PinnedFile[]): LatestVersion[] =>
  pins.map(({ kind, sha256, versionId, content }) => ({ kind, sha256, versionId, commitSha: null, content }));

const approval = (over: Partial<ApprovalInForce> = {}): ApprovalInForce => ({
  approver: { login: 'pm', member: true },
  approvedAt: '2026-10-11T08:00:00.000Z',
  files: PINS,
  voids: [],
  ...over,
});
const record = (over: Partial<ApprovalRecord> = {}): ApprovalRecord => ({ dossierId: 'd-1', approval: approval(), latest: latestOf(PINS), ...over });
const read = (r: ApprovalRecord | null) => approvedVerdict(MOBILE_12, { reachable: true, record: r });

describe('productPrdOf', () => {
  it('reads the product PRD a body says it is part of', () => {
    expect(productPrdOf('Part of mobile-12 · https://www.omni-loop.xyz/prd/x')).toEqual(MOBILE_12);
    expect(productPrdOf('Feature.\n\nPart of field-app-3\n')).toEqual({ key: 'field-app', seq: 3, id: 'field-app-3' });
  });

  it('names none for a body naming no product PRD, a plan repository PRD, or an id out of shape', () => {
    for (const body of [null, undefined, '', 'Closes #12', 'Part of acme/plans#12', 'Part of #12', 'Part of Mobile-12', 'Part of 12-mobile',
      'Part of mobile', 'Part of mobile-0', 'Part of mobile-12x', 'Part of mobile-1-2x', 'xPart of mobile-12', `Part of ${'a'.repeat(41)}-1`, 'Part of mobile-99999999999']) {
      expect(productPrdOf(body), String(body)).toBeNull();
    }
  });
});

describe('approvedVerdict', () => {
  it('builds when every pin matches the latest versions and the approver is a member', () => {
    const verdict = read(record());
    expect(verdict).toMatchObject({ state: 'building', conclusion: 'success', title: 'building · 4 of 4 pinned', dossierId: 'd-1', drift: [] });
    expect(verdict.summary).toContain('Approved by **pm** (a member of the workspace) at 2026-10-11T08:00:00.000Z.');
    expect(verdict.summary).toContain(`| plan.md | \`${hash('b').slice(0, 12)}\` | \`${hash('b').slice(0, 12)}\` | ✓ |`);
  });

  it('drifts on a change of content, naming the file and the commit it was pushed from', () => {
    const latest = latestOf(PINS).map((v) => (v.kind === 'plan' ? { ...v, sha256: hash('e'), commitSha: '0123456789abcdef', content: 'Slice one only.\n' } : v));
    const verdict = read(record({ latest }));
    expect(verdict).toMatchObject({ state: 'drifted', conclusion: 'failure', title: 'drifted · ≠ plan.md in 0123456 · content' });
    expect(verdict.summary).toContain(`| plan.md | \`${hash('b').slice(0, 12)}\` | \`${hash('e').slice(0, 12)}\` | ≠ |`);
  });

  it('drifts on whitespace only when the texts differ in spacing alone, naming the version when no commit was named', () => {
    const latest = latestOf(PINS).map((v) => (v.kind === 'plan' ? { ...v, sha256: hash('e'), versionId: 'f00dfeed-1234', content: 'Slice one.\n\n  Slice two.' } : v));
    expect(read(record({ latest })).title).toBe('drifted · ≠ plan.md in version f00dfeed · whitespace only');
  });

  it('drifts on content when either text is unknown, and on a pinned kind with no version left', () => {
    const unknown = latestOf(PINS).map((v) => (v.kind === 'plan' ? { ...v, sha256: hash('e'), content: null } : v));
    expect(read(record({ latest: unknown })).title).toMatch(/· content$/);
    const gone = latestOf(PINS).filter((v) => v.kind !== 'spec');
    expect(read(record({ latest: gone })).title).toBe('drifted · ≠ spec.md · missing');
  });

  it('never drifts on the voice, which the loop appends after approval', () => {
    const latest = latestOf(PINS).map((v) => (v.kind === 'voice' ? { ...v, sha256: hash('f') } : v));
    expect(read(record({ latest })).state).toBe('building');
  });

  it('drifts on a void even when the file was restored, naming the push', () => {
    const voids = [{ pusher: 'dev', kind: 'plan', from: hash('b'), to: hash('e'), voidedAt: '2026-10-11T09:00:00.000Z' }];
    const verdict = read(record({ approval: approval({ voids }) }));
    expect(verdict).toMatchObject({ state: 'drifted', title: "drifted · ≠ plan.md · voided by dev's push", drift: [{ file: 'plan.md', how: 'voided', where: "dev's push" }] });
  });

  it('lists every drift once, a voided kind that also differs by its difference', () => {
    const voids = [{ pusher: 'dev', kind: 'plan', from: hash('b'), to: hash('e'), voidedAt: 't' }, { pusher: 'dev', kind: 'scenario', from: hash('b'), to: hash('e'), voidedAt: 't' }];
    const latest = latestOf(PINS).map((v) => (v.kind === 'plan' ? { ...v, sha256: hash('e'), content: 'other' } : v));
    const verdict = read(record({ approval: approval({ voids }), latest }));
    expect(verdict.drift.map((d) => `${d.file} ${d.how}`)).toEqual(['plan.md content', 'scenario voided']);
    expect(verdict.summary.split('\n').slice(0, 2)).toEqual(['≠ plan.md in version b0000000 · content', "≠ scenario · voided by dev's push"]);
  });

  it('refuses an approver no longer a member', () => {
    const verdict = read(record({ approval: approval({ approver: { login: 'gone', member: false } }) }));
    expect(verdict).toMatchObject({ state: 'refused', conclusion: 'failure', title: 'refused · approver gone is not a workspace member' });
    expect(verdict.summary).toContain('(no longer a member)');
  });

  it('waits on a PRD nobody approved yet', () => {
    expect(read(record({ approval: null }))).toMatchObject({ state: 'pending', conclusion: 'failure', title: 'pending · mobile-12 waits for approval', dossierId: 'd-1' });
  });

  it('fails a PRD id no product holding this repository has', () => {
    expect(read(null)).toMatchObject({ state: 'unknown', conclusion: 'failure', title: 'unknown · no product PRD mobile-12 holds this repository', dossierId: null });
  });

  it('holds, never fails, when the record cannot be read', () => {
    expect(approvedVerdict(MOBILE_12, { reachable: false, since: '2026-10-11T10:00:00.000Z' })).toMatchObject({
      state: 'held',
      conclusion: 'neutral',
      title: 'held · server unreachable since 2026-10-11 10:00 UTC · held, not failed',
      dossierId: null,
    });
    expect(approvedVerdict(MOBILE_12, { reachable: false, since: 'a moment ago' }).title).toBe('held · server unreachable since a moment ago · held, not failed');
  });
});
