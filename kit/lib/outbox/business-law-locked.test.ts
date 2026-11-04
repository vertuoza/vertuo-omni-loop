// `law-locked` on a business law (PRD 2632, s3): only a CODEOWNER of its file clears a change to one,
// under any `laws.source`. Kept apart from decision-coverage.test.ts, whose cases on the registers stand
// unchanged.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Context } from '../context.ts';
import { flatCtx as untypedFlatCtx } from '../../test/flat-layout.ts';
import { memorySource } from '../knowledge/registers.ts';
import { businessLawFiles, lawsAwaitingOwners, lockedLawChanges } from './decision-coverage.ts';

const flatCtx = (root: string, overrides: Record<string, unknown> = {}): Context =>
  untypedFlatCtx(root, overrides) as unknown as Context;

const QUOTES = 'docs/knowledge/domains/quotes/business-laws.md';
const PRODUCT = 'docs/knowledge/product/business-laws.md';
const COPY = 'docs/knowledge/repos/backend/domains/quotes/business-laws.md';

const change = (path: string, status = 'M') => ({ path, status });

/** One business law: its heading, statement, `Why:` and any more lines. */
function law(id: string, statement: string, ...lines: string[]): string {
  return [`## ${id}`, statement, 'Why: A customer who receives an empty quote stops trusting the contractor.', ...lines, ''].join('\n');
}

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'business-law-locked-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function seed(path: string, text: string) {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), text);
}

/** The firings, as `law path status rule`, over `changes` against a base holding `base`, under `source`. */
function firedOver(base: Record<string, string> | null, changes: { path: string; status: string }[], source = 'none') {
  const ctx = flatCtx(root, { laws: { source, owners: ['pm-login'] } });
  return lockedLawChanges(changes, { ctx, base: base === null ? null : memorySource(base) }).map((one) => `${one.law} ${one.path} ${one.status} ${one.rule}`);
}

