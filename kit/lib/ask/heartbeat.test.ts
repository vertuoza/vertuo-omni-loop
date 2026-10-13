// The heartbeat's pure parts (PRD 757): the work finder and the throttle's window.
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { beatsAfter, claimWindow, findWork, forgetWindow, HEARTBEAT_EVERY_MS, startHeartbeat, windowDue } from './heartbeat.ts';

const BRANCHES = { feature: 'feat/{topic}', phase0: 'docs/phase-0-{topic}', slice: 'feat/{topic}--{slice}', fix: 'fix/{topic}' };
const FOLDERS = {
  inbox: ['0757-play-while-working', '0001-other'],
  shipped: ['0433-large-repo-file-list'],
  visual: ['0653-menu-sprites'],
  bugs: ['0674-fix-lists-mine'],
};
const draft = (over: Record<string, unknown> = {}) => ({ id: 'draft-1', url: 'https://x/prd/draft-1', claudeSessionId: 'claude-a', prd: null, openedAt: '2026-09-30T10:00:00Z', ...over });
const find = (over: Record<string, unknown> = {}) => findWork({ claudeSessionId: 'claude-a', drafts: [], branch: null, branches: BRANCHES, folders: FOLDERS, ...over });

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

describe('windowDue, the window read without claiming it (PRD 1831)', () => {
  it('is due with no window, not due inside one, due again once it is 60 s old, and writes nothing', () => {
    const { root } = makeRepo({ git: true });
    expect(windowDue(root, 'claude-a', 1_000_000)).toBe(true);
    expect(windowDue(root, 'claude-a', 1_000_000)).toBe(true);
    claimWindow(root, 'claude-a', 1_000_000);
    expect(windowDue(root, 'claude-a', 1_000_001)).toBe(false);
    expect(windowDue(root, 'claude-a', 1_000_000 + HEARTBEAT_EVERY_MS)).toBe(true);
    expect(windowDue(root, '../escape', 1)).toBe(false);
  });
});

describe('beatsAfter, the commands that send the heartbeat (PRD 1831)', () => {
  it('is every command but heartbeat, ask hook, session end and statusline', () => {
    for (const argv of [['status'], ['prd', '7'], ['ask', 'on'], ['ask', 'question', '--file', 'q.json'], ['session', 'start'], ['help', 'heartbeat']]) {
      expect(beatsAfter(argv), argv.join(' ')).toBe(true);
    }
    for (const argv of [['heartbeat'], ['heartbeat', '--end'], ['ask', 'hook', 'pre'], ['ask', 'hook', 'end'], ['session', 'end'], ['statusline'], ['statusline', '--refresh', '7'], []]) {
      expect(beatsAfter(argv), argv.join(' ')).toBe(false);
    }
  });
});

describe('startHeartbeat, the detached child (PRD 1831)', () => {
  it('starts `node <script> heartbeat --claimed` detached in cwd, its output ignored, and lets it go', () => {
    const calls: { command: string; args: readonly string[]; options: unknown }[] = [];
    let unrefs = 0;
    const spawn = (command: string, args: readonly string[], options: unknown) => {
      calls.push({ command, args, options });
      return { on: () => undefined, unref: () => { unrefs += 1; } };
    };
    startHeartbeat({ spawn, script: '/kit/omni.mjs', cwd: '/repo', env: { OMNI_SESSION_ID: 's' } });
    expect(calls).toEqual([{ command: process.execPath, args: ['/kit/omni.mjs', 'heartbeat', '--claimed'], options: { cwd: '/repo', detached: true, stdio: 'ignore', windowsHide: true, env: { OMNI_SESSION_ID: 's' } } }]);
    expect(unrefs).toBe(1);
  });

  it('never throws when the child cannot start', () => {
    const spawn = () => {
      throw new Error('EAGAIN');
    };
    expect(() => { startHeartbeat({ spawn, script: '/kit/omni.mjs', cwd: '/repo', env: {} }); }).not.toThrow();
  });
});
