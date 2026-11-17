// The raw-value lint (PRD omni-loop-10): stylelint.config.mjs refuses a raw font size, space, radius,
// shadow or colour, accepts a token read, and the design parts' stylesheets pass it.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const configFile = `${root}stylelint.config.mjs`;

async function warnings(css: string): Promise<string[]> {
  const { results } = await stylelint.lint({ code: css, configFile });
  return results.flatMap((result) => result.warnings.map((warning) => warning.rule));
}

describe('stylelint.config.mjs', () => {
  it.each([
    'font-size: 14px',
    'padding: 8px',
    'padding: var(--space-2) 12px',
    'margin-top: 4px',
    'gap: 1rem',
    'border-radius: 4px',
    'box-shadow: 0 1px 3px rgb(0 0 0 / 0.2)',
    'color: #fff',
    'background: rgb(1 2 3)',
    'border-color: red',
  ])('refuses %s', async (declaration) => {
    expect((await warnings(`.a { ${declaration}; }`)).length).toBeGreaterThan(0);
  });

  it.each([
    'font-size: var(--type-3-size)',
    'padding: var(--space-2) var(--space-4)',
    'padding: 0',
    'margin: 0 auto',
    'gap: var(--space-1)',
    'border-radius: var(--radius-2)',
    'border-radius: 50%',
    'box-shadow: var(--elevation-raised)',
    'box-shadow: none',
    'color: var(--color-text-primary)',
    'background: transparent',
    'border: 1px solid var(--color-border-subtle)',
    'outline: 2px solid var(--color-accent)',
  ])('accepts %s', async (declaration) => {
    expect(await warnings(`.a { ${declaration}; }`)).toEqual([]);
  });

  it('passes every stylesheet of @omni/ui', async () => {
    const dir = new URL('../packages/ui/src/', import.meta.url);
    for (const name of readdirSync(dir).filter((file) => file.endsWith('.css'))) {
      expect(await warnings(readFileSync(new URL(name, dir), 'utf8')), name).toEqual([]);
    }
  });
});
