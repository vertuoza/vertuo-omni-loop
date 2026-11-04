// `omni kb owners` on the business laws (PRD 2632, s3): it writes each `business-laws.md` into the
// CODEOWNERS block, under any `laws.source`, so a change to one asks the product's PM.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flatCtx } from '../test/flat-layout.ts';
import { ownersOf, parseCodeowners } from './codeowners.ts';
import { ownersBlockProblems, writeOwnersBlock, type OwnersCtx } from './codeowners-laws.ts';

const QUOTES = 'docs/knowledge/domains/quotes/business-laws.md';
const PRODUCT = 'docs/knowledge/product/business-laws.md';
const COPY = 'docs/knowledge/repos/backend/domains/quotes/business-laws.md';
const LAW = '## BL-QUOTES-1\nA quote can be sent only when its total is above zero.\nWhy: An empty quote loses the customer.\n';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'codeowners-laws-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function seed(path: string, text: string) {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), text);
}

const ctxOf = (source: string, owners: string[] = ['pm-login']) => flatCtx(root, { laws: { source, owners } }) as unknown as OwnersCtx;
const codeowners = () => readFileSync(join(root, '.github/CODEOWNERS'), 'utf8');

describe('omni kb owners — the business laws (PRD 2632)', () => {
  it('writes the product file and each domain file, owned by laws.owners, under laws.source none', () => {
    seed(COPY, LAW);
    const without = writeOwnersBlock(ctxOf('none')).paths;
    seed(PRODUCT, LAW.replace('BL-QUOTES-1', 'BL-PRODUCT-1'));
    seed(QUOTES, LAW);
    expect(writeOwnersBlock(ctxOf('none'))).toEqual({ file: '.github/CODEOWNERS', wrote: true, paths: without + 2 });
    expect(codeowners()).toContain(
      ["# The business laws: the product's rules, changed only with their owner's approval.", `/${PRODUCT} @pm-login`, `/${QUOTES} @pm-login`].join('\n'),
    );
    const rules = parseCodeowners(codeowners());
    expect(ownersOf({ rules }, QUOTES)).toEqual(['@pm-login']);
    expect(ownersOf({ rules }, COPY)).toEqual([]);
  });

  it('writes them after the registers, under laws.source knowledge too', () => {
    seed('docs/knowledge/domains/quotes/rules.md', '## BR-QUOTES-1\n\nA rule.\n\nEnforced by: unenforced\n');
    seed(QUOTES, LAW);
    writeOwnersBlock(ctxOf('knowledge'));
    const text = codeowners();
    expect(text.indexOf('/docs/knowledge/domains/quotes/rules.md')).toBeLessThan(text.indexOf(`/${QUOTES}`));
    expect(text).toContain(`/${QUOTES} @pm-login`);
  });

  it('a block written before a business law existed is out of date once one does, and fresh once rewritten', () => {
    writeOwnersBlock(ctxOf('none'));
    expect(ownersBlockProblems(ctxOf('none'))).toEqual([]);
    seed(QUOTES, LAW);
    expect(ownersBlockProblems(ctxOf('none'))).toEqual([
      '.github/CODEOWNERS: its "# BEGIN omni kb owners" block is out of date with the locked laws and laws.owners — run omni kb owners.',
    ]);
    writeOwnersBlock(ctxOf('none'));
    expect(ownersBlockProblems(ctxOf('none'))).toEqual([]);
  });

  it('asks for no block of a repository whose only laws are business laws: the gate falls back to laws.owners', () => {
    seed(QUOTES, LAW);
    expect(ownersBlockProblems(ctxOf('none'))).toEqual([]);
  });
});
