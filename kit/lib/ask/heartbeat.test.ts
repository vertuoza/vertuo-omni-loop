// @ts-nocheck
// The heartbeat's pure parts (PRD 757): the work finder and the throttle's window.
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { claimWindow, findWork, forgetWindow, HEARTBEAT_EVERY_MS } from './heartbeat.ts';

const BRANCHES = { feature: 'feat/{topic}', phase0: 'docs/phase-0-{topic}', slice: 'feat/{topic}--{slice}', fix: 'fix/{topic}' };
const FOLDERS = {
  inbox: ['0757-play-while-working', '0001-other'],
  shipped: ['0433-large-repo-file-list'],
  visual: ['0653-menu-sprites'],
  bugs: ['0674-fix-lists-mine'],
};
const draft = (over) => ({ id: 'draft-1', url: 'https://x/prd/draft-1', claudeSessionId: 'claude-a', prd: null, openedAt: '2026-09-30T10:00:00Z', ...over });
const find = (over) => findWork({ claudeSessionId: 'claude-a', drafts: [], branch: null, branches: BRANCHES, folders: FOLDERS, ...over });

describe('findWork', () => {
  it("names this session's draft first, whatever the branch", () => {
    expect(find({ drafts: [draft()], branch: 'feat/play-while-working' })).toEqual({ kind: 'draft', draftId: 'draft-1' });
  });

  it("takes this session's latest draft, and never another session's", () => {
    const drafts = [
      draft({ id: 'old', openedAt: '2026-09-30T09:00:00Z' }),
      draft({ id: 'new', openedAt: '2026-09-30T11:00:00Z' }),
      draft({ id: 'theirs', claudeSessionId: 'claude-b', openedAt: '2026-09-30T12:00:00Z' }),
    ];
    expect(find({ drafts })).toEqual({ kind: 'draft', draftId: 'new' });
    expect(find({ drafts: [draft({ claudeSessionId: 'claude-b' })] })).toBeNull();
  });

  it('names the PRD a draft of this session was numbered as', () => {
    expect(find({ drafts: [draft({ prd: 757 })] })).toEqual({ kind: 'prd', number: 757 });
  });

  it('finds the PRD of a feature, phase-0 and slice branch, in the inbox and in shipped', () => {
    for (const branch of ['feat/play-while-working', 'docs/phase-0-play-while-working', 'feat/play-while-working--s1']) {
      expect(find({ branch })).toEqual({ kind: 'prd', number: 757 });
    }
    expect(find({ branch: 'feat/large-repo-file-list--s3' })).toEqual({ kind: 'prd', number: 433 });
  });

  it('finds the visual and the bug fix of a fix branch', () => {
    expect(find({ branch: 'fix/menu-sprites' })).toEqual({ kind: 'visual', number: 653 });
    expect(find({ branch: 'fix/fix-lists-mine' })).toEqual({ kind: 'bug', number: 674 });
  });

  it('is null for a branch with no folder, for a detached HEAD and for the default branch', () => {
    for (const branch of ['feat/nothing-here', 'fix/nothing-here', 'main', null, '']) expect(find({ branch })).toBeNull();
  });

  it('is null when there is no session id and no branch', () => {
    expect(find({ claudeSessionId: null, drafts: [draft()] })).toBeNull();
  });
});

describe('the throttle window', () => {
  it('claims once per 60 s per Claude session, each session its own window', () => {
    const { root } = makeRepo({ git: true });
    const t0 = 1_000_000;
    expect(claimWindow(root, 'claude-a', t0)).toBe(true);
    expect(claimWindow(root, 'claude-a', t0 + 1)).toBe(false);
    expect(claimWindow(root, 'claude-a', t0 + HEARTBEAT_EVERY_MS - 1)).toBe(false);
    expect(claimWindow(root, 'claude-b', t0 + 1)).toBe(true);
    expect(claimWindow(root, 'claude-a', t0 + HEARTBEAT_EVERY_MS)).toBe(true);
  });

  it('refuses an id that could not name a file, and a forgotten window opens again', () => {
    const { root } = makeRepo({ git: true });
    expect(claimWindow(root, '../escape', 1)).toBe(false);
    expect(claimWindow(root, 'claude-a', 1)).toBe(true);
    forgetWindow(root, 'claude-a');
    expect(claimWindow(root, 'claude-a', 2)).toBe(true);
  });
});
