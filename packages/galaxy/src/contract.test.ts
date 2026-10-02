// index.d.ts is what the arcade type-checks against; the sources are what it runs. The compiler holds
// them together here: each source export must fit the declaration that stands for it, so a changed
// signature fails `pnpm typecheck` instead of drifting quietly.
import { describe, it, expect } from 'vitest';
import type * as Contract from './index.d.ts';
import * as source from './index.ts';

const fits = {
  buildGalaxy: source.buildGalaxy,
  demoEvents: source.demoEvents,
  demoSnapshot: source.demoSnapshot,
  DEMO_PROJECTS: source.DEMO_PROJECTS,
  lookOf: source.lookOf,
  WOUND_LABEL: source.WOUND_LABEL,
  STATE_LABEL: source.STATE_LABEL,
  XP_RULES: source.XP_RULES,
  experience: source.experience,
  levelFor: source.levelFor,
  xpForLevel: source.xpForLevel,
  unlockedFor: source.unlockedFor,
  playerXp: source.playerXp,
  borrowedXp: source.borrowedXp,
} satisfies { [K in keyof typeof Contract]: (typeof Contract)[K] };

describe('the package contract', () => {
  it('declares every export the sources make, and no other', () => {
    expect(Object.keys(fits).sort()).toEqual(Object.keys(source).sort());
  });
});
