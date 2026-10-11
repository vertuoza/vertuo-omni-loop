// PRD 1369: the base `omni design touched` diffs against when none is given.
import { describe, expect, it } from 'vitest';
import { defaultDesignBase } from './base.ts';

const config = {
  repo: { remote: 'origin', defaultBranch: 'main' },
  branches: { feature: 'feat/{topic}', slice: 'feat/{topic}--{slice}' },
};

describe('defaultDesignBase', () => {
  it("is the remote feature branch on a slice branch", () => {
    expect(defaultDesignBase('feat/design-craft--s2', config)).toBe('origin/feat/design-craft');
  });

  it('is the remote default branch on a feature branch, any other branch, or a detached head', () => {
    expect(defaultDesignBase('feat/design-craft', config)).toBe('origin/main');
    expect(defaultDesignBase('fix/typo', config)).toBe('origin/main');
    expect(defaultDesignBase(null, config)).toBe('origin/main');
  });

  it('reads the templates the config sets', () => {
    const custom = { repo: { remote: 'up', defaultBranch: 'trunk' }, branches: { feature: 'prd/{topic}', slice: 'prd/{topic}/{slice}' } };
    expect(defaultDesignBase('prd/shop/s1', custom)).toBe('up/prd/shop');
    expect(defaultDesignBase('prd/shop', custom)).toBe('up/trunk');
  });
});
