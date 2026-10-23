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
import { memorySource } from '../knowledge/registers.ts';
import { gateResult } from './status.ts';
import { parsePrd } from '../ids.ts';
import { enforcedByPaths, LAW_LOCKED, lawsAwaitingOwners, lockedLawChanges, riskyChanges, RULE_IDS } from './decision-coverage.ts';

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
    expect(rulesFiredOn('libs/nimbus-ai-credit/src/server/migrations.ts')).toEqual([
      'stored-shape',
    ]);
  });

  it('does not fire on an ordinary server file in the same library', () => {
    expect(rulesFiredOn('libs/nimbus-ai-credit/src/server/credit.repository.ts')).toEqual([]);
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

describe('riskyChanges — law-text on a domain contract (PRD 1796)', () => {
  it("fires on the product's contracts file and on a domain's", () => {
    expect(rulesFiredOn('docs/knowledge/product/contracts.md')).toEqual(['law-text']);
    expect(rulesFiredOn('docs/knowledge/domains/invoicing/contracts.md', 'A')).toEqual(['law-text']);
    expect(rulesFiredOn('docs/knowledge/domains/invoicing/contracts.md', 'D')).toEqual(['law-text']);
  });

  it('fires on no other contracts file: nested deeper, outside the registers, or a near name', () => {
    for (const path of [
      'docs/knowledge/contracts.md',
      'docs/knowledge/domains/contracts.md',
      'docs/knowledge/domains/invoicing/notes/contracts.md',
      'docs/knowledge/product/contracts.md.bak',
      'docs/knowledge/product/contract.md',
      'docs/knowledge/product/my-contracts.md',
      'docs/contracts.md',
      'src/invoicing/contracts.md',
    ]) {
      expect(rulesFiredOn(path)).toEqual([]);
    }
  });

  it('a change to the file a contract points to fires nothing by itself', () => {
    seed(
      'docs/knowledge/product/contracts.md',
      ['## DC-PRODUCT-1', '', 'An outbox item has exactly one rank.', '', 'Points to: kit/lib/schema/front-matter.ts', 'Source: PRD 1796', 'Stated: 2026-10-15', ''].join('\n'),
    );
    expect(rulesFiredOn('kit/lib/schema/front-matter.ts')).toEqual([]);
    expect(rulesFiredOn('kit/lib/schema/front-matter.ts', 'D')).toEqual([]);
  });

  it('the outbox gate stays red on a contracts change until an item ranked high covers it', () => {
    const CONTRACTS = 'docs/knowledge/product/contracts.md';
    const changes = [change(CONTRACTS)];
    const account = (line: string) => {
      seed(
        'docs/outbox/1796/accounts/s1.md',
        ['---', 'prd: 1796', 'slice: s1', 'graded: 2026-10-15', '---', '', '## Risky changes', '', `- \`${CONTRACTS}\``, 'law-text', line, ''].join('\n'),
      );
    };
    const item = (rank: string) => {
      seed(
        'docs/outbox/1796/s1-01-contract.md',
        [
          '---', 'id: s1-01-contract', 'prd: 1796', 'slice: s1', `rank: ${rank}`, 'bears-on: none', 'raised: 2026-10-15', 'wave: 1', '---', '',
          '## The question, in plain words', '', 'Should this contract read so?', '',
          '## The decision, in plain words', '', 'Yes, as written.', '',
          '## What I had to decide', '', 'x', '', '## What I did meanwhile', '', 'y', '',
          '## What it costs to change later', '', 'z', '', '## What I could not know', '', '(author) w', '',
        ].join('\n'),
      );
    };
    expect(gateResult(parsePrd(1796), { ctx, changes }).unaccounted?.map((one) => one.rule)).toEqual(['law-text']);
    account('spec Solution');
    expect(gateResult(parsePrd(1796), { ctx, changes }).unaccounted?.map((one) => one.rule)).toEqual(['law-text']);
    item('medium');
    account('item s1-01-contract');
    expect(gateResult(parsePrd(1796), { ctx, changes }).unaccounted?.map((one) => one.rule)).toEqual(['law-text']);
    item('high');
    const covered = gateResult(parsePrd(1796), { ctx, changes });
    expect(covered.unaccounted).toEqual([]);
    expect(covered.ok).toBe(false);
  });
});

describe('riskyChanges — test-removed', () => {
  it('fires on a deleted test file', () => {
    expect(rulesFiredOn('apps/nimbus-api/src/foo.service.test.ts', 'D')).toEqual([
      'test-removed',
    ]);
  });

  it('fires on a deleted .feature file', () => {
    expect(rulesFiredOn('apps/nimbus-api/test/foo.feature', 'D')).toEqual(['test-removed']);
  });

  it('does not fire on the same file merely edited', () => {
    expect(rulesFiredOn('apps/nimbus-api/src/foo.service.test.ts', 'M')).toEqual([]);
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
        'Enforced by: apps/nimbus-api/src/quote.controller.test.ts',
        'Stated: 2026-09-22',
        '',
      ].join('\n'),
    );
    expect(rulesFiredOn('apps/nimbus-api/src/quote.controller.test.ts')).toEqual([
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
        'Enforced by: `libs/nimbus-ai-credit/src/server/credit.service.test.ts`',
        'Stated: 2026-09-24',
        '',
      ].join('\n'),
    );
    expect(rulesFiredOn('libs/nimbus-ai-credit/src/server/credit.service.test.ts')).toEqual([
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
    const path = 'apps/nimbus-api/src/quote.controller.test.ts';
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
      change('apps/nimbus-api/src/features/offer/quote.service.ts', 'M'),
      change('apps/nimbus-api/src/features/offer/quote.service.test.ts', 'M'),
      change('libs/nimbus-ai-credit/src/server/credit.repository.ts', 'A'),
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

describe('riskyChanges — briefing-text (PRD 1793)', () => {
  const BRIEFING = '.omni-loop/knowledge/playbook/briefing.md';

  /** The briefing's text: a filled form whose one section's body is `body`, or a pointer form. */
  function briefingText({ body = '- Never merge.', pointsTo = null }: { body?: string; pointsTo?: string | null } = {}) {
    const state = pointsTo === null ? 'filled' : 'pointer';
    return ['---', 'form: briefing', 'form-version: 1', `state: ${state}`, `points-to: ${pointsTo ?? 'null'}`, 'evidence: []', 'invaded: null', '---', '', '# Briefing', '', '## Never', '<!-- slot: never · required -->', body, ''].join('\n');
  }

  it.each(['A', 'M', 'D'])('fires on the briefing %s', (status) => {
    expect(rulesFiredOn(BRIEFING, status)).toEqual(['briefing-text']);
  });

  it('fires on a briefing moved away, at its delete', () => {
    const moved = [change(BRIEFING, 'D'), change('docs/old-briefing.md', 'A')];
    expect(riskyChanges(moved, { ctx })).toEqual([{ path: BRIEFING, status: 'D', rule: 'briefing-text' }]);
  });

  it('fires at a custom paths.playbook, and not at the default one there', () => {
    const custom = flatCtx(root, { paths: { knowledge: 'docs/knowledge', adr: 'docs/adr', playbook: 'handbook/how-we-work' } });
    expect(riskyChanges([change('handbook/how-we-work/briefing.md')], { ctx: custom }).map((entry) => entry.rule)).toEqual(['briefing-text']);
    expect(riskyChanges([change(BRIEFING)], { ctx: custom })).toEqual([]);
  });

  it("fires on a pointer form's points-to file, read at the head", () => {
    seed(BRIEFING, briefingText({ body: '', pointsTo: 'docs/agents/rules.md' }));
    expect(rulesFiredOn('docs/agents/rules.md')).toEqual(['briefing-text']);
  });

  it("fires on a section's See: file, the whole file, its anchor dropped", () => {
    seed(BRIEFING, briefingText({ body: 'See: README.md#never' }));
    expect(rulesFiredOn('README.md')).toEqual(['briefing-text']);
  });

  it('never fires on another form, on the kit template, or on a file only another form points to', () => {
    seed(BRIEFING, briefingText());
    seed('.omni-loop/knowledge/playbook/testing.md', briefingText({ body: 'See: docs/testing.md' }).replace('form: briefing', 'form: testing'));
    expect(rulesFiredOn('.omni-loop/knowledge/playbook/testing.md')).toEqual([]);
    expect(rulesFiredOn('kit/templates/playbook/briefing.md')).toEqual([]);
    expect(rulesFiredOn('docs/testing.md')).toEqual([]);
  });

  it('reports both rules on a change that fires another one too', () => {
    seed(BRIEFING, briefingText({ body: 'See: docs/adr/0001-rules.md' }));
    expect(rulesFiredOn('docs/adr/0001-rules.md')).toEqual(['law-text', 'briefing-text']);
  });

  it('fires whatever laws.source says', () => {
    const elsewhere = flatCtx(root, { laws: { source: 'none' } });
    expect(riskyChanges([change(BRIEFING)], { ctx: elsewhere }).map((entry) => entry.rule)).toEqual(['briefing-text']);
  });

  it('is one of RULE_IDS', () => {
    expect(RULE_IDS).toContain('briefing-text');
  });
});

/** An invariants file holding one entry per `[id, Enforced by: value]` pair. */
function invariantsText(entries: [string, string][]): string {
  return entries
    .flatMap(([id, enforcedBy]) => [`## ${id}`, '', `Invariant ${id}.`, '', `Enforced by: ${enforcedBy}`, ''])
    .join('\n');
}

/** The base branch's knowledge folder, holding only the product invariants given. */
function baseWith(entries: [string, string][]) {
  return memorySource({ [INVARIANTS]: invariantsText(entries) });
}

/** The rules fired over a range that changed the invariants file, graded against `base`. */
function demotedOver(base: ReturnType<typeof baseWith> | null, status = 'M', options: { ctx?: Context } = {}) {
  return riskyChanges([change(INVARIANTS, status)], { ctx: options.ctx ?? ctx, base });
}

describe('riskyChanges — law-demoted (PRD 1342)', () => {
  const PROOF = 'kit/lib/proof.test.ts';

  it('fires when a law entry is removed between the base and the head', () => {
    seed(INVARIANTS, invariantsText([['N1', PROOF]]));
    const risky = demotedOver(baseWith([['N1', PROOF], ['N2', 'unenforced']]));
    expect(risky).toEqual([
      { path: INVARIANTS, status: 'M', rule: 'law-text' },
      { path: INVARIANTS, status: 'M', rule: 'law-demoted' },
    ]);
  });

  it('fires when the whole register file is deleted, with the change status', () => {
    const risky = demotedOver(baseWith([['N1', PROOF]]), 'D');
    expect(risky).toEqual([
      { path: INVARIANTS, status: 'D', rule: 'law-text' },
      { path: INVARIANTS, status: 'D', rule: 'law-demoted' },
    ]);
  });

  it('fires when an Enforced by: path turns to pending', () => {
    seed(INVARIANTS, invariantsText([['N1', 'pending #12']]));
    const rules = demotedOver(baseWith([['N1', PROOF]])).map((entry) => entry.rule);
    expect(rules).toEqual(['law-text', 'law-demoted']);
  });

  it('fires when an Enforced by: path turns to unenforced', () => {
    seed(INVARIANTS, invariantsText([['N1', 'unenforced']]));
    const rules = demotedOver(baseWith([['N1', PROOF]])).map((entry) => entry.rule);
    expect(rules).toEqual(['law-text', 'law-demoted']);
  });

  it('does not fire when the path is kept, or swapped for another path', () => {
    seed(INVARIANTS, invariantsText([['N1', PROOF], ['N2', 'kit/lib/other.test.ts']]));
    const base = baseWith([['N1', PROOF], ['N2', 'kit/lib/older.test.ts']]);
    expect(demotedOver(base).map((entry) => entry.rule)).toEqual(['law-text']);
  });

  it('does not fire when a law is promoted, unenforced to pending or pending to a path', () => {
    seed(INVARIANTS, invariantsText([['N1', 'pending #3'], ['N2', PROOF]]));
    const base = baseWith([['N1', 'unenforced'], ['N2', 'pending #4']]);
    expect(demotedOver(base).map((entry) => entry.rule)).toEqual(['law-text']);
  });

  it('does not count a proposed entry removed as a law removed', () => {
    seed(INVARIANTS, '');
    const base = memorySource({
      [INVARIANTS]: ['## N1', '', 'Not yet a law.', '', `Enforced by: ${PROOF}`, 'Proposed: harvest 2026-10-01', ''].join('\n'),
    });
    expect(demotedOver(base).map((entry) => entry.rule)).toEqual(['law-text']);
  });

  it('counts a law removed whatever its Enforced by: said', () => {
    seed(INVARIANTS, '');
    expect(demotedOver(baseWith([['N1', 'unenforced']])).map((entry) => entry.rule)).toEqual(['law-text', 'law-demoted']);
  });

  it('counts a rule removed as a law removed', () => {
    const RULES_FILE = 'docs/knowledge/product/rules.md';
    const base = memorySource({ [RULES_FILE]: ['## BR-PRODUCT-1', '', 'A rule.', '', 'Serves: P-PRODUCT-1', 'Enforced by: unenforced', ''].join('\n') });
    expect(riskyChanges([change(RULES_FILE)], { ctx, base }).map((entry) => entry.rule)).toEqual(['law-text', 'law-demoted']);
  });

  it('does not count a principle removed as a law removed', () => {
    const PRINCIPLES = 'docs/knowledge/product/principles.md';
    const base = memorySource({ [PRINCIPLES]: ['## P-PRODUCT-1', '', 'A principle.', '', 'Why: because.', ''].join('\n') });
    expect(riskyChanges([change(PRINCIPLES)], { ctx, base }).map((entry) => entry.rule)).toEqual(['law-text']);
  });

  it('reports a register file once however many of its laws were demoted', () => {
    seed(INVARIANTS, invariantsText([['N1', 'unenforced']]));
    const risky = demotedOver(baseWith([['N1', PROOF], ['N2', PROOF], ['N3', 'unenforced']]));
    expect(risky.filter((entry) => entry.rule === 'law-demoted')).toHaveLength(1);
  });

  it('names the file the law sits in at the head, with M when that file is outside the range', () => {
    const DOMAIN = 'docs/knowledge/domains/advisor/invariants.md';
    seed(DOMAIN, invariantsText([['N1', 'unenforced']]));
    const base = baseWith([['N1', PROOF]]);
    expect(riskyChanges([change(DOMAIN, 'A')], { ctx, base })).toEqual([
      { path: DOMAIN, status: 'A', rule: 'law-text' },
      { path: DOMAIN, status: 'A', rule: 'law-demoted' },
    ]);
    expect(riskyChanges([], { ctx, base })).toEqual([{ path: DOMAIN, status: 'M', rule: 'law-demoted' }]);
  });

  it('does not fire for a law moved to another domain folder with a Kept id: line (PRD 2346)', () => {
    const MOVED = 'docs/knowledge/domains/ask/invariants.md';
    const kept = ['## N1', '', 'Invariant N1.', '', 'Kept id: N1', `Enforced by: ${PROOF}`, ''].join('\n');
    seed(INVARIANTS, '');
    seed(MOVED, kept);
    const base = baseWith([['N1', PROOF]]);
    expect(riskyChanges([change(INVARIANTS, 'M'), change(MOVED, 'A')], { ctx, base }).map((entry) => entry.rule)).not.toContain('law-demoted');
  });

  it('never fires without a base to compare with', () => {
    seed(INVARIANTS, '');
    expect(demotedOver(null).map((entry) => entry.rule)).toEqual(['law-text']);
    expect(riskyChanges([change(INVARIANTS)], { ctx }).map((entry) => entry.rule)).toEqual(['law-text']);
  });

  it('never fires when laws.source is not "knowledge"', () => {
    seed(INVARIANTS, '');
    const noLawsCtx = flatCtx(root, { risk: RISK, laws: { source: 'none' } });
    const rules = demotedOver(baseWith([['N1', PROOF]]), 'M', { ctx: noLawsCtx }).map((entry) => entry.rule);
    expect(rules).toEqual(['law-text']);
  });
});

describe('enforcedByPaths — pending names no path (PRD 1342)', () => {
  it('reads pending #<n> as no proof path, and a path beside it still as one', () => {
    seed(INVARIANTS, invariantsText([['N1', 'pending #12'], ['N2', 'kit/lib/a.test.ts']]));
    expect([...enforcedByPaths({ ctx })]).toEqual(['kit/lib/a.test.ts']);
  });

  it('names no empty path for a stray comma', () => {
    seed(INVARIANTS, invariantsText([['N1', 'kit/lib/a.test.ts, ,']]));
    expect([...enforcedByPaths({ ctx })]).toEqual(['kit/lib/a.test.ts']);
  });

  it('fires law-proof on no change named after a pending line', () => {
    seed(INVARIANTS, invariantsText([['N1', 'pending #12']]));
    expect(rulesFiredOn('pending #12')).toEqual([]);
  });
});

describe('lockedLawChanges — law-locked (PRD 1726)', () => {
  const PROOF = 'src/widget.test.ts';
  const LOCK = 'Locked: @ann, 2026-10-12';

  /** One invariant entry: its id, statement, `Enforced by:` and any more field lines. */
  function entry(id: string, statement: string, enforcedBy: string, ...lines: string[]): string[] {
    return [`## ${id}`, '', statement, '', `Enforced by: ${enforcedBy}`, ...lines, ''];
  }

  /** The invariants file holding these entries. */
  const file = (...entries: string[][]) => entries.flat().join('\n');

  /** The law-locked firings, as `law path status rule`, over `changes` against a base holding `baseText`. */
  function firedOver(baseText: string | null, changes = [change(INVARIANTS)], options: { ctx?: Context } = {}) {
    const base = baseText === null ? null : memorySource({ [INVARIANTS]: baseText });
    return lockedLawChanges(changes, { ctx: options.ctx ?? ctx, base }).map((one) => `${one.law} ${one.path} ${one.status} ${one.rule}`);
  }

  it('fires when a Locked: line is added', () => {
    seed(INVARIANTS, file(entry('N1', 'A law.', PROOF, LOCK)));
    expect(firedOver(file(entry('N1', 'A law.', PROOF)))).toEqual([`N1 ${INVARIANTS} M law-locked`]);
  });

  it('fires when a Locked: line is removed', () => {
    seed(INVARIANTS, file(entry('N1', 'A law.', PROOF)));
    expect(firedOver(file(entry('N1', 'A law.', PROOF, LOCK)))).toEqual([`N1 ${INVARIANTS} M law-locked`]);
  });

  it('fires when a locked entry’s text is edited, a field as much as its statement', () => {
    seed(INVARIANTS, file(entry('N1', 'A law, reworded.', PROOF, LOCK)));
    expect(firedOver(file(entry('N1', 'A law.', PROOF, LOCK)))).toEqual([`N1 ${INVARIANTS} M law-locked`]);
    seed(INVARIANTS, file(entry('N1', 'A law.', PROOF, LOCK, 'Governs: ^src/')));
    expect(firedOver(file(entry('N1', 'A law.', PROOF, LOCK)))).toEqual([`N1 ${INVARIANTS} M law-locked`]);
  });

  it('fires when a locked entry is deleted, naming the file it sat in, and when one is added already locked', () => {
    seed(INVARIANTS, '');
    expect(firedOver(file(entry('N1', 'A law.', 'unenforced', LOCK)))).toEqual([`N1 ${INVARIANTS} M law-locked`]);
    seed(INVARIANTS, file(entry('N1', 'A law.', 'unenforced', LOCK)));
    expect(firedOver('')).toEqual([`N1 ${INVARIANTS} M law-locked`]);
  });

  it('fires on a file its Enforced by: names, at the head or at the base, with that change’s status', () => {
    seed(INVARIANTS, file(entry('N1', 'A law.', `${PROOF}, src/b.test.ts`, LOCK)));
    const same = file(entry('N1', 'A law.', `${PROOF}, src/b.test.ts`, LOCK));
    expect(firedOver(same, [change(PROOF, 'D'), change('src/b.test.ts'), change('src/widget.ts')])).toEqual([
      `N1 ${PROOF} D law-locked`,
      'N1 src/b.test.ts M law-locked',
    ]);
    seed(INVARIANTS, file(entry('N1', 'A law.', 'src/new.test.ts', LOCK)));
    expect(firedOver(file(entry('N1', 'A law.', PROOF, LOCK)), [change(PROOF, 'D')])).toEqual([`N1 ${PROOF} D law-locked`]);
  });

  it('fires once per law and file, however many reasons it has', () => {
    seed(INVARIANTS, file(entry('N1', 'Reworded.', PROOF, LOCK), entry('N2', 'Another.', PROOF, LOCK)));
    const base = file(entry('N1', 'A law.', PROOF, LOCK), entry('N2', 'Another.', PROOF, LOCK));
    expect(firedOver(base, [change(INVARIANTS), change(PROOF)])).toEqual([
      `N1 ${INVARIANTS} M law-locked`,
      `N1 ${PROOF} M law-locked`,
      `N2 ${PROOF} M law-locked`,
    ]);
  });

  it('never fires on a rule or an invariant no one locked: edited, deleted, added or its test changed', () => {
    seed(INVARIANTS, file(entry('N1', 'Reworded.', PROOF), entry('N3', 'New.', PROOF)));
    expect(firedOver(file(entry('N1', 'A rule.', PROOF), entry('N2', 'Gone.', PROOF)), [change(INVARIANTS), change(PROOF, 'D')])).toEqual([]);
    const RULES_FILE = 'docs/knowledge/product/rules.md';
    seed(RULES_FILE, ['## BR-PRODUCT-1', '', 'A rule, reworded.', '', 'Serves: P-PRODUCT-1', `Enforced by: ${PROOF}`, ''].join('\n'));
    const base = memorySource({ [RULES_FILE]: ['## BR-PRODUCT-1', '', 'A rule.', '', 'Serves: P-PRODUCT-1', `Enforced by: ${PROOF}`, ''].join('\n') });
    expect(lockedLawChanges([change(RULES_FILE), change(PROOF)], { ctx, base })).toEqual([]);
  });

  it('never fires on a locked entry left alone, nor when only the base moved on', () => {
    seed(INVARIANTS, file(entry('N1', 'A law.', PROOF, LOCK)));
    expect(firedOver(file(entry('N1', 'A law.', PROOF, LOCK)))).toEqual([]);
    expect(firedOver(file(entry('N1', 'The base reworded it.', PROOF, LOCK)), [change('src/widget.ts')])).toEqual([]);
  });

  it('a locked entry moved to another register file, its words kept, fires on both files', () => {
    const DOMAIN = 'docs/knowledge/domains/advisor/invariants.md';
    const kept = file(entry('N1', 'A law.', 'unenforced', LOCK));
    seed(INVARIANTS, '');
    seed(DOMAIN, kept);
    expect(firedOver(kept, [change(INVARIANTS), change(DOMAIN, 'A')])).toEqual([`N1 ${INVARIANTS} M law-locked`, `N1 ${DOMAIN} A law-locked`]);
  });

  it('a locked rule counts as much as a locked invariant; a "locked" principle is never a law', () => {
    const RULES_FILE = 'docs/knowledge/product/rules.md';
    const PRINCIPLES = 'docs/knowledge/product/principles.md';
    seed(RULES_FILE, ['## BR-PRODUCT-1', '', 'A rule.', '', `Enforced by: ${PROOF}`, LOCK, ''].join('\n'));
    seed(PRINCIPLES, ['## P-PRODUCT-1', '', 'A principle.', '', 'Why: because.', LOCK, ''].join('\n'));
    const base = memorySource({ [PRINCIPLES]: ['## P-PRODUCT-1', '', 'A principle.', '', 'Why: because.', ''].join('\n') });
    const fired = lockedLawChanges([change(RULES_FILE), change(PRINCIPLES)], { ctx, base }).map((one) => one.law);
    expect(fired).toEqual(['BR-PRODUCT-1']);
  });

  it('without a base, reads only the head laws’ proofs', () => {
    seed(INVARIANTS, file(entry('N1', 'A law.', PROOF, LOCK)));
    expect(firedOver(null, [change(INVARIANTS), change(PROOF)])).toEqual([`N1 ${PROOF} M law-locked`]);
  });

  it('never fires when laws.source is not "knowledge"', () => {
    seed(INVARIANTS, file(entry('N1', 'A law.', PROOF, LOCK)));
    const noLawsCtx = flatCtx(root, { risk: RISK, laws: { source: 'none' } });
    expect(firedOver('', [change(INVARIANTS), change(PROOF)], { ctx: noLawsCtx })).toEqual([]);
  });

  it('is no rule of riskyChanges: no account ever covers it', () => {
    expect(RULE_IDS).toEqual(['stored-shape', 'law-proof', 'law-text', 'test-removed', 'shared-contract', 'briefing-text', 'law-demoted']);
    expect(LAW_LOCKED).toBe('law-locked');
  });
});

describe('lawsAwaitingOwners — only a CODEOWNER’s approval clears law-locked (PRD 1726)', () => {
  const fired = (law: string, path: string) => ({ path, status: 'M', rule: LAW_LOCKED, law });
  const OWNERS: Record<string, string[]> = {
    'a.md': ['@ann', '@acme/core'],
    'a.test.ts': ['@ann'],
    'b.test.ts': ['@bob'],
    'team.test.ts': ['@acme/core', 'core@acme.com'],
  };
  const ownersOf = (path: string) => OWNERS[path] ?? [];

  it('no approval holds every law, naming the files and the persons who own them', () => {
    expect(lawsAwaitingOwners([fired('N1', 'a.md'), fired('N1', 'a.test.ts')], { ownersOf, approvers: [] })).toEqual({
      awaiting: [{ law: 'N1', reason: 'no-approval', paths: ['a.md', 'a.test.ts'], owners: ['@ann'] }],
      approvedBy: [],
    });
  });

  it('a non-owner’s approval holds it; an owner’s clears it, without case', () => {
    expect(lawsAwaitingOwners([fired('N1', 'a.md')], { ownersOf, approvers: ['bob'] }).awaiting).toHaveLength(1);
    expect(lawsAwaitingOwners([fired('N1', 'a.md')], { ownersOf, approvers: ['bob', 'ANN'] })).toEqual({ awaiting: [], approvedBy: ['ANN'] });
  });

  it('every file must be approved by one of its own owners', () => {
    const both = [fired('N1', 'a.test.ts'), fired('N1', 'b.test.ts')];
    expect(lawsAwaitingOwners(both, { ownersOf, approvers: ['ann'] })).toEqual({
      awaiting: [{ law: 'N1', reason: 'no-approval', paths: ['b.test.ts'], owners: ['@ann', '@bob'] }],
      approvedBy: ['ann'],
    });
    expect(lawsAwaitingOwners(both, { ownersOf, approvers: ['ann', 'bob'] })).toEqual({ awaiting: [], approvedBy: ['ann', 'bob'] });
  });

  it('a file no person owns holds its law closed, whatever was approved — a team or an e-mail is no person', () => {
    const laws = [fired('N1', 'a.test.ts'), fired('N1', 'nobody.ts'), fired('N2', 'team.test.ts')];
    expect(lawsAwaitingOwners(laws, { ownersOf, approvers: ['ann', 'core'] }).awaiting).toEqual([
      { law: 'N1', reason: 'no-codeowner', paths: ['nobody.ts'], owners: ['@ann'] },
      { law: 'N2', reason: 'no-codeowner', paths: ['team.test.ts'], owners: [] },
    ]);
  });

  it('each law is judged alone', () => {
    const laws = [fired('N1', 'a.test.ts'), fired('N2', 'b.test.ts')];
    expect(lawsAwaitingOwners(laws, { ownersOf, approvers: ['bob'] })).toEqual({
      awaiting: [{ law: 'N1', reason: 'no-approval', paths: ['a.test.ts'], owners: ['@ann'] }],
      approvedBy: ['bob'],
    });
  });

  it('nothing fired, nothing awaits', () => {
    expect(lawsAwaitingOwners([], { ownersOf, approvers: [] })).toEqual({ awaiting: [], approvedBy: [] });
  });
});

// Issue 2387: a law moved into a file the base branch's CODEOWNERS does not list. Its approvers fall
// back to the law owners the base config names, so an owner's approval clears it.
describe('lawsAwaitingOwners — a file no person owns falls back to the law owners (issue 2387)', () => {
  const fired = (law: string, path: string) => ({ path, status: 'M', rule: LAW_LOCKED, law });
  const ownersOf = (path: string) => (path === 'product/rules.md' ? ['@ann'] : []);
  const moved = [fired('BR-1', 'product/rules.md'), fired('BR-1', 'domains/ask/rules.md')];

  it('a law owner’s approval clears a law moved into a file nobody owns', () => {
    expect(lawsAwaitingOwners(moved, { ownersOf, approvers: ['ann'], lawOwners: ['ann'] })).toEqual({ awaiting: [], approvedBy: ['ann'] });
  });

  it('without that approval, the law waits for the law owners, named', () => {
    expect(lawsAwaitingOwners(moved, { ownersOf, approvers: [], lawOwners: ['ann', 'bob'] }).awaiting).toEqual([
      { law: 'BR-1', reason: 'no-approval', paths: ['product/rules.md', 'domains/ask/rules.md'], owners: ['@ann', '@bob'] },
    ]);
  });

  it('with no law owners either, it still fails closed', () => {
    expect(lawsAwaitingOwners(moved, { ownersOf, approvers: ['ann'], lawOwners: [] }).awaiting).toEqual([
      { law: 'BR-1', reason: 'no-codeowner', paths: ['domains/ask/rules.md'], owners: ['@ann'] },
    ]);
  });
});
