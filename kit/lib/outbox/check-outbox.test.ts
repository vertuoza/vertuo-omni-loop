import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formText, makeRepo } from '../../test/fixture.ts';
import type { Context } from '../context.ts';
import { flatCtx as untypedFlatCtx } from '../../test/flat-layout.ts';
import { lawsFor } from '../laws.ts';
import type { Laws } from '../laws.ts';
import { makeMarkers } from '../markers.ts';
import { checkItemText, findOutboxViolations } from './check-outbox.ts';

/** The flat test layout's context, typed as the kit's own (it carries every field the code reads). */
const flatCtx = (root: string): Context => untypedFlatCtx(root) as unknown as Context;

const PLAIN_AND_REQUIRED_SECTIONS = [
  'The question, in plain words',
  'The decision, in plain words',
  'The intro, for fun',
  'The punchline, for fun',
  'The options, in plain words',
  'What a person must do',
  'What I had to decide',
  'What I did meanwhile',
  'What it costs to change later',
  'What I could not know',
];

function itemText({
  frontMatter = {},
  sections = {},
}: { frontMatter?: Record<string, unknown>; sections?: Record<string, string | undefined> } = {}) {
  const fm = {
    id: 's2-01-example',
    prd: '985',
    slice: 's2',
    rank: 'medium',
    'bears-on': 'none',
    raised: '2026-09-22',
    wave: '2',
    ...frontMatter,
  };
  const fmLines = Object.entries(fm)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value}`);

  const body: Record<string, string | undefined> = {
    'The question, in plain words': 'Should the change wait for the next release, or ship now?',
    'The decision, in plain words': 'It ships now, because waiting costs more than the risk.',
    'The options, in plain words': 'A. Ship now, the option built.\nB. Wait for the next release.',
    'What I had to decide': 'x',
    'What I did meanwhile': 'y',
    'What it costs to change later': 'z',
    'What I could not know': '(author) w',
    ...sections,
  };
  const bodyText = PLAIN_AND_REQUIRED_SECTIONS.filter((heading) => body[heading] !== undefined)
    .map((heading) => `## ${heading}\n\n${body[heading]}\n`)
    .join('\n');

  return ['---', ...fmLines, '---', '', bodyText].join('\n');
}

/**
 * The valid-item fixture this file defines, with `prd: 7` — used by the shipped-PRD tests below,
 * which only need a file `outboxItemFiles` lists; its own content is never graded once a shipped
 * dir claims it.
 */
const VALID_ITEM_TEXT = itemText({ frontMatter: { prd: 7 } });

/** Seeds a fixture root with a minimal knowledge folder so an N-id `bears-on` can resolve. */
function seedRegisters(dir: string) {
  mkdirSync(join(dir, 'docs/knowledge/product'), { recursive: true });
  writeFileSync(
    join(dir, 'docs/knowledge/product/invariants.md'),
    '## N2\n\nSomething invariant.\n\nEnforced by: unenforced\n',
  );
}

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'check-outbox-'));
  seedRegisters(root);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/**
 * The laws every direct `checkItemText`/`findOutboxViolations(flatCtx(...))` call in this file
 * injects — real resolution against the current fixture `root`, through `lawsFor` (Task 4).
 * `checkItemText` always calls `resolveBearsOn`, so — unlike `outbox.test.mjs`'s own stub — there
 * is no "pure, disk-free" path left to special-case here; every call needs a real (if often empty)
 * `root`, which `beforeEach` provides fresh for every test.
 */
const laws: Laws = {
  source: 'knowledge',
  resolve: (b: string) => lawsFor(flatCtx(root)).resolve(b),
  floorsHigh: (b: string) => lawsFor(flatCtx(root)).floorsHigh(b),
};

