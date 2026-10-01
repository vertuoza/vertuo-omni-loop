import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import type { Context } from '../context.ts';
import { flatCtx as untypedFlatCtx } from '../../test/flat-layout.ts';

/** The flat test layout's context, typed as the kit's own (it carries every field the code reads). */
const flatCtx = (root: string, overrides: Record<string, unknown> = {}): Context =>
  untypedFlatCtx(root, overrides) as unknown as Context;
import { riskyChanges } from './decision-coverage.ts';

function change(path: string, status = 'M') {
  return { path, status };
}

const INVARIANTS = 'docs/knowledge/product/invariants.md';

/** The two repository-specific risk patterns upstream hard-coded — reproduced here as config, per
 * the task's own Step 3, so the ported cases below hold unchanged. */
const RISK = {
  storedShape: ['^libs/[^/]+/src/server/migrations\\.ts$'],
  sharedContract: ['libs/system-api-contract/'],
};

let root: string;
let ctx: Context;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'decision-coverage-'));
  ctx = flatCtx(root, { risk: RISK });
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Writes `text` at `path` under `root`, creating its directory. */
function seed(path: string, text: string) {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), text);
}

/** A minimal product invariants file naming `enforcedByPath` as the proof of `N9`. */
function seedInvariants(enforcedByPath: string) {
  seed(
    INVARIANTS,
    ['## N9', '', 'A fixture invariant.', '', `Enforced by: ${enforcedByPath}`, ''].join('\n'),
  );
}

/** `riskyChanges` for one change, as the list of rule ids that fired on it. */
function rulesFiredOn(path: string, status = 'M') {
  return riskyChanges([change(path, status)], { ctx }).map((entry) => entry.rule);
}

describe('riskyChanges — stored-shape', () => {
  it('fires on a library migrations file', () => {
    expect(rulesFiredOn('libs/vertuo-ai-credit/src/server/migrations.ts')).toEqual([
      'stored-shape',
    ]);
  });

  it('does not fire on an ordinary server file in the same library', () => {
    expect(rulesFiredOn('libs/vertuo-ai-credit/src/server/credit.repository.ts')).toEqual([]);
  });
});

describe('riskyChanges — law-text', () => {
  it('fires on an ADR', () => {
    expect(rulesFiredOn('docs/adr/0069-example.md')).toEqual(['law-text']);
  });

  it("Scenario: the law's text is still risky ground — a domain's rules file", () => {
    expect(rulesFiredOn('docs/knowledge/domains/advisor/rules.md')).toEqual(['law-text']);
  });

  it("fires on a domain's principles and invariants, the product's files, and a cross-domain pair", () => {
    for (const path of [
      'docs/knowledge/domains/advisor/principles.md',
      'docs/knowledge/domains/agent-session/invariants.md',
      'docs/knowledge/product/principles.md',
      'docs/knowledge/product/rules.md',
      'docs/knowledge/product/invariants.md',
      'docs/knowledge/cross-domain/advisor--credits.md',
    ]) {
      expect(rulesFiredOn(path)).toEqual(['law-text']);
    }
  });

  it("does not fire on a folder's README, which describes and states no law", () => {
    expect(rulesFiredOn('docs/knowledge/README.md')).toEqual([]);
    expect(rulesFiredOn('docs/knowledge/domains/advisor/README.md')).toEqual([]);
  });

  it("does not fire on the ADR folder's README, the decisions form, while a record beside it still does", () => {
    expect(rulesFiredOn('docs/adr/README.md')).toEqual([]);
    expect(rulesFiredOn('docs/adr/0002-x.md')).toEqual(['law-text']);
  });

  it('does not fire on an unrelated docs file', () => {
    expect(rulesFiredOn('docs/glossary.md')).toEqual([]);
  });
});

describe('riskyChanges — test-removed', () => {
  it('fires on a deleted test file', () => {
    expect(rulesFiredOn('apps/vertuo-ai-api/src/foo.service.test.ts', 'D')).toEqual([
      'test-removed',
    ]);
  });

  it('fires on a deleted .feature file', () => {
    expect(rulesFiredOn('apps/vertuo-ai-api/test/foo.feature', 'D')).toEqual(['test-removed']);
  });

  it('does not fire on the same file merely edited', () => {
    expect(rulesFiredOn('apps/vertuo-ai-api/src/foo.service.test.ts', 'M')).toEqual([]);
  });
});

describe('riskyChanges — shared-contract', () => {
  it('fires on anything under libs/system-api-contract/', () => {
    expect(rulesFiredOn('libs/system-api-contract/src/shared/agent.ts')).toEqual([
      'shared-contract',
    ]);
  });

  it('does not fire on a differently-named sibling library', () => {
    expect(rulesFiredOn('libs/system-api-contract-legacy/src/index.ts')).toEqual([]);
  });
});

