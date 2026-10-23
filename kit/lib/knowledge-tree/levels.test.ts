// PRD 2416, s1: the knowledge tree's levels, and where each level's local copy lies.
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { LEVELS, levelCopies, levelFolder } from './levels.ts';

describe('the knowledge tree — its levels, in the tech side’s order', () => {
  it('names the four levels bottom-up: the repository, its plan repository, the Omni settings, the kit default', () => {
    expect(LEVELS).toEqual(['repo', 'plan repo', 'omni settings', 'kit default']);
  });

  it('keeps the plan repository’s and the Omni settings’ copies in the checkout’s local folder', () => {
    expect(levelFolder('plan repo')).toBe('.omni-loop/local/tree/plan-repo');
    expect(levelFolder('omni settings')).toBe('.omni-loop/local/tree/omni-settings');
  });
});

describe('levelCopies — the copies on disk, an absent one skipped', () => {
  it('reads none in a repository with no copy at all, never an error', () => {
    const { ctx } = makeRepo();
    expect(levelCopies({ ctx })).toEqual([]);
  });

  it('reads each copy present, bottom-up, with a context whose playbook and decisions sit in the copy', () => {
    const { ctx } = makeRepo({
      files: {
        '.omni-loop/local/tree/omni-settings/playbook/testing.md': 'x',
        '.omni-loop/local/tree/plan-repo/playbook/testing.md': 'x',
      },
    });
    const copies = levelCopies({ ctx });
    expect(copies.map(({ level, folder }) => `${level}: ${folder}`)).toEqual([
      'plan repo: .omni-loop/local/tree/plan-repo',
      'omni settings: .omni-loop/local/tree/omni-settings',
    ]);
    const [plan] = copies;
    expect(plan?.ctx.root).toBe(ctx.root);
    expect(plan?.ctx.config).toBe(ctx.config);
    expect(plan?.ctx.layout.formPath('testing')).toBe('.omni-loop/local/tree/plan-repo/playbook/testing.md');
    expect(plan?.ctx.layout.formPath('decisions')).toBe('.omni-loop/local/tree/plan-repo/adr/README.md');
  });

  it('skips a level whose copy is absent, and one whose path is a file rather than a folder', () => {
    const { ctx } = makeRepo({ files: { '.omni-loop/local/tree/omni-settings/playbook/review.md': 'x', '.omni-loop/local/tree/plan-repo': 'not a folder' } });
    expect(levelCopies({ ctx }).map(({ level }) => level)).toEqual(['omni settings']);
  });
});