describe('checkItemText', () => {
  it('finds nothing wrong with a well-formed item whose bears-on is "none"', () => {
    expect(checkItemText('docs/outbox/985/s2-01-example.md', itemText(), { laws })).toEqual([]);
  });

  it('refuses a malformed item, naming the file and the reason', () => {
    const text = itemText({ frontMatter: { rank: 'urgent' } });
    const violations = checkItemText('docs/outbox/985/s2-01-bad.md', text, { laws });
    expect(violations).toHaveLength(1);
    expect(violations[0]!.startsWith('docs/outbox/985/s2-01-bad.md:')).toBe(true);
    expect(violations[0]).toMatch(/rank/);
  });

  it('refuses an item missing a required section, naming which one', () => {
    const text = itemText({ sections: { 'What I could not know': undefined } });
    const violations = checkItemText('docs/outbox/985/s2-01-bad.md', text, { laws });
    expect(violations.some((v) => v.includes('What I could not know'))).toBe(true);
  });

  it('refuses an item whose bears-on does not resolve', () => {
    const text = itemText({ frontMatter: { 'bears-on': 'BR-NOPE-1' } });
    const violations = checkItemText('docs/outbox/985/s2-01-bad.md', text, { laws });
    expect(violations.some((v) => /bears-on "BR-NOPE-1" does not resolve/.test(v))).toBe(true);
  });

  it('refuses an item whose rank sits below the floor its bears-on sets', () => {
    const text = itemText({ frontMatter: { 'bears-on': 'N2', rank: 'medium' } });
    const violations = checkItemText('docs/outbox/985/s2-01-bad.md', text, { laws });
    expect(violations.some((v) => /below the floor/.test(v))).toBe(true);
  });

  it('accepts an item whose rank was already raised to meet its floor', () => {
    const text = itemText({ frontMatter: { 'bears-on': 'N2', rank: 'high' } });
    expect(checkItemText('docs/outbox/985/s2-01-ok.md', text, { laws })).toEqual([]);
  });

  it('resolves an ADR bears-on against a fixture docs/adr directory', () => {
    mkdirSync(join(root, 'docs/adr'), { recursive: true });
    writeFileSync(join(root, 'docs/adr/0069-example.md'), '# 0069\n');

    const text = itemText({ frontMatter: { 'bears-on': 'ADR-0069' } });
    expect(checkItemText('docs/outbox/985/s2-01-ok.md', text, { laws })).toEqual([]);

    const badText = itemText({ frontMatter: { 'bears-on': 'ADR-0001' } });
    const violations = checkItemText('docs/outbox/985/s2-01-bad.md', badText, { laws });
    expect(violations.some((v) => /bears-on "ADR-0001" does not resolve/.test(v))).toBe(true);
  });

  describe('the two plain-words sections (PRD #1071)', () => {
    it('refuses an open item missing both plain sections, naming what is missing', () => {
      const text = itemText({
        sections: {
          'The question, in plain words': undefined,
          'The decision, in plain words': undefined,
        },
      });
      const violations = checkItemText('docs/outbox/985/s2-01-bad.md', text, { laws });
      expect(
        violations.some((v) => /The question, in plain words/.test(v) && /missing/.test(v)),
      ).toBe(true);
    });

    it('refuses a question without plain words — a fixture item whose plain question names a file', () => {
      const text = itemText({
        sections: {
          'The question, in plain words': 'Should we wait for scripts/outbox.mjs to change first?',
        },
      });
      const violations = checkItemText('docs/outbox/985/s2-01-bad.md', text, { laws });
      expect(
        violations.some(
          (v) =>
            v.includes('The question, in plain words') &&
            v.includes('file path') &&
            v.includes('scripts/outbox.mjs'),
        ),
      ).toBe(true);
    });

    it('refuses a decision that carries a register id instead of plain words', () => {
      const text = itemText({
        sections: { 'The decision, in plain words': 'It floors at high because of N3.' },
      });
      const violations = checkItemText('docs/outbox/985/s2-01-bad.md', text, { laws });
      expect(
        violations.some((v) => v.includes('The decision, in plain words') && v.includes('N3')),
      ).toBe(true);
    });

    it('accepts a well-formed item whose plain sections carry no code, path, id or excess length', () => {
      expect(checkItemText('docs/outbox/985/s2-01-ok.md', itemText(), { laws })).toEqual([]);
    });
  });

  describe('the options section (PRD #1166, slice s4)', () => {
    it('Scenario: an item without options is refused — a high item with one option', () => {
      const text = itemText({
        frontMatter: { rank: 'high' },
        sections: { 'The options, in plain words': 'A. The only option offered.' },
      });
      const violations = checkItemText('docs/outbox/985/s2-01-bad.md', text, { laws });
      expect(violations).toHaveLength(1);
      expect(violations[0]!.startsWith('docs/outbox/985/s2-01-bad.md:')).toBe(true);
      expect(violations[0]).toMatch(/1 option/);
    });

    it('refuses a medium item with no options section at all', () => {
      const text = itemText({ sections: { 'The options, in plain words': undefined } });
      const violations = checkItemText('docs/outbox/985/s2-01-bad.md', text, { laws });
      expect(violations.some((v) => /0 option/.test(v))).toBe(true);
    });

    it('refuses a high item with five options', () => {
      const text = itemText({
        frontMatter: { rank: 'high' },
        sections: {
          'The options, in plain words': 'A. Built.\nB. Second.\nC. Third.\nD. Fourth.\nE. Fifth.',
        },
      });
      const violations = checkItemText('docs/outbox/985/s2-01-bad.md', text, { laws });
      expect(violations.some((v) => /5 option/.test(v))).toBe(true);
    });

    it('accepts a high item with the full four options', () => {
      const text = itemText({
        frontMatter: { rank: 'high' },
        sections: {
          'The options, in plain words': 'A. Built.\nB. Second.\nC. Third.\nD. Fourth.',
        },
      });
      expect(checkItemText('docs/outbox/985/s2-01-ok.md', text, { laws })).toEqual([]);
    });

    it('refuses options whose letters skip a letter', () => {
      const text = itemText({
        sections: { 'The options, in plain words': 'A. Built.\nC. Skips B.' },
      });
      const violations = checkItemText('docs/outbox/985/s2-01-bad.md', text, { laws });
      expect(violations.some((v) => /lettered A, C/.test(v))).toBe(true);
    });

    it('refuses options that do not start at A', () => {
      const text = itemText({
        sections: { 'The options, in plain words': 'B. Built.\nC. Second.' },
      });
      const violations = checkItemText('docs/outbox/985/s2-01-bad.md', text, { laws });
      expect(violations.some((v) => /lettered B, C/.test(v))).toBe(true);
    });

    it('refuses an option whose text breaks the plain-words rules, naming the letter', () => {
      const text = itemText({
        sections: {
          'The options, in plain words':
            'A. Ship it now.\nB. Wait for scripts/outbox.mjs to change first.',
        },
      });
      const violations = checkItemText('docs/outbox/985/s2-01-bad.md', text, { laws });
      expect(
        violations.some(
          (v) =>
            v.includes(': option "B"') && v.includes('file path') && v.includes('scripts/outbox.mjs'),
        ),
      ).toBe(true);
    });

    it('needs no options for a human-action item, which carries "What a person must do" instead', () => {
      const text = itemText({
        frontMatter: { rank: 'human-action' },
        sections: {
          'The options, in plain words': undefined,
          'What a person must do': 'Add the missing secret to the console, then re-run the job.',
        },
      });
      expect(checkItemText('docs/outbox/985/s2-01-ok.md', text, { laws })).toEqual([]);
    });
  });

  describe('the intro and the punchline (PRD #50, slice s1)', () => {
    const fun = {
      'The intro, for fun': 'A release train waits for nobody, except this one question.',
      'The punchline, for fun': 'The train has already left. The question bought a ticket anyway.',
    };

    it('accepts an open item carrying a plain pair', () => {
      const text = itemText({ sections: fun });
      expect(checkItemText('docs/outbox/985/s2-01-ok.md', text, { laws })).toEqual([]);
    });

    it('still accepts an open item carrying neither — the pair is optional', () => {
      const text = itemText();
      expect(text).not.toMatch(/for fun/);
      expect(checkItemText('docs/outbox/985/s2-01-ok.md', text, { laws })).toEqual([]);
    });

    it('refuses an intro over 120 characters, naming the file and the section', () => {
      const text = itemText({ sections: { ...fun, 'The intro, for fun': 'a'.repeat(121) } });
      const violations = checkItemText('docs/outbox/985/s2-01-bad.md', text, { laws });
      expect(violations).toEqual([
        expect.stringMatching(
          /^docs\/outbox\/985\/s2-01-bad\.md: "## The intro, for fun" is 121 characters long/,
        ),
      ]);
    });

    it('refuses a punchline holding a backticked code name, naming the file and the section', () => {
      const text = itemText({
        sections: { ...fun, 'The punchline, for fun': 'Even `defaultTimeoutMs` needs a holiday.' },
      });
      const violations = checkItemText('docs/outbox/985/s2-01-bad.md', text, { laws });
      expect(violations.length).toBeGreaterThan(0);
      expect(
        violations.every((v) =>
          v.startsWith('docs/outbox/985/s2-01-bad.md: "## The punchline, for fun"'),
        ),
      ).toBe(true);
      expect(
        violations.some((v) => v.includes('code span') && v.includes('defaultTimeoutMs')),
      ).toBe(true);
    });

    it('refuses a line that names a file path or an id', () => {
      const text = itemText({
        sections: {
          'The intro, for fun': 'Nobody ever reads scripts/outbox.mjs for fun.',
          'The punchline, for fun': 'Except N3, who reads everything.',
        },
      });
      const violations = checkItemText('docs/outbox/985/s2-01-bad.md', text, { laws });
      expect(
        violations.some((v) => v.includes('"## The intro, for fun"') && v.includes('file path')),
      ).toBe(true);
      expect(
        violations.some((v) => v.includes('"## The punchline, for fun"') && v.includes('N3')),
      ).toBe(true);
    });

    it('refuses an open item carrying only one of the pair, naming the file', () => {
      const text = itemText({ sections: { 'The intro, for fun': fun['The intro, for fun'] } });
      const violations = checkItemText('docs/outbox/985/s2-01-bad.md', text, { laws });
      expect(
        violations.some(
          (v) => v.startsWith('docs/outbox/985/s2-01-bad.md:') && v.includes('without'),
        ),
      ).toBe(true);
    });

    it('fails findOutboxViolations on an open item whose intro breaks a rule', () => {
      mkdirSync(join(root, 'docs/outbox/985'), { recursive: true });
      writeFileSync(join(root, 'docs/outbox/985/s2-01-good.md'), itemText({ sections: fun }));
      writeFileSync(
        join(root, 'docs/outbox/985/s2-02-long.md'),
        itemText({
          frontMatter: { id: 's2-02-long' },
          sections: { ...fun, 'The intro, for fun': 'a'.repeat(130) },
        }),
      );
      const violations = findOutboxViolations({ ctx: flatCtx(root) });
      expect(violations).toEqual([
        expect.stringMatching(/^docs\/outbox\/985\/s2-02-long\.md: .*130 characters long/),
      ]);
    });
  });
});

