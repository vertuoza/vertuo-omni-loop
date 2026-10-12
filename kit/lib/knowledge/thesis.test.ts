// PRD 1726, s2: the thesis's laws section, read and graded against the locks.
import { describe, expect, it } from 'vitest';
import { parseThesis, thesisProblems } from './thesis.ts';
import type { KnowledgeEntry } from './registers.ts';

const FILE = 'k/product/thesis.md';
const entry = (id: string, kind: KnowledgeEntry['kind'], locked: boolean) =>
  ({ id, kind, locked: locked ? { by: 'p', on: '2026-10-14' } : null }) as KnowledgeEntry;

describe('parseThesis', () => {
  it('reads each line of "The laws" that names an id, up to the next section', () => {
    const text = '# T\n\n## The Laws\n\nA law is a promise.\n- BR-PRODUCT-1 — One. If broken: x.\n* `N-QUOTE-2` – Two.\nN3 - three\n\n## What it refuses\n\n- BR-PRODUCT-9 — not a law line.\n';
    expect(parseThesis(FILE, text)).toEqual({
      file: FILE,
      lawsSection: 'A law is a promise.\n- BR-PRODUCT-1 — One. If broken: x.\n* `N-QUOTE-2` – Two.\nN3 - three',
      laws: [
        { id: 'BR-PRODUCT-1', sentence: 'One. If broken: x.', line: '- BR-PRODUCT-1 — One. If broken: x.' },
        { id: 'N-QUOTE-2', sentence: 'Two.', line: '* `N-QUOTE-2` – Two.' },
        { id: 'N3', sentence: 'three', line: 'N3 - three' },
      ],
    });
  });

  it('has no laws section when the heading is missing, and reads to the end without a next section', () => {
    expect(parseThesis(FILE, '# T\n')).toEqual({ file: FILE, lawsSection: null, laws: [] });
    expect(parseThesis(FILE, '## The laws\n- N2 — Two. If broken: y.').laws).toEqual([{ id: 'N2', sentence: 'Two. If broken: y.', line: '- N2 — Two. If broken: y.' }]);
  });
});

describe('thesisProblems', () => {
  const thesis = parseThesis(FILE, '## The laws\n- BR-A-1 — One. If broken: x.\n');

  it('asks nothing while no law is locked, whatever the thesis', () => {
    expect(thesisProblems(null, [entry('BR-A-1', 'rule', false)], FILE)).toEqual([]);
    expect(thesisProblems(parseThesis(FILE, '# T\n'), [], FILE)).toEqual([]);
  });

  it('counts a locked principle as no law', () => {
    expect(thesisProblems(null, [entry('P-A-1', 'principle', true)], FILE)).toEqual([]);
  });

  it('is quiet when the laws section and the locks agree', () => {
    expect(thesisProblems(thesis, [entry('BR-A-1', 'rule', true)], FILE)).toEqual([]);
  });

  it('names two locked laws a missing thesis leaves out, together', () => {
    expect(thesisProblems(null, [entry('BR-A-1', 'rule', true), entry('N-A-1', 'invariant', true)], FILE)).toEqual([
      `${FILE}: is missing, and BR-A-1, N-A-1 are locked — write the thesis, with one line per law in its "## The laws" section.`,
    ]);
  });
});
