import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { KINDS } from '../data/knowledge';
import { contrast, TOKENS } from '../ask/theme-tokens';
import { KIND_GROUNDS, KIND_TOKEN, kindCss } from './kinds';

// Each kind's colour on the diagram and in the index: a dot, a ring, a chip. Non-text marks, so
// WCAG 1.4.11 asks 3:1 against what they sit on, in both themes.

describe('the kind colours', () => {
  it('give each kind its own colour', () => {
    expect(new Set(KINDS.map((kind) => KIND_TOKEN[kind])).size).toBe(KINDS.length);
  });

  it('hold at least 3:1 against the ground, and every surface a dot sits on, in the light and the dark theme', () => {
    const failures: string[] = [];
    for (const theme of ['light', 'dark'] as const) {
      for (const kind of KINDS) {
        for (const on of KIND_GROUNDS) {
          const ratio = contrast(TOKENS[theme][KIND_TOKEN[kind]], TOKENS[theme][on]);
          if (ratio < 3) failures.push(`${theme}: ${kind} (${KIND_TOKEN[kind]}) on ${on} is ${ratio.toFixed(2)}:1`);
        }
      }
    }
    expect(KIND_GROUNDS).toContain('ground');
    expect(failures).toEqual([]);
  });

  it('reach the page as one custom property per kind, naming the theme token', () => {
    const css = kindCss();
    expect(css).toContain(`[data-kind="principle"] { --km-kind: var(--ask-plasma); }`);
    for (const kind of KINDS) expect(css).toContain(`[data-kind="${kind}"] { --km-kind: var(--ask-`);
  });
});

describe('the knowledge stylesheet', () => {
  const css = readFileSync(new URL('./knowledge.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('names no colour of its own: every colour comes from the theme tokens', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i);
  });

  it('keeps the pixel face out of the page', () => {
    expect(css).not.toContain('var(--ask-px)');
  });
});
