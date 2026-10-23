// PRD 2485, s1: the pure parts of `omni worktrees`: git's porcelain list, the branch shapes, the sizes.
import { describe, expect, it } from 'vitest';
import { formatSize, gitLine } from './engine.ts';
import { isInside, kindOf, parseWorktreeList, shapeOf } from './list.ts';

const BRANCHES = { slice: 'feat/{topic}--{slice}', feature: 'feat/{topic}', phase0: 'docs/phase-0-{topic}' };

describe('parseWorktreeList (PRD 2485)', () => {
  it('reads each block: path, head, short branch, detached, locked and prunable', () => {
    const text = [
      'worktree /repo',
      'HEAD aaa',
      'branch refs/heads/main',
      '',
      'worktree /repo/.wt/one',
      'HEAD bbb',
      'branch refs/heads/feat/x--s1',
      'locked an agent works here',
      '',
      'worktree /repo/.wt/two',
      'HEAD ccc',
      'detached',
      'prunable gitdir file points to non-existent location',
      '',
    ].join('\n');
    expect(parseWorktreeList(text)).toEqual([
      { path: '/repo', head: 'aaa', branch: 'main', locked: false, prunable: false },
      { path: '/repo/.wt/one', head: 'bbb', branch: 'feat/x--s1', locked: true, prunable: false },
      { path: '/repo/.wt/two', head: 'ccc', branch: null, locked: false, prunable: true },
    ]);
    expect(parseWorktreeList('')).toEqual([]);
  });
});

describe('shapeOf and kindOf (PRD 2485)', () => {
  it('reads a slice, a feature and a phase-0 branch, the slice shape first', () => {
    expect(shapeOf('feat/widgets--s12', BRANCHES)).toEqual({ kind: 'kit', shape: 'slice', topic: 'widgets', slice: 's12' });
    expect(shapeOf('feat/two-words', BRANCHES)).toEqual({ kind: 'kit', shape: 'feature', topic: 'two-words', slice: null });
    expect(shapeOf('docs/phase-0-widgets', BRANCHES)).toEqual({ kind: 'kit', shape: 'phase0', topic: 'widgets', slice: null });
  });

  it('reads no other branch as the kit’s', () => {
    for (const branch of ['main', 'spike/x', 'feat/Upper', 'feat/', 'feat/x/y', 'fix/widgets', 'xfeat/widgets', 'feat/widgets.s1']) {
      expect(shapeOf(branch, BRANCHES), branch).toEqual({ kind: 'other' });
    }
  });

  it('follows the templates the config declares, its punctuation read as written', () => {
    const branches = { slice: 'work.{topic}+{slice}', feature: 'work.{topic}', phase0: 'p0.{topic}' };
    expect(shapeOf('work.widgets+s1', branches)).toMatchObject({ shape: 'slice', slice: 's1' });
    expect(shapeOf('workXwidgets', branches)).toEqual({ kind: 'other' });
  });

  it('is the kit’s only under the folder and on a branch', () => {
    const folder = '/repo/.wt';
    expect(kindOf({ path: '/repo/.wt/a', branch: 'feat/x' }, { folder, branches: BRANCHES }).kind).toBe('kit');
    expect(kindOf({ path: '/repo/.wt/a', branch: null }, { folder, branches: BRANCHES }).kind).toBe('other');
    expect(kindOf({ path: '/repo/elsewhere', branch: 'feat/x' }, { folder, branches: BRANCHES }).kind).toBe('other');
    expect(kindOf({ path: '/repo/.wt', branch: 'feat/x' }, { folder, branches: BRANCHES }).kind).toBe('other');
    expect(isInside('/repo/.wt', '/repo/.wt-other/a')).toBe(false);
  });
});

describe('formatSize and gitLine (PRD 2485)', () => {
  it('prints a size as a person reads it', () => {
    expect([0, 512, 1024, 12 * 1024, 1.44 * 1024 ** 2, 186 * 1024 ** 3].map(formatSize)).toEqual(['0 B', '512 B', '1 KB', '12 KB', '1.4 MB', '186.0 GB']);
  });

  it("keeps git's first line, without its prefix", () => {
    expect(gitLine("\nerror: the branch 'x' is not fully merged.\nhint: …")).toBe("the branch 'x' is not fully merged.");
    expect(gitLine('fatal: cannot remove a locked working tree')).toBe('cannot remove a locked working tree');
    expect(gitLine('')).toBe('git refused');
  });
});
