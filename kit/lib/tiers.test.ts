// PRD 1934, s1: `resolveTier` — the model and effort a slice's advised tier runs on, or `inherit`.
import { describe, expect, it } from 'vitest';
import { parseConfig } from './config.ts';
import { INHERIT, isTier, resolveTier } from './tiers.ts';

const MAPPED = parseConfig(
  'kit: 1\nagents: [claude, codex]\ntiers:\n  claude:\n    deep: { model: opus, effort: high }\n    light: { model: haiku }\n  codex: {}\n',
);

describe('resolveTier', () => {
  it('answers the model and the effort of a mapped tier', () => {
    expect(resolveTier(MAPPED, 'claude', 'deep')).toEqual({ model: 'opus', effort: 'high' });
  });

  it('answers the model alone when the tier sets no effort', () => {
    expect(resolveTier(MAPPED, 'claude', 'light')).toEqual({ model: 'haiku' });
  });

  it('inherits when the agent has no row', () => {
    expect(resolveTier(MAPPED, 'gemini', 'deep')).toBe(INHERIT);
  });

  it('inherits when the row has no entry for the tier', () => {
    expect(resolveTier(MAPPED, 'claude', 'build')).toBe(INHERIT);
    expect(resolveTier(MAPPED, 'codex', 'build')).toBe(INHERIT);
  });

  it('inherits when the config has no tiers at all', () => {
    expect(resolveTier(parseConfig('kit: 1\n'), 'claude', 'build')).toBe(INHERIT);
  });

  it('inherits when the plan advises no tier', () => {
    expect(resolveTier(MAPPED, 'claude', null)).toBe(INHERIT);
  });
});

describe('isTier', () => {
  it('knows the three tiers, and nothing else', () => {
    expect(['deep', 'build', 'light'].every(isTier)).toBe(true);
    expect(['fast', '', 'Deep', 'huge'].some(isTier)).toBe(false);
  });
});
