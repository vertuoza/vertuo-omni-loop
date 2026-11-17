import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// PRD omni-loop-10, s3: the PRD page is built from @omni/ui. stylelint reads the stylesheets and not the
// markup, so this reads the page's components: no inline `style` is left, and each of the ten parts is used.

const DIR = new URL('./', import.meta.url);
const SOURCES = readdirSync(DIR).filter((name) => name.endsWith('.tsx')).map((name) => ({ name, text: readFileSync(new URL(name, DIR), 'utf8') }));
const PARTS = ['Badge', 'Button', 'Card', 'EmptyState', 'ListRow', 'Notice', 'PageHeader', 'Stack', 'Tabs', 'Text'];

describe('the PRD page and @omni/ui (omni-loop-10 s3)', () => {
  it('has no inline style attribute in a component of the page', () => {
    expect(SOURCES.length).toBeGreaterThan(20);
    const inline = SOURCES.filter(({ text }) => /\bstyle=\{/.test(text) || /\bstyle="/.test(text)).map(({ name }) => name);
    expect(inline).toEqual([]);
  });

  it('imports each of the ten parts from @omni/ui', () => {
    const imported = new Set(SOURCES.flatMap(({ text }) => [...text.matchAll(/import \{([^}]+)\} from '@omni\/ui'/g)].flatMap((m) => (m[1] ?? '').split(',').map((part) => part.trim()))));
    expect(PARTS.filter((part) => !imported.has(part))).toEqual([]);
  });
});