describe('lockedLawChanges — a business law (PRD 2632)', () => {
  const SENT = 'A quote can be sent only when its total including tax is above zero.';

  it('fires on a law added, under laws.source none and knowledge alike', () => {
    seed(QUOTES, law('BL-QUOTES-1', SENT));
    for (const source of ['none', 'knowledge', 'claudeMdInvariants']) {
      expect(firedOver({}, [change(QUOTES, 'A')], source)).toEqual([`BL-QUOTES-1 ${QUOTES} A law-locked`]);
    }
  });

  it('fires on a law changed: its statement, its Why: or its Also:', () => {
    seed(QUOTES, law('BL-QUOTES-1', 'A quote can be sent only when its total is above zero.'));
    expect(firedOver({ [QUOTES]: law('BL-QUOTES-1', SENT) }, [change(QUOTES)])).toEqual([`BL-QUOTES-1 ${QUOTES} M law-locked`]);
    seed(QUOTES, law('BL-QUOTES-1', SENT, 'Also: invoicing'));
    expect(firedOver({ [QUOTES]: law('BL-QUOTES-1', SENT) }, [change(QUOTES)])).toEqual([`BL-QUOTES-1 ${QUOTES} M law-locked`]);
  });

  it('fires on a law removed, and on its whole file deleted', () => {
    seed(QUOTES, law('BL-QUOTES-2', 'Another.'));
    const both = law('BL-QUOTES-1', SENT) + law('BL-QUOTES-2', 'Another.');
    expect(firedOver({ [QUOTES]: both }, [change(QUOTES)])).toEqual([`BL-QUOTES-1 ${QUOTES} M law-locked`]);
    rmSync(join(root, QUOTES));
    expect(firedOver({ [QUOTES]: both }, [change(QUOTES, 'D')])).toEqual([`BL-QUOTES-1 ${QUOTES} D law-locked`, `BL-QUOTES-2 ${QUOTES} D law-locked`]);
  });

  it('fires on a product law as on a domain law, each law named once per file', () => {
    seed(PRODUCT, law('BL-PRODUCT-1', 'Every amount shows its currency.') + law('BL-PRODUCT-2', 'New.'));
    expect(firedOver({ [PRODUCT]: law('BL-PRODUCT-1', 'Amounts show a currency.') }, [change(PRODUCT)])).toEqual([
      `BL-PRODUCT-1 ${PRODUCT} M law-locked`,
      `BL-PRODUCT-2 ${PRODUCT} M law-locked`,
    ]);
  });

  it('a law moved to another domain file fires on both files', () => {
    const INVOICING = 'docs/knowledge/domains/invoicing/business-laws.md';
    seed(QUOTES, '');
    seed(INVOICING, law('BL-QUOTES-1', SENT));
    expect(firedOver({ [QUOTES]: law('BL-QUOTES-1', SENT) }, [change(QUOTES), change(INVOICING, 'A')])).toEqual([
      `BL-QUOTES-1 ${QUOTES} M law-locked`,
      `BL-QUOTES-1 ${INVOICING} A law-locked`,
    ]);
  });

  it('never fires on a law left alone: a prose change around it, or only the base moved on', () => {
    seed(QUOTES, `# Quotes\n\nThe rules of a quote.\n\n${law('BL-QUOTES-1', SENT)}`);
    expect(firedOver({ [QUOTES]: law('BL-QUOTES-1', SENT) }, [change(QUOTES)])).toEqual([]);
    expect(firedOver({ [QUOTES]: law('BL-QUOTES-1', 'The base reworded it.') }, [change('src/quote.ts')])).toEqual([]);
  });

  it('never fires on an imported copy under repos/, nor on another file named business-laws.md', () => {
    seed(COPY, law('BL-QUOTES-1', SENT));
    seed('docs/business-laws.md', law('BL-QUOTES-1', SENT));
    expect(firedOver({}, [change(COPY, 'A'), change('docs/business-laws.md', 'A')])).toEqual([]);
  });

  it('without a base, a business law fires nothing: there is nothing to compare it with', () => {
    seed(QUOTES, law('BL-QUOTES-1', SENT));
    expect(firedOver(null, [change(QUOTES, 'A')])).toEqual([]);
  });

  it('a register law still fires only under laws.source knowledge, beside a business law', () => {
    const INVARIANTS = 'docs/knowledge/product/invariants.md';
    const locked = ['## N1', '', 'A law.', '', 'Enforced by: unenforced', 'Locked: @ann, 2026-10-12', ''].join('\n');
    seed(INVARIANTS, locked);
    seed(QUOTES, law('BL-QUOTES-1', SENT));
    const changes = [change(INVARIANTS), change(QUOTES, 'A')];
    expect(firedOver({ [INVARIANTS]: '' }, changes, 'knowledge')).toEqual([`N1 ${INVARIANTS} M law-locked`, `BL-QUOTES-1 ${QUOTES} A law-locked`]);
    expect(firedOver({ [INVARIANTS]: '' }, changes, 'none')).toEqual([`BL-QUOTES-1 ${QUOTES} A law-locked`]);
  });
});

describe('businessLawFiles — the business-law files a range changed', () => {
  it('names the product file and each domain file, never a copy or a look-alike', () => {
    const ctx = flatCtx(root, { laws: { source: 'none' } });
    const changes = [change(QUOTES, 'D'), change(PRODUCT), change(COPY), change('docs/knowledge/domains/quotes/rules.md'), change('src/business-laws.md')];
    expect(businessLawFiles(changes, { ctx })).toEqual([QUOTES, PRODUCT]);
  });
});

describe('lawsAwaitingOwners — a business law (PRD 2632)', () => {
  const fired = [{ law: 'BL-QUOTES-1', path: QUOTES, status: 'M', rule: 'law-locked' }];
  const ownersOf = (path: string) => (path === QUOTES ? ['@pm-login'] : []);

  it('waits for its file’s CODEOWNER, and her approval alone clears it', () => {
    expect(lawsAwaitingOwners(fired, { ownersOf, approvers: ['dev'] }).awaiting).toEqual([
      { law: 'BL-QUOTES-1', reason: 'no-approval', paths: [QUOTES], owners: ['@pm-login'] },
    ]);
    expect(lawsAwaitingOwners(fired, { ownersOf, approvers: ['dev', 'PM-login'] })).toEqual({ awaiting: [], approvedBy: ['PM-login'] });
  });

  it('a file no CODEOWNERS line names falls back to laws.owners, and fails closed without them', () => {
    expect(lawsAwaitingOwners(fired, { ownersOf: () => [], approvers: ['pm-login'], lawOwners: ['pm-login'] }).awaiting).toEqual([]);
    expect(lawsAwaitingOwners(fired, { ownersOf: () => [], approvers: ['pm-login'] }).awaiting).toEqual([
      { law: 'BL-QUOTES-1', reason: 'no-codeowner', paths: [QUOTES], owners: [] },
    ]);
  });
});