describe('Feature: where truth lives', () => {
  it('Scenario: an outbox item may bear on a principle', () => {
    mkdirSync(join(root, 'docs/knowledge/domains/advisor'), { recursive: true });
    writeFileSync(
      join(root, 'docs/knowledge/domains/advisor/principles.md'),
      '## P-ADVISOR-1\n\nThe advisor drafts; a person saves.\n\nWhy: x\nDecided: y\nSource: z\n',
    );

    const accepted = itemText({ frontMatter: { 'bears-on': 'P-ADVISOR-1', rank: 'high' } });
    expect(checkItemText('docs/outbox/1081/s1-01-ok.md', accepted, { laws })).toEqual([]);

    const talkedDown = itemText({ frontMatter: { 'bears-on': 'P-ADVISOR-1', rank: 'medium' } });
    const violations = checkItemText('docs/outbox/1081/s1-01-bad.md', talkedDown, { laws });
    expect(violations).toEqual([expect.stringMatching(/below the floor/)]);
  });

  it('a domain invariant and a cross-domain entry resolve too, and floor at high', () => {
    mkdirSync(join(root, 'docs/knowledge/domains/folder'), { recursive: true });
    mkdirSync(join(root, 'docs/knowledge/cross-domain'), { recursive: true });
    writeFileSync(
      join(root, 'docs/knowledge/domains/folder/invariants.md'),
      '## N-FOLDER-1\n\nHolds.\n\nSource: x\nEnforced by: unenforced\nStated: 2026-09-23\n',
    );
    writeFileSync(
      join(root, 'docs/knowledge/cross-domain/advisor--credits.md'),
      '## X-ADVISOR-CREDITS-1\n\nCharged first.\n\nKind: rule\n',
    );
    for (const bearsOn of ['N-FOLDER-1', 'X-ADVISOR-CREDITS-1']) {
      const ok = itemText({ frontMatter: { 'bears-on': bearsOn, rank: 'high' } });
      expect(checkItemText('docs/outbox/1081/s1-01-ok.md', ok, { laws })).toEqual([]);
      const low = itemText({ frontMatter: { 'bears-on': bearsOn, rank: 'medium' } });
      expect(checkItemText('docs/outbox/1081/s1-01-low.md', low, { laws })).toHaveLength(1);
    }
  });
});

