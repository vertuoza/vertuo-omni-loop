// PRD 2416, s4: product knowledge read top-down through the tree, and a lower level's contradiction.
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { PRODUCT_LEVELS, findContradictions, productEntries } from './product.ts';

const REPO = '.omni-loop/knowledge';
const PLAN = '.omni-loop/local/tree/plan-repo';
const SETTINGS = '.omni-loop/local/tree/omni-settings';

/** A rules file holding one `BR-PRODUCT-<n>` per statement, numbered from 1. */
function rules(...statements: string[]): string {
  return ['# Product rules', '', ...statements.flatMap((statement, index) => [`## BR-PRODUCT-${index + 1}`, '', statement, '', 'Serves: P-PRODUCT-1', ''])].join('\n');
}

/** One knowledge folder's rules file, at `folder`. */
const at = (folder: string, text: string) => ({ [`${folder}/product/rules.md`]: text });

const lines = (repoFiles: Record<string, string>) => {
  const { ctx } = makeRepo({ files: repoFiles });
  return productEntries({ ctx }).map(({ level, entry }) => `${level}: ${entry.id} ${entry.statement} (${entry.file})`);
};

describe('the product side’s levels', () => {
  it('reads them top-down: the Omni settings, then the plan repository, then the repository', () => {
    expect(PRODUCT_LEVELS).toEqual(['omni settings', 'plan repo', 'repo']);
  });
});

describe('productEntries — every level’s register entries, the highest first', () => {
  it('reads only the repository’s own entries when no other level is there, exactly as the parser does', () => {
    expect(lines(at(REPO, rules('A widget is blue.')))).toEqual([`repo: BR-PRODUCT-1 A widget is blue. (${REPO}/product/rules.md)`]);
  });

  it('reads nothing, and no error, from a repository with no knowledge at any level', () => {
    expect(lines({ 'README.md': 'x' })).toEqual([]);
  });

  it('applies every level’s entries, the Omni settings’ first, each named with its level', () => {
    const files = { ...at(REPO, rules('A widget is blue.')), ...at(PLAN, rules('A widget is named.')), ...at(SETTINGS, rules('A widget is kept.')) };
    expect(lines(files)).toEqual([
      `omni settings: BR-PRODUCT-1 A widget is kept. (${SETTINGS}/product/rules.md)`,
      `plan repo: BR-PRODUCT-1 A widget is named. (${PLAN}/product/rules.md)`,
      `repo: BR-PRODUCT-1 A widget is blue. (${REPO}/product/rules.md)`,
    ]);
  });

  it('skips a level whose copy is absent, or holds only a playbook', () => {
    const files = { ...at(REPO, rules('A widget is blue.')), [`${SETTINGS}/playbook/testing.md`]: '# Testing\n' };
    expect(lines(files)).toEqual([`repo: BR-PRODUCT-1 A widget is blue. (${REPO}/product/rules.md)`]);
  });
});

describe('findContradictions — a lower level may add to a higher one, never change it', () => {
  const contradictions = (repoFiles: Record<string, string>) => {
    const { ctx } = makeRepo({ files: repoFiles });
    return findContradictions(productEntries({ ctx })).map(({ lower, higher }) => `${lower.level} ${lower.entry.id} × ${higher.level} ${higher.entry.id}`);
  };

  it('finds none in a repository with no other level', () => {
    expect(contradictions(at(REPO, rules('A widget is blue.', 'A widget is named.')))).toEqual([]);
  });

  it('finds none when a lower level only adds entries of its own', () => {
    const files = { ...at(REPO, rules('A widget is kept.', 'A widget is blue.')), ...at(PLAN, rules('A widget is kept.')) };
    expect(contradictions(files)).toEqual([]);
  });

  it('finds none when a lower level restates a higher entry, its spacing aside', () => {
    const files = { ...at(REPO, rules('A widget   is\nkept.')), ...at(SETTINGS, rules('A widget is kept.')) };
    expect(contradictions(files)).toEqual([]);
  });

  it('finds the repository’s entry that says otherwise than its plan repository’s, under the same id', () => {
    const files = { ...at(REPO, rules('A widget is red.')), ...at(PLAN, rules('A widget is blue.')) };
    expect(contradictions(files)).toEqual(['repo BR-PRODUCT-1 × plan repo BR-PRODUCT-1']);
  });

  it('finds the repository’s entry that says otherwise than the Omni settings’', () => {
    const files = { ...at(REPO, rules('A widget is red.')), ...at(SETTINGS, rules('A widget is blue.')) };
    expect(contradictions(files)).toEqual(['repo BR-PRODUCT-1 × omni settings BR-PRODUCT-1']);
  });

  it('finds the plan repository’s entry that says otherwise than the Omni settings’, and names each pair once', () => {
    const files = { ...at(REPO, rules('A widget is red.')), ...at(PLAN, rules('A widget is green.')), ...at(SETTINGS, rules('A widget is blue.')) };
    expect(contradictions(files)).toEqual([
      'plan repo BR-PRODUCT-1 × omni settings BR-PRODUCT-1',
      'repo BR-PRODUCT-1 × omni settings BR-PRODUCT-1',
      'repo BR-PRODUCT-1 × plan repo BR-PRODUCT-1',
    ]);
  });

  it('finds an entry that keeps the id but changes its kind', () => {
    const cross = (kind: string) => ['# Widgets and gears', '', '## X-GEARS-WIDGETS-1', '', 'A gear turns a widget.', '', `Kind: ${kind}`, ''].join('\n');
    const files = { [`${REPO}/cross-domain/gears--widgets.md`]: cross('rule'), [`${PLAN}/cross-domain/gears--widgets.md`]: cross('invariant') };
    expect(contradictions(files)).toEqual(['repo X-GEARS-WIDGETS-1 × plan repo X-GEARS-WIDGETS-1']);
  });

  it('never compares two entries of the same level: an id reused inside one folder is the id check’s', () => {
    const files = { ...at(REPO, rules('A widget is red.')), [`${REPO}/domains/widgets/rules.md`]: '# Rules\n\n## BR-PRODUCT-1\n\nA widget is blue.\n' };
    expect(contradictions(files)).toEqual([]);
  });
});
