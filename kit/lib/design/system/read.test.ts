// PRD 1559, s1: the DESIGN.md reader — Google's DESIGN.md format (YAML front matter of token
// groups, then prose sections), the closed list of parts under Components, and omni-loop's Reference
// screens section. A file in another shape, or a reference that does not resolve, is named in its
// problems, never thrown.
import { describe, expect, it } from 'vitest';
import { DEFAULT_DESIGN_SYSTEM, designSystemPath } from './path.ts';
import { parseDesignSystem } from './read.ts';

const FIXTURE = `---
name: Quotes
colors:
  blue-600: "#2563eb"
  primary: "{colors.blue-600}"
  on-primary: "#ffffff"
typography:
  body:
    fontFamily: Inter
    fontSize: 14px
rounded:
  md: 6px
spacing:
  sm: 8px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.md}"
---

## Overview

A quoting tool for builders.

## Components

### Button

- **Summary:** the one way to start an action.
- **Variants:** primary, secondary, ghost
- **States:** default, hover, focus-visible, active, disabled, loading
- **Tokens:** {colors.primary}, {colors.on-primary}, {rounded.md}
- **Accessibility:** a visible focus ring; the label says the action.
- **Do:** one primary per screen.
- **Don't:** a button that only navigates.
- **Code:** \`src/ui/Button.tsx\`, \`src/ui/button.css\`

### Badge

- **Summary:** a short status.
- **Variants:** neutral, ok, warn
- **States:** default
- **Tokens:** {colors.primary}
- **Code:** \`src/ui/Badge.tsx\`

## Do's and Don'ts

- Do use semantic tokens.

## Reference screens

- \`quotes-list\` — a list with its empty, loading and error states
- \`quote-form\` — a form
`;

describe('design.system', () => {
  it('reads DESIGN.md when unset, and the path a repository names when set', () => {
    expect(DEFAULT_DESIGN_SYSTEM).toBe('DESIGN.md');
    expect(designSystemPath({})).toBe('DESIGN.md');
    expect(designSystemPath({ system: 'docs/DESIGN.md' })).toBe('docs/DESIGN.md');
  });
});

describe('parseDesignSystem', () => {
  it('reads the token groups, every line of each part, and the reference screens', () => {
    const system = parseDesignSystem(FIXTURE);
    expect(Object.keys(system.tokens)).toEqual(['name', 'colors', 'typography', 'rounded', 'spacing', 'components']);
    expect(system.parts).toEqual([
      {
        name: 'Button',
        summary: 'the one way to start an action.',
        variants: ['primary', 'secondary', 'ghost'],
        states: ['default', 'hover', 'focus-visible', 'active', 'disabled', 'loading'],
        tokens: ['colors.primary', 'colors.on-primary', 'rounded.md'],
        accessibility: 'a visible focus ring; the label says the action.',
        do: ['one primary per screen.'],
        dont: ['a button that only navigates.'],
        code: ['src/ui/Button.tsx', 'src/ui/button.css'],
      },
      { name: 'Badge', summary: 'a short status.', variants: ['neutral', 'ok', 'warn'], states: ['default'], tokens: ['colors.primary'], accessibility: null, do: [], dont: [], code: ['src/ui/Badge.tsx'] },
    ]);
    expect(system.referenceScreens).toEqual([
      { screen: 'quotes-list', note: 'a list with its empty, loading and error states' },
      { screen: 'quote-form', note: 'a form' },
    ]);
    expect(system.unresolved).toEqual([]);
    expect(system.problems).toEqual([]);
  });

  it("reads plain `Label: value` lines, and Do and Don't written as sub-lists", () => {
    const system = parseDesignSystem(
      "---\ncolors:\n  primary: \"#000\"\n---\n\n## Components\n\n### Table\n\nSummary: rows of records\nVariants: —\nStates: default, loading, empty, error\nCode: src/ui/Table.tsx\nDo:\n  - keep the header visible\n  - right-align figures\nDon't:\n  - nest tables\n",
    );
    expect(system.parts).toEqual([
      { name: 'Table', summary: 'rows of records', variants: [], states: ['default', 'loading', 'empty', 'error'], tokens: [], accessibility: null, do: ['keep the header visible', 'right-align figures'], dont: ['nest tables'], code: ['src/ui/Table.tsx'] },
    ]);
    expect(system.problems).toEqual([]);
  });

  it("names a reference that does not resolve, in the front matter and in a part's Tokens, and never throws", () => {
    const system = parseDesignSystem(
      '---\ncolors:\n  primary: "{colors.blue-600}"\ncomponents:\n  card:\n    backgroundColor: "{colors.surface}"\n---\n\n## Components\n\n### Card\n\n- **Tokens:** {colors.primary}, {spacing.lg}\n',
    );
    expect(system.unresolved).toEqual([
      { reference: 'colors.blue-600', where: 'colors.primary' },
      { reference: 'colors.surface', where: 'components.card.backgroundColor' },
      { reference: 'spacing.lg', where: 'part Card' },
    ]);
    expect(system.problems).toEqual([
      'unresolved reference {colors.blue-600} in colors.primary',
      'unresolved reference {colors.surface} in components.card.backgroundColor',
      'unresolved reference {spacing.lg} in part Card',
    ]);
  });

  it('names a file in another shape: no front matter, front matter that does not read, no Components section, an unknown line, a part twice', () => {
    expect(parseDesignSystem('# Our design\n\nSome prose.\n').problems).toEqual(['no front matter of design tokens', 'no Components section: no part is listed']);
    expect(parseDesignSystem('---\ncolors: [a\n---\n\n## Components\n').problems[0]).toMatch(/^front matter does not read: /);
    expect(parseDesignSystem('---\n- a\n- b\n---\n\n## Components\n').problems).toEqual(['front matter is not a map of token groups']);
    const odd = parseDesignSystem('---\ncolors: {}\n---\n\n## Components\n\n### Chip\n\n- **Colour:** red\n- **Summary:** a tag\n\n### Chip\n\n- **Summary:** again\n');
    expect(odd.parts.map((part) => part.summary)).toEqual(['a tag']);
    expect(odd.problems).toEqual(['part Chip: unknown line "Colour"', 'part Chip is listed twice: the second is skipped']);
  });

  it('reads no heading inside a code fence as a section or a part', () => {
    const system = parseDesignSystem('---\ncolors: {}\n---\n\n## Components\n\n### Card\n\n- **Summary:** a box\n\n```md\n### Fake\n## Reference screens\n- nope\n```\n');
    expect(system.parts.map((part) => part.name)).toEqual(['Card']);
    expect(system.referenceScreens).toEqual([]);
    expect(system.problems).toEqual([]);
  });

  it('reads no reference screens when the section is absent, and a plain `name: note` line when present', () => {
    expect(parseDesignSystem('---\ncolors: {}\n---\n\n## Components\n').referenceScreens).toEqual([]);
    const system = parseDesignSystem('---\ncolors: {}\n---\n\n## Components\n\n## Reference screens\n\n- app-shell: the shell every page sits in\n- quotes-list\n');
    expect(system.referenceScreens).toEqual([
      { screen: 'app-shell', note: 'the shell every page sits in' },
      { screen: 'quotes-list', note: null },
    ]);
    expect(system.problems).toEqual([]);
  });
});
