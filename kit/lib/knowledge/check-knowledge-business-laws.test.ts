// PRD 2632, s1: `omni check knowledge` grades the business laws — the id and its code, a number used
// once, a statement, a `Why:` — under any `laws.source`, `none` included, and refuses one while
// `laws.owners` names nobody. Kept apart from check-knowledge.test.ts, which holds a rule's proof.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { flatCtx } from '../../test/flat-layout.ts';
import { gradeKnowledge } from './check-knowledge.ts';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const PRODUCT_LAYERS = Object.fromEntries(['principles.md', 'rules.md', 'invariants.md'].map((name) => [`docs/knowledge/product/${name}`, '# Product\n']));
const QUOTES = 'docs/knowledge/domains/quotes/business-laws.md';
const PRODUCT = 'docs/knowledge/product/business-laws.md';

/** A knowledge tree with the product's layer files and `files`. */
function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'check-business-laws-'));
  roots.push(root);
  for (const [path, text] of Object.entries({ ...PRODUCT_LAYERS, ...files })) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

type Laws = { source?: string; owners?: string[] };

function grade(root: string, laws: Laws = {}, extra: { copyOf?: string } = {}) {
  const ctx = { ...flatCtx(root, { laws: { source: laws.source ?? 'knowledge', owners: laws.owners ?? ['pm-login'] } }), ...extra } as Parameters<typeof gradeKnowledge>[0]['ctx'];
  return gradeKnowledge({ ctx, files: [], glossaryText: '' }).violations;
}

const LAW = '## BL-QUOTES-1\nA quote can be sent only when its total is above zero.\nWhy: An empty quote loses the customer.\n';

describe('omni check knowledge — business laws (PRD 2632)', () => {
  it('passes a well-formed law in a domain folder that holds nothing else, and one in product/', () => {
    const root = tree({ [QUOTES]: LAW, [PRODUCT]: '## BL-PRODUCT-1\nAmounts show their currency.\nWhy: Two looked alike.\n' });
    expect(grade(root)).toEqual([]);
  });

  it('refuses a law with no Why:, a bad id, a wrong code and a number used twice, under laws.source none too', () => {
    const text = [LAW, '## BL-QUOTES-2\nNo reason.\n', '## BL-QUOTES-1\nAgain.\nWhy: y\n', '## BL-INVOICING-1\nElsewhere.\nWhy: y\n', '## Quote rule\nNo id.\nWhy: y\n'].join('\n');
    for (const source of ['knowledge', 'none']) {
      expect(grade(tree({ [QUOTES]: text }), { source })).toEqual([
        `${QUOTES}: BL-QUOTES-2 — is missing a "Why:" line: a business law says why it exists, and a red shows it.`,
        `${QUOTES}: BL-QUOTES-1 — already used in ${QUOTES}: a business law's number is used once.`,
        `${QUOTES}: BL-INVOICING-1 — names INVOICING, but it sits in the quotes folder: write BL-QUOTES-<n>.`,
        `${QUOTES}: Quote rule — is not a business law id: write BL-QUOTES-<n>.`,
      ]);
    }
  });

  it('refuses a law while laws.owners names nobody, and asks nothing of an imported copy', () => {
    const root = tree({ [QUOTES]: LAW });
    const ownerless = `docs/knowledge: 1 business law, and laws.owners is empty — name the product's PM in laws.owners: only they approve a change to one.`;
    expect(grade(root, { owners: [] })).toEqual([ownerless]);
    expect(grade(root, { source: 'none', owners: [] })).toEqual([ownerless]);
    expect(grade(root, { owners: [] }, { copyOf: 'acme/backend' })).toEqual([]);
  });

  it('still asks a domain folder holding a register for its README and layer files', () => {
    const root = tree({ [QUOTES]: LAW, 'docs/knowledge/domains/quotes/rules.md': '# Quotes\n' });
    expect(grade(root)).toEqual([
      'docs/knowledge/domains/quotes/README.md: quotes — is missing.',
      'docs/knowledge/domains/quotes/principles.md: quotes — is missing.',
      'docs/knowledge/domains/quotes/invariants.md: quotes — is missing.',
    ]);
  });
});