describe('findOutboxViolations', () => {
  it('passes on an empty tree — this slice builds the outbox, it does not use it', () => {
    expect(findOutboxViolations({ ctx: flatCtx(root) })).toEqual([]);
  });

  it('passes on a tree of well-formed fixture items', () => {
    mkdirSync(join(root, 'docs/outbox/985'), { recursive: true });
    writeFileSync(join(root, 'docs/outbox/985/s2-01-a.md'), itemText());
    writeFileSync(
      join(root, 'docs/outbox/985/s2-02-b.md'),
      itemText({ frontMatter: { id: 's2-02-b', 'bears-on': 'N2', rank: 'high' } }),
    );

    expect(findOutboxViolations({ ctx: flatCtx(root) })).toEqual([]);
  });

  it('collects violations across several item files, each naming its own file', () => {
    mkdirSync(join(root, 'docs/outbox/985'), { recursive: true });
    writeFileSync(join(root, 'docs/outbox/985/s2-01-good.md'), itemText());
    writeFileSync(
      join(root, 'docs/outbox/985/s2-02-floor.md'),
      itemText({ frontMatter: { id: 's2-02-floor', 'bears-on': 'N2', rank: 'medium' } }),
    );

    const violations = findOutboxViolations({ ctx: flatCtx(root) });
    expect(violations).toHaveLength(1);
    expect(violations[0]!.startsWith('docs/outbox/985/s2-02-floor.md:')).toBe(true);
  });

  describe('Became: every id resolves (Task 7)', () => {
    it('refuses a Became: id that names no knowledge entry', () => {
      const m = makeMarkers('omni-outbox');
      const { ctx } = makeRepo({
        config: { laws: { source: 'knowledge' } },
        files: {
          '.omni-loop/delivery/inbox/0042-a/spec.md': 'x',
          '.omni-loop/delivery/outbox/0042-a/settled.md': [
            m.settledOpen('s1-01-x'),
            '## s1-01-x — agreed',
            '- Verdict: agreed',
            '- Closed: yes',
            '- Became: P-PRODUCT-9',
            m.settledClose('s1-01-x'),
            '',
          ].join('\n'),
        },
      });
      expect(findOutboxViolations({ ctx }).join('\n')).toMatch(/s1-01-x Became: P-PRODUCT-9/);
    });

    it('accepts a Became: id that resolves to a real knowledge entry', () => {
      const m = makeMarkers('omni-outbox');
      const { ctx } = makeRepo({
        config: { laws: { source: 'knowledge' } },
        files: {
          '.omni-loop/delivery/inbox/0042-a/spec.md': 'x',
          '.omni-loop/knowledge/product/principles.md': [
            '## P-PRODUCT-9',
            '',
            'Something decided.',
            '',
            'Why: x',
            'Decided: y',
            'Source: PRD #3',
            '',
          ].join('\n'),
          '.omni-loop/delivery/outbox/0042-a/settled.md': [
            m.settledOpen('s1-01-x'),
            '## s1-01-x — agreed',
            '- Verdict: agreed',
            '- Closed: yes',
            '- Became: P-PRODUCT-9',
            m.settledClose('s1-01-x'),
            '',
          ].join('\n'),
        },
      });
      expect(findOutboxViolations({ ctx })).toEqual([]);
    });
  });

  describe('Became: a playbook section (PRD 45)', () => {
    const SETTLED = '.omni-loop/delivery/outbox/0042-a/settled.md';
    const TESTING = '.omni-loop/knowledge/playbook/testing.md';

    /** A settled ledger whose one entry, `s1-01-x`, became `became`. */
    function settled(became: string) {
      const m = makeMarkers('omni-outbox');
      return [m.settledOpen('s1-01-x'), '## s1-01-x — agreed', '- Verdict: agreed', '- Closed: yes', `- Became: ${became}`, m.settledClose('s1-01-x'), ''].join('\n');
    }

    /** A testing form holding one `never` slot with `body`. */
    const testingForm = (body: string) => formText({ frontMatter: { state: 'filled' }, slots: [{ id: 'never', required: true, by: 'human', body }] } as never);

    function violations(files: Record<string, string>, became = 'playbook/testing#never') {
      const { ctx } = makeRepo({ files: { '.omni-loop/delivery/inbox/0042-a/spec.md': 'x', [SETTLED]: settled(became), ...files } });
      return findOutboxViolations({ ctx });
    }

    it('passes when the slot exists and is not blank', () => {
      expect(violations({ [TESTING]: testingForm('- A test never calls the network.') })).toEqual([]);
    });

    it('fails naming the settled file when the form file is missing', () => {
      expect(violations({})).toEqual([`${SETTLED}: s1-01-x Became: playbook/testing#never — no form file at ${TESTING}`]);
    });

    it('fails naming the settled file when the kit has no such form', () => {
      expect(violations({}, 'playbook/tests#never')).toEqual([expect.stringMatching(new RegExp(`^${SETTLED}: s1-01-x Became: playbook/tests#never — .*no form "tests"`))]);
    });

    it('fails naming the settled file when the form has no such slot', () => {
      const form = formText({ frontMatter: { state: 'filled' }, slots: [{ id: 'levels', body: 'x' }] } as never);
      expect(violations({ [TESTING]: form })).toEqual([`${SETTLED}: s1-01-x Became: playbook/testing#never — ${TESTING} has no slot "never"`]);
    });

    it('fails naming the settled file when the slot’s body is blank', () => {
      expect(violations({ [TESTING]: testingForm('') })).toEqual([`${SETTLED}: s1-01-x Became: playbook/testing#never — ${TESTING}: slot "never" is blank`]);
    });

    it('resolves a playbook section beside an ADR and a knowledge id, each as before', () => {
      const files = {
        [TESTING]: testingForm('- A test never calls the network.'),
        '.omni-loop/knowledge/adr/0002-x.md': '# 0002 X\n',
        '.omni-loop/knowledge/product/principles.md': '## P-PRODUCT-9\n\nSomething decided.\n\nWhy: x\nDecided: y\nSource: PRD #3\n',
      };
      expect(violations(files, 'P-PRODUCT-9, ADR-0002, playbook/testing#never')).toEqual([]);
      expect(violations(files, 'P-PRODUCT-8, ADR-0003, playbook/testing#never').join('\n')).toMatch(
        /Became: P-PRODUCT-8 — [^\n]*\n[^\n]*Became: ADR-0003 — no decision record/,
      );
    });
  });

  it('accepts a resolving Became: id under laws.source none — the knowledge folder is read in every profile', () => {
    const m = makeMarkers('omni-outbox');
    const { ctx } = makeRepo({
      config: { laws: { source: 'none' } },
      files: {
        '.omni-loop/delivery/inbox/0042-a/spec.md': 'x',
        '.omni-loop/knowledge/product/principles.md': '## P-PRODUCT-9\n\nSomething decided.\n\nWhy: x\nDecided: y\nSource: PRD #3\n',
        '.omni-loop/delivery/outbox/0042-a/settled.md': [
          m.settledOpen('s1-01-x'), '## s1-01-x — agreed', '- Verdict: agreed', '- Closed: yes', '- Became: P-PRODUCT-9', m.settledClose('s1-01-x'), '',
        ].join('\n'),
      },
    });
    expect(findOutboxViolations({ ctx })).toEqual([]);
  });

  describe('no open item in a shipped PRD (Task 7)', () => {
    it('refuses an open item in a shipped PRD', () => {
      const { ctx } = makeRepo({
        files: { '.omni-loop/delivery/shipped/0007-b/outbox/s2-01-y.md': VALID_ITEM_TEXT },
      });
      expect(findOutboxViolations({ ctx }).join('\n')).toMatch(/open item in a shipped PRD/);
    });

    it('does not also grade a shipped open item’s format — one violation is enough', () => {
      // Two distinct format problems (bad rank, missing section) would be two violations if this
      // file were graded through checkItemText — proving the shipped check short-circuits rather
      // than coincidentally landing on one violation anyway.
      const malformed = itemText({
        frontMatter: { prd: 7, rank: 'urgent' },
        sections: { 'What I could not know': undefined },
      });
      const { ctx } = makeRepo({
        files: { '.omni-loop/delivery/shipped/0007-b/outbox/s2-01-y.md': malformed },
      });
      expect(findOutboxViolations({ ctx })).toHaveLength(1);
    });
  });
});