describe('riskyChanges — law-proof', () => {
  it('fires on a path named by an Enforced by: line, read from the register at ctx.root', () => {
    seedInvariants('scripts/check-fixture-thing.mjs');
    expect(rulesFiredOn('scripts/check-fixture-thing.mjs')).toEqual(['law-proof']);
  });

  it('does not fire on a path the register never names', () => {
    seedInvariants('scripts/check-fixture-thing.mjs');
    expect(rulesFiredOn('scripts/unrelated.mjs')).toEqual([]);
  });

  it('splits a comma-separated Enforced by: line into several proof paths', () => {
    seed(
      INVARIANTS,
      [
        '## N4',
        '',
        'Three-way separation.',
        '',
        'Enforced by: scripts/check-a.mjs, scripts/check-b.mjs, scripts/check-c.mjs',
        '',
      ].join('\n'),
    );
    expect(rulesFiredOn('scripts/check-b.mjs')).toEqual(['law-proof']);
  });

  it('never treats the literal "unenforced" as a path', () => {
    seed(
      INVARIANTS,
      ['## N2', '', 'Nothing enforces this yet.', '', 'Enforced by: unenforced', ''].join('\n'),
    );
    expect(rulesFiredOn('unenforced')).toEqual([]);
  });

  it('the rules grow with the register: adding an Enforced by: entry makes a new path risky with no rule edit', () => {
    // The PRD's anti-rot claim, stated as a test: `law-proof` is derived from `readRegisters()` at
    // call time, so widening the register — not editing this module — is what widens the rule.
    const path = 'scripts/check-newly-enforced.mjs';

    seed(INVARIANTS, ['## N9', '', 'Not yet enforced.', '', 'Enforced by: unenforced', ''].join('\n'));
    expect(rulesFiredOn(path)).toEqual([]);

    // Same file, same root, only the register changed — no edit to decision-coverage.mjs.
    seed(INVARIANTS, ['## N9', '', 'Now enforced.', '', `Enforced by: ${path}`, ''].join('\n'));
    expect(rulesFiredOn(path)).toEqual(['law-proof']);
  });

  it("also reads a domain rule's Enforced by: line", () => {
    seed(
      'docs/knowledge/domains/extraction/rules.md',
      [
        '## BR-EXTRACTION-1',
        '',
        'A fixture business rule.',
        '',
        'Serves: P-PRODUCT-1',
        'Enforced by: apps/vertuo-ai-api/src/quote.controller.test.ts',
        'Stated: 2026-09-22',
        '',
      ].join('\n'),
    );
    expect(rulesFiredOn('apps/vertuo-ai-api/src/quote.controller.test.ts')).toEqual([
      'law-proof',
    ]);
  });

  it("and a cross-domain entry's Enforced by: line", () => {
    seed(
      'docs/knowledge/cross-domain/advisor--credits.md',
      [
        '## X-ADVISOR-CREDITS-1',
        '',
        'A turn is charged before it runs.',
        '',
        'Kind: rule',
        'Serves: P-PRODUCT-1',
        'Enforced by: `libs/vertuo-ai-credit/src/server/credit.service.test.ts`',
        'Stated: 2026-09-24',
        '',
      ].join('\n'),
    );
    expect(rulesFiredOn('libs/vertuo-ai-credit/src/server/credit.service.test.ts')).toEqual([
      'law-proof',
    ]);
  });

  it('never fires when laws.source is not "knowledge", even when the register names the path', () => {
    seedInvariants('scripts/check-fixture-thing.mjs');
    const noLawsCtx = flatCtx(root, { risk: RISK, laws: { source: 'none' } });
    expect(
      riskyChanges([change('scripts/check-fixture-thing.mjs')], { ctx: noLawsCtx }).map(
        (entry) => entry.rule,
      ),
    ).toEqual([]);
  });
});

describe('riskyChanges — a change firing two rules at once', () => {
  it('reports both rules, neither shadowing the other, for a deleted test that is also the proof of a law', () => {
    const path = 'apps/vertuo-ai-api/src/quote.controller.test.ts';
    seedInvariants(path);

    const risky = riskyChanges([change(path, 'D')], { ctx });

    expect(risky).toEqual([
      { path, status: 'D', rule: 'law-proof' },
      { path, status: 'D', rule: 'test-removed' },
    ]);
  });
});

describe('riskyChanges — ordinary work', () => {
  it('fires nothing over a range of ordinary source and tests', () => {
    seedInvariants('scripts/check-fixture-thing.mjs');
    const changes = [
      change('apps/vertuo-ai-api/src/features/offer/quote.service.ts', 'M'),
      change('apps/vertuo-ai-api/src/features/offer/quote.service.test.ts', 'M'),
      change('libs/vertuo-ai-credit/src/server/credit.repository.ts', 'A'),
      change('docs/glossary.md', 'M'),
    ];
    expect(riskyChanges(changes, { ctx })).toEqual([]);
  });
});

describe('riskyChanges — the risky paths are config, not literals (Task 8, Step 4)', () => {
  it('with an empty risk config, an ordinary migrations file fires no rule', () => {
    const { ctx: defaultCtx } = makeRepo();
    expect(
      riskyChanges([change('libs/x/src/server/migrations.ts')], { ctx: defaultCtx }),
    ).toEqual([]);
  });

  it('a deleted test file still fires test-removed with the default folders layout', () => {
    const { ctx: defaultCtx } = makeRepo();
    expect(riskyChanges([change('a.test.mjs', 'D')], { ctx: defaultCtx })).toEqual([
      { path: 'a.test.mjs', status: 'D', rule: 'test-removed' },
    ]);
  });

  it('an edit under the default ADR dir still fires law-text with the default folders layout', () => {
    const { ctx: defaultCtx } = makeRepo();
    const path = '.omni-loop/knowledge/adr/0001-x.md';
    expect(riskyChanges([change(path)], { ctx: defaultCtx })).toEqual([
      { path, status: 'M', rule: 'law-text' },
    ]);
  });

  it("writing the default ADR dir's README, the decisions form, is not law text", () => {
    const { ctx: defaultCtx } = makeRepo();
    expect(riskyChanges([change('.omni-loop/knowledge/adr/README.md', 'A')], { ctx: defaultCtx })).toEqual([]);
    expect(riskyChanges([change('.omni-loop/knowledge/adr/0002-x.md', 'A')], { ctx: defaultCtx })).toEqual([
      { path: '.omni-loop/knowledge/adr/0002-x.md', status: 'A', rule: 'law-text' },
    ]);
  });
});
